import { Edge } from "edge.js";

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
