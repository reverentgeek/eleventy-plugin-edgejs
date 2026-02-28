import { Edge, Template } from "edge.js";

// Sentinel prefix for async placeholders (uses null byte to avoid collisions with real content)
const ASYNC_PREFIX = "\0__EDGE_ASYNC_";
const ASYNC_SUFFIX = "__\0";
const ASYNC_PATTERN = /\0__EDGE_ASYNC_(\d+)__\0/g;

// Patch Template.prototype.escape to:
// 1. Render null/undefined as empty string (matches Nunjucks, Handlebars, Liquid, Mustache)
// 2. Detect unresolved Promises and defer resolution via placeholders
const _originalEscape = Template.prototype.escape;

Template.prototype.escape = function ( input ) {
	// Convert null/undefined to empty string instead of "null"/"undefined"
	if ( input == null ) return "";

	// Detect unresolved Promises from async filters/shortcodes
	if ( typeof input === "object" && typeof input.then === "function" ) {
		if ( !this.__pendingPromises ) {
			this.__pendingPromises = [];
		}
		const idx = this.__pendingPromises.length;
		this.__pendingPromises.push( input );
		return `${ ASYNC_PREFIX }${ idx }${ ASYNC_SUFFIX }`;
	}

	return _originalEscape.call( this, input );
};

// Patch Template.prototype.renderRaw to resolve async placeholders after rendering
const _originalRenderRaw = Template.prototype.renderRaw;

Template.prototype.renderRaw = function ( contents, state, templatePath ) {
	this.__pendingPromises = [];

	const result = _originalRenderRaw.call( this, contents, state, templatePath );

	// Async mode returns a Promise
	if ( result && typeof result.then === "function" ) {
		return result.then( output => resolveAsyncPlaceholders( this, output ) );
	}

	return result;
};

// Patch Template.prototype.reThrow to preserve the original error as .cause.
// Edge.js discards the original error class when wrapping in EdgeError, which breaks
// Eleventy's two-pass rendering system — it can't detect TemplateContentPrematureUseError
// and fails instead of deferring the template to a second pass.
const _originalReThrow = Template.prototype.reThrow;

Template.prototype.reThrow = function ( error, filename, lineNumber ) {
	try {
		_originalReThrow.call( this, error, filename, lineNumber );
	} catch ( wrapped ) {
		if ( wrapped !== error ) {
			wrapped.cause = error;
		}
		throw wrapped;
	}
};

// Patch Template.prototype.render for includes/components that may also contain async calls
const _originalRender = Template.prototype.render;

Template.prototype.render = function ( template, state ) {
	if ( !this.__pendingPromises ) {
		this.__pendingPromises = [];
	}

	const result = _originalRender.call( this, template, state );

	if ( result && typeof result.then === "function" ) {
		return result.then( output => resolveAsyncPlaceholders( this, output ) );
	}

	return result;
};

async function resolveAsyncPlaceholders( template, output ) {
	if ( !template.__pendingPromises || template.__pendingPromises.length === 0 ) {
		return output;
	}

	const resolved = await Promise.all( template.__pendingPromises );
	template.__pendingPromises = [];

	output = output.replace( ASYNC_PATTERN, ( _, idx ) => {
		const val = resolved[parseInt( idx )];
		if ( val == null ) return "";
		return _originalEscape.call( template, val );
	} );

	// Check if resolving introduced new placeholders (unlikely but possible with nested async)
	if ( ASYNC_PATTERN.test( output ) ) {
		return resolveAsyncPlaceholders( template, output );
	}

	return output;
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

	// Create Edge instance eagerly so it's available for permalink compilation
	let edge = options.eleventyLibraryOverride || Edge.create( { cache: options.cache } );

	// Bridge Eleventy filters as Edge globals
	for ( let [ name, callback ] of Object.entries( eleventyConfig.getFilters() ) ) {
		edge.global( name, callback );
	}

	// Bridge Eleventy shortcodes as Edge globals
	for ( let [ name, callback ] of Object.entries( eleventyConfig.getShortcodes() ) ) {
		edge.global( name, callback );
	}

	// Bridge Eleventy paired shortcodes as Edge globals
	// Content is passed as the first argument, matching the Handlebars plugin pattern
	for ( let [ name, callback ] of Object.entries( eleventyConfig.getPairedShortcodes() ) ) {
		edge.global( name, callback );
	}

	// Register user-provided globals
	for ( let [ name, value ] of Object.entries( options.globals ) ) {
		edge.global( name, value );
	}

	eleventyConfig.addExtension( "edge", {
		init: async function () {
			// Mount _includes directory for @include/@component support
			let includesDir = this.config.directories?.includes;
			if ( includesDir ) {
				edge.mount( new URL( includesDir, `file://${ process.cwd() }/` ) );
			}
		},

		compile: ( str ) => {
			return async ( data ) => {
				return edge.renderRaw( str, data );
			};
		},

		compileOptions: {
			permalink: ( contents ) => {
				if ( typeof contents === "string" ) {
					return async ( data ) => {
						return edge.renderRaw( contents, data );
					};
				}
				return contents;
			}
		}
	} );
}
