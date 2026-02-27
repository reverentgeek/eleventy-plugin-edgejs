import { strictEqual, match, doesNotMatch } from "node:assert";
import { test, describe } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Edge } from "edge.js";
import Eleventy from "@11ty/eleventy";

import edgeJsPlugin from "../edgeJsPlugin.js";

const dirname = path.dirname( fileURLToPath( import.meta.url ) );
const input = path.relative( ".", path.join( dirname, "stubs" ) );

async function getTestResults( configCallback, options = {} ) {
	let elev = new Eleventy( input, undefined, {
		config: ( eleventyConfig ) => {
			eleventyConfig.addPlugin( edgeJsPlugin, options );
			configCallback( eleventyConfig );
		}
	} );

	return await elev.toJSON();
}

test( "EdgeJs basic variable interpolation", async () => {
	let [ result ] = await getTestResults( ( eleventyConfig ) => {
		eleventyConfig.addTemplate( "sample.edge", "<p>{{ name }}</p>", {
			name: "David"
		} );
	} );

	strictEqual( result.content.trim(), "<p>David</p>" );
} );

describe( "EdgeJs escaped and unescaped output", () => {
	test( "Escaped output (HTML)", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate( "sample.edge", "<p>{{ name }}</p>", {
				name: "<b>David</b>"
			} );
		} );

		strictEqual( result.content.trim(), "<p>&lt;b&gt;David&lt;/b&gt;</p>" );
	} );

	test( "Unescaped output (HTML)", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate( "sample.edge", "<p>{{{ name }}}</p>", {
				name: "<b>David</b>"
			} );
		} );

		strictEqual( result.content.trim(), "<p><b>David</b></p>" );
	} );
} );

describe( "EdgeJs conditionals", () => {
	test( "@if true", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@if(show)\n<p>Visible</p>\n@end",
				{ show: true }
			);
		} );

		strictEqual( result.content.trim(), "<p>Visible</p>" );
	} );

	test( "@if false with @else", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@if(show)\n<p>Yes</p>\n@else\n<p>No</p>\n@end",
				{ show: false }
			);
		} );

		strictEqual( result.content.trim(), "<p>No</p>" );
	} );
} );

describe( "EdgeJs loops", () => {
	test( "@each loop", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@each(item in items)\n<li>{{ item }}</li>\n@end",
				{ items: [ "a", "b", "c" ] }
			);
		} );

		match( result.content, /<li>a<\/li>/ );
		match( result.content, /<li>b<\/li>/ );
		match( result.content, /<li>c<\/li>/ );
	} );
} );

describe( "EdgeJs includes", () => {
	test( "Include partial", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>\n@include('included')\n</p>",
				{}
			);
		} );

		match( result.content, /This is an include\./ );
	} );

	test( "Include nested partial", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>\n@include('subfolder/nested')\n</p>",
				{}
			);
		} );

		match( result.content, /This is a nested include\./ );
	} );
} );

describe( "EdgeJs filters as globals", () => {
	test( "Filter bridged as global function", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addFilter( "upcase", str => str.toUpperCase() );

			eleventyConfig.addTemplate( "sample.edge", "<p>{{ upcase(name) }}</p>", {
				name: "David"
			} );
		} );

		strictEqual( result.content.trim(), "<p>DAVID</p>" );
	} );

	test( "Filter with multiple arguments", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addFilter( "join", ( a, b ) => `${ a }-${ b }` );

			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>{{ join(first, second) }}</p>",
				{ first: "hello", second: "world" }
			);
		} );

		strictEqual( result.content.trim(), "<p>hello-world</p>" );
	} );
} );

describe( "EdgeJs shortcodes as globals", () => {
	test( "Shortcode bridged as global", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addShortcode( "greeting", name => `Hello, ${ name }!` );

			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>{{ greeting(name) }}</p>",
				{ name: "David" }
			);
		} );

		strictEqual( result.content.trim(), "<p>Hello, David!</p>" );
	} );

	test( "Async shortcode", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addShortcode( "asyncGreet", async ( name ) => {
				return `Hi, ${ name }!`;
			} );

			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>{{ await asyncGreet(name) }}</p>",
				{ name: "David" }
			);
		} );

		strictEqual( result.content.trim(), "<p>Hi, David!</p>" );
	} );
} );

describe( "EdgeJs paired shortcodes as globals", () => {
	test( "Paired shortcode bridged as global", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addPairedShortcode( "wrapper", ( content ) => {
				return `BEFORE${ content }AFTER`;
			} );

			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>{{ wrapper('inner content') }}</p>",
				{}
			);
		} );

		strictEqual( result.content.trim(), "<p>BEFOREinner contentAFTER</p>" );
	} );
} );

describe( "EdgeJs conditionals - extended", () => {
	test( "@elseif", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@if(role === 'admin')\n<p>Admin</p>\n@elseif(role === 'editor')\n<p>Editor</p>\n@else\n<p>Guest</p>\n@end",
				{ role: "editor" }
			);
		} );

		strictEqual( result.content.trim(), "<p>Editor</p>" );
	} );

	test( "@unless", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@unless(isActive)\n<p>Inactive</p>\n@end",
				{ isActive: false }
			);
		} );

		strictEqual( result.content.trim(), "<p>Inactive</p>" );
	} );

	test( "@unless with truthy value produces no output", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@unless(isActive)\n<p>Inactive</p>\n@end",
				{ isActive: true }
			);
		} );

		strictEqual( result.content.trim(), "" );
	} );

	test( "Inline ternary expression", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>{{ isAdmin ? 'Admin' : 'User' }}</p>",
				{ isAdmin: true }
			);
		} );

		strictEqual( result.content.trim(), "<p>Admin</p>" );
	} );
} );

describe( "EdgeJs loops - extended", () => {
	test( "@each with index", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@each((item, index) in items)\n<li>{{ index }}: {{ item }}</li>\n@end",
				{ items: [ "a", "b", "c" ] }
			);
		} );

		match( result.content, /<li>0: a<\/li>/ );
		match( result.content, /<li>1: b<\/li>/ );
		match( result.content, /<li>2: c<\/li>/ );
	} );

	test( "@each with @else fallback for empty collection", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@each(item in items)\n<li>{{ item }}</li>\n@else\n<p>No items</p>\n@end",
				{ items: [] }
			);
		} );

		strictEqual( result.content.trim(), "<p>No items</p>" );
	} );

	test( "@each over object key-value pairs", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@each((value, key) in obj)\n<li>{{ key }}: {{ value }}</li>\n@end",
				{ obj: { color: "red", size: "large" } }
			);
		} );

		match( result.content, /<li>color: red<\/li>/ );
		match( result.content, /<li>size: large<\/li>/ );
	} );
} );

describe( "EdgeJs template comments", () => {
	test( "Comments are stripped from output", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>Hello</p>\n{{-- This is a comment --}}\n<p>World</p>",
				{}
			);
		} );

		match( result.content, /<p>Hello<\/p>/ );
		match( result.content, /<p>World<\/p>/ );
		doesNotMatch( result.content, /This is a comment/ );
	} );

	test( "Multi-line comment", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>Before</p>\n{{--\n  Multi-line\n  comment\n--}}\n<p>After</p>",
				{}
			);
		} );

		doesNotMatch( result.content, /Multi-line/ );
		doesNotMatch( result.content, /comment/ );
	} );
} );

describe( "EdgeJs inline variables", () => {
	test( "@let declares a variable", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@let(greeting = 'Hello World')\n<p>{{ greeting }}</p>",
				{}
			);
		} );

		match( result.content, /<p>Hello World<\/p>/ );
	} );

	test( "@assign reassigns a variable", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@let(total = 0)\n@each(n in numbers)\n@assign(total = total + n)\n@end\n<p>{{ total }}</p>",
				{ numbers: [ 1, 2, 3 ] }
			);
		} );

		match( result.content, /<p>6<\/p>/ );
	} );
} );

describe( "EdgeJs @includeIf", () => {
	test( "@includeIf with truthy condition includes partial", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>\n@includeIf(showInclude, 'included')\n</p>",
				{ showInclude: true }
			);
		} );

		match( result.content, /This is an include\./ );
	} );

	test( "@includeIf with falsy condition produces no output", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>\n@includeIf(showInclude, 'included')\n</p>",
				{ showInclude: false }
			);
		} );

		doesNotMatch( result.content, /This is an include\./ );
	} );
} );

describe( "EdgeJs @eval", () => {
	test( "@eval executes expression with no output", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@let(items = [])\n@eval(items.push('a'))\n@eval(items.push('b'))\n<p>{{ items.join(',') }}</p>",
				{}
			);
		} );

		match( result.content, /<p>a,b<\/p>/ );
	} );
} );

describe( "EdgeJs escaped syntax", () => {
	test( "@{{ }} outputs literal curly braces", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>@{{ name }}</p>",
				{ name: "David" }
			);
		} );

		strictEqual( result.content.trim(), "<p>{{ name }}</p>" );
	} );
} );

describe( "EdgeJs multi-line expressions", () => {
	test( "Multi-line interpolation", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>{{\n  items\n    .map(i => i.toUpperCase())\n    .join(', ')\n}}</p>",
				{ items: [ "a", "b", "c" ] }
			);
		} );

		strictEqual( result.content.trim(), "<p>A, B, C</p>" );
	} );
} );

describe( "EdgeJs built-in helpers", () => {
	test( "html.classNames()", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<div class=\"{{ html.classNames(['btn', { active: isActive, disabled: isDisabled }]) }}\"></div>",
				{ isActive: true, isDisabled: false }
			);
		} );

		match( result.content, /class="btn active"/ );
		doesNotMatch( result.content, /disabled/ );
	} );

	test( "truncate()", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>{{ truncate(text, 10) }}</p>",
				{ text: "Hello World, this is a long string" }
			);
		} );

		match( result.content, /<p>Hello World\.\.\.<\/p>/ );
	} );

	test( "nl2br()", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"{{{ nl2br(text) }}}",
				{ text: "line one\nline two" }
			);
		} );

		match( result.content, /line one<br>/ );
		match( result.content, /line two/ );
	} );
} );

describe( "EdgeJs newline suppression", () => {
	test( "Tilde (~) suppresses trailing newline", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@if(true)~\nHello\n@end",
				{}
			);
		} );

		match( result.content, /Hello/ );
	} );
} );

describe( "EdgeJs components", () => {
	test( "@component with props", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@component('components/button', { text: 'Click', type: 'primary' })\n@end",
				{}
			);
		} );

		match( result.content, /<button class="primary">Click<\/button>/ );
	} );

	test( "@!component self-closing", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@!component('components/button', { text: 'Submit', type: 'secondary' })",
				{}
			);
		} );

		match( result.content, /<button class="secondary">Submit<\/button>/ );
	} );
} );

describe( "EdgeJs slots", () => {
	test( "Default slot", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@component('components/card')\n<p>Card content</p>\n@end",
				{}
			);
		} );

		match( result.content, /<div class="card">/ );
		match( result.content, /<p>Card content<\/p>/ );
	} );

	test( "Named slots", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@component('components/modal')\n@slot('header')\n<h2>Title</h2>\n@end\n@slot('footer')\n<button>Close</button>\n@end\nBody content\n@end",
				{}
			);
		} );

		match( result.content, /<header><h2>Title<\/h2><\/header>/ );
		match( result.content, /<main>Body content<\/main>/ );
		match( result.content, /<footer><button>Close<\/button><\/footer>/ );
	} );

	test( "Optional slot not rendered when absent", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@component('components/modal')\n@slot('header')\n<h2>Title</h2>\n@end\nBody content\n@end",
				{}
			);
		} );

		match( result.content, /<header><h2>Title<\/h2><\/header>/ );
		match( result.content, /<main>Body content<\/main>/ );
		doesNotMatch( result.content, /<footer>/ );
	} );

	test( "Component receives template data", async () => {
		let [ result ] = await getTestResults( ( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"@!component('components/button', { text: name, type: 'primary' })",
				{ name: "David" }
			);
		} );

		match( result.content, /<button class="primary">David<\/button>/ );
	} );
} );

test( "EdgeJs front matter data access", async () => {
	let results = await getTestResults( () => {} );

	let indexResult = results.find( r => r.url === "/" );
	strictEqual( indexResult.content.trim(), "Hello World!" );
} );

test( "EdgeJs permalink compilation", async () => {
	let results = await getTestResults( () => {} );

	let permalinkResult = results.find( r => r.url === "/my-page/" );
	strictEqual( permalinkResult.url, "/my-page/" );
	strictEqual( permalinkResult.content.trim(), "Permalink test" );
} );

test( "EdgeJs custom globals via plugin options", async () => {
	let [ result ] = await getTestResults(
		( eleventyConfig ) => {
			eleventyConfig.addTemplate(
				"sample.edge",
				"<p>{{ siteName }}</p>",
				{}
			);
		},
		{
			globals: {
				siteName: "My Site"
			}
		}
	);

	strictEqual( result.content.trim(), "<p>My Site</p>" );
} );

test( "EdgeJs library override option", async () => {
	let customEdge = Edge.create();

	let [ result ] = await getTestResults(
		( eleventyConfig ) => {
			eleventyConfig.addTemplate( "sample.edge", "<p>{{ name }}</p>", {
				name: "Override"
			} );
		},
		{
			eleventyLibraryOverride: customEdge
		}
	);

	strictEqual( result.content.trim(), "<p>Override</p>" );
} );
