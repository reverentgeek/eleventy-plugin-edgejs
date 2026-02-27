import edgeJsPlugin from "../edgeJsPlugin.js";

export default function ( eleventyConfig ) {
	eleventyConfig.addPassthroughCopy( "example/src/images" );

	eleventyConfig.addPlugin( edgeJsPlugin, {
		globals: {
			siteName: "The Cutting Edge",
			tagline: "Where templates are sharp and the jokes are... not."
		}
	} );

	// Filters (bridged as Edge globals)
	eleventyConfig.addFilter( "upcase", str => str.toUpperCase() );
	eleventyConfig.addFilter( "lowercase", str => str.toLowerCase() );
	eleventyConfig.addFilter( "reverse", str => str.split( "" ).reverse().join( "" ) );

	// Shortcodes (bridged as Edge globals)
	eleventyConfig.addShortcode( "year", () => `${ new Date().getFullYear() }` );
	eleventyConfig.addShortcode( "icon", name => `<span class="icon icon-${ name }" aria-hidden="true"></span>` );
	eleventyConfig.addShortcode( "dadjoke", () => {
		const jokes = [
			"Why do programmers prefer dark mode? Because light attracts bugs.",
			"There's no place like 127.0.0.1.",
			"A programmer's wife tells him: 'Go to the store and get a loaf of bread. If they have eggs, get a dozen.' He comes home with 12 loaves of bread."
		];
		return jokes[ Math.floor( Math.random() * jokes.length ) ];
	} );

	// Paired shortcodes (content is first argument)
	eleventyConfig.addPairedShortcode( "callout", ( content, type = "info" ) => {
		return `<div class="callout callout-${ type }">${ content }</div>`;
	} );
}
