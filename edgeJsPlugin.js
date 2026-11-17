import { resolve } from "node:path";
import { Edge } from "edge.js";

const ASYNC_PREFIX = "\0__EDGE_ASYNC_";
const ASYNC_SUFFIX = "__\0";
const ASYNC_PATTERN = /\0__EDGE_ASYNC_(\d+)__\0/g;

const RENDER_SETUP_KEY = "eleventy-plugin-edgejs.renderSetup";
const RENDER_SETUP = Symbol.for( RENDER_SETUP_KEY );
const preparedEdges = new WeakSet();

function prepareEdge( edge ) {
	if ( preparedEdges.has( edge ) ) {
		return;
	}
	preparedEdges.add( edge );

	edge.processor.process( "compiled", ( { compiled } ) => {
		// Edge creates a fresh Template for each render and shares it with its partials
		// and components. Only Eleventy renders supply the setup callback.
		const setup = `state[Symbol.for(${ JSON.stringify( RENDER_SETUP_KEY ) })]?.(template, state);\n`;
		// Pass the state where the error occurred so component props aren't mistaken for page data.
		return setup + compiled.replace(
			/^template\.reThrow\(error, \$filename, \$lineNumber\);$/gm,
			"template.reThrow(error, $filename, $lineNumber, state);"
		);
	} );
}

export default function edgeJsPlugin( eleventyConfig, options = {} ) {
	eleventyConfig.versionCheck( ">=3.0.0" );

	options = Object.assign(
		{
			cache: false,
			eleventyLibraryOverride: undefined,
			globals: {}
		},
		options || {}
	);

	eleventyConfig.addTemplateFormats( "edge" );

	const edge = options.eleventyLibraryOverride || Edge.create( { cache: options.cache } );
	prepareEdge( edge );
	const cachePaths = new Set();
	const bridgedFunctions = new Map();
	const warnedNames = new Set();

	function registerGlobals( globals, kind ) {
		for ( const [ name, value ] of Object.entries( globals ) ) {
			edge.global( name, value );
			if ( typeof value === "function" ) {
				bridgedFunctions.set( name, kind );
			} else {
				bridgedFunctions.delete( name );
			}
		}
	}

	// All Eleventy plugins have registered their filters and shortcodes by this event.
	eleventyConfig.on( "eleventy.config", ( { directories } ) => {
		registerGlobals( eleventyConfig.getFilters(), "filter" );
		registerGlobals( eleventyConfig.getShortcodes(), "shortcode" );
		registerGlobals( eleventyConfig.getPairedShortcodes(), "paired shortcode" );
		registerGlobals( options.globals, "global" );

		if ( directories?.includes ) {
			edge.mount( resolve( directories.includes ) );
		}
	} );

	eleventyConfig.on( "eleventy.before", () => {
		warnedNames.clear();
		// Reuse compiled components within a build and reload them for the next build.
		for ( const path of cachePaths ) {
			edge.asyncCompiler.cacheManager.delete( path );
		}
		cachePaths.clear();
	} );

	function warnOnShadowedFunction( error, filename, data ) {
		const name = error instanceof TypeError && /^state\.([^ .]+) is not a function$/.exec( error.message )?.[1];
		const kind = bridgedFunctions.get( name );
		if ( !kind || warnedNames.has( name ) || !Object.hasOwn( data, name ) || typeof data[name] === "function" ) {
			return;
		}

		warnedNames.add( name );
		const pagePath = data.page?.inputPath;
		const location = pagePath && pagePath !== filename ? `${ pagePath } (rendering ${ filename })` : filename;
		console.warn(
			`[eleventy-plugin-edgejs] ${ location } calls ${ name }(), but the page data also defines "${ name }", which hides the "${ name }" ${ kind }. `
			+ `Edge looks up page data before globals. Rename the data key or the ${ kind }.`
		);
	}

	async function render( contents, data, inputPath ) {
		const pending = [];
		let escapeValue;

		const output = await edge.renderRaw( contents, {
			...data,
			[RENDER_SETUP]( template, pageState ) {
				delete pageState[RENDER_SETUP];
				const { compileComponent, escape, reThrow } = template;
				if ( edge.asyncCompiler.cacheManager.enabled ) {
					template.compileComponent = ( path ) => {
						// An override can already have a component in its cache.
						cachePaths.add( edge.loader.makePath( path ) );
						return compileComponent.call( template, path );
					};
				}
				escapeValue = input => input == null ? "" : escape.call( template, input );
				template.escape = ( input ) => {
					if ( input && typeof input === "object" && typeof input.then === "function" ) {
						const promise = Promise.resolve( input );
						// Observe rejections before rendering yields to another async expression.
						promise.catch( () => {} );
						const index = pending.push( promise ) - 1;
						return `${ ASYNC_PREFIX }${ index }${ ASYNC_SUFFIX }`;
					}
					return escapeValue( input );
				};

				template.reThrow = ( error, filename, lineNumber, state ) => {
					try {
						reThrow.call( template, error, filename, lineNumber );
					} catch ( wrapped ) {
						if ( wrapped !== error ) {
							// Eleventy needs the original error to retry templates that read
							// another template's content before it has been rendered.
							wrapped.cause = error;
							if ( state === pageState ) {
								warnOnShadowedFunction( error, filename, data );
							}
						}
						throw wrapped;
					}
				};
			}
		}, inputPath );

		if ( pending.length === 0 ) {
			return output;
		}
		const values = await Promise.all( pending );
		return output.replace( ASYNC_PATTERN, ( token, index ) => {
			if ( Number( index ) >= values.length ) {
				return token;
			}
			return escapeValue( values[index] );
		} );
	}

	eleventyConfig.addExtension( "edge", {
		compile: ( contents, inputPath ) => data => render( contents, data, inputPath ),

		compileOptions: {
			permalink: ( contents, inputPath ) => {
				if ( typeof contents === "string" ) {
					return data => render( contents, data, inputPath );
				}
				return contents;
			}
		}
	} );
}
