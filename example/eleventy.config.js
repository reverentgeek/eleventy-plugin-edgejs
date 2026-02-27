import edgeJsPlugin from "../edgeJsPlugin.js";

export default function ( eleventyConfig ) {
	eleventyConfig.addPlugin( edgeJsPlugin );

	eleventyConfig.addFilter( "upcase", str => str.toUpperCase() );
	eleventyConfig.addShortcode( "year", () => `${ new Date().getFullYear() }` );
}
