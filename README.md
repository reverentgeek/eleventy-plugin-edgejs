# eleventy-plugin-edgejs

An [Eleventy](https://www.11ty.dev/) plugin that adds support for [Edge.js](https://edgejs.dev/) templates. Edge.js is a modern, async-first templating engine from the AdonisJS team.

Requires Eleventy v3.0.0+ and Node.js 22+.

## Installation

```sh
npm install eleventy-plugin-edgejs
```

## Usage

> [!TIP]
> This repository includes a working Eleventy site with more template and syntax examples. Browse the [example source](./example) or see the [Example Site](#example-site) section for instructions on running it locally.

Register the plugin in your Eleventy config file:

```js
import edgeJsPlugin from "eleventy-plugin-edgejs";

export default function ( eleventyConfig ) {
  eleventyConfig.addPlugin( edgeJsPlugin );
}
```

Create `.edge` files in your project and they'll be processed by Edge.js automatically.

### Plugin Options

```js
eleventyConfig.addPlugin( edgeJsPlugin, {
  // Enable template caching (default: false)
  cache: false,

  // Provide your own Edge.js instance
  eleventyLibraryOverride: undefined,

  // Register global variables available in all templates
  globals: {
    siteName: "My Site"
  }
} );
```

### Filters and Shortcodes

Eleventy universal filters and shortcodes are automatically bridged into Edge.js templates as global functions. Edge.js does not use a pipe syntax for filters — instead, call them as functions:

```js
// eleventy.config.js
eleventyConfig.addFilter( "upcase", ( str ) => str.toUpperCase() );
eleventyConfig.addShortcode( "year", () => `${ new Date().getFullYear() }` );
```

```edge
{{-- In your .edge template --}}
<p>{{ upcase( name ) }}</p>
<p>&copy; {{ year() }}</p>
```

Paired shortcodes also work as globals. The content is passed as the first argument.

## Edge.js Template Syntax

### Variable Interpolation

Use double curly braces for escaped output and triple curly braces for raw (unescaped) output:

```edge
{{ title }}
{{{ rawHtml }}}
```

### Conditionals

```edge
@if( user.isAdmin )
  <p>Welcome, admin!</p>
@elseif( user.isMember )
  <p>Welcome, member!</p>
@else
  <p>Welcome, guest!</p>
@end

@unless( isLoggedIn )
  <p>Please log in.</p>
@end
```

Ternary expressions work inline:

```edge
<p>{{ isActive ? "Active" : "Inactive" }}</p>
```

### Loops

```edge
@each( item in items )
  <li>{{ item }}</li>
@end

{{-- With index --}}
@each( ( item, index ) in items )
  <li>{{ index }}: {{ item }}</li>
@end

{{-- Loop over object entries --}}
@each( ( value, key ) in object )
  <dt>{{ key }}</dt>
  <dd>{{ value }}</dd>
@end

{{-- Empty fallback --}}
@each( item in items )
  <li>{{ item }}</li>
@else
  <li>No items found.</li>
@end
```

### Variables

Declare or reassign variables within a template:

```edge
@let( greeting = "Hello" )
<p>{{ greeting }}, World!</p>

@assign( greeting = "Hi" )
<p>{{ greeting }}, World!</p>
```

### Includes

Include partial templates from your `_includes` directory. Edge.js `@` tags must be on their own line:

```edge
<header>
@include( 'nav' )
</header>

{{-- Conditional include (renders only when condition is truthy) --}}
@includeIf( showSidebar, 'sidebar' )
```

### Components and Slots

Components live in `_includes/components/`. They provide a powerful alternative to template inheritance.

A component file (`_includes/components/card.edge`):

```edge
<div class="card">
  <div class="card-body">{{{ await $slots.main() }}}</div>
</div>
```

Using the component:

```edge
@component( 'components/card' )
  <p>This goes into the main slot.</p>
@end
```

#### Named Slots

A component with multiple slots (`_includes/components/modal.edge`):

```edge
<div class="modal">
  <header>{{{ await $slots.header() }}}</header>
  <main>{{{ await $slots.main() }}}</main>
  @if( $slots.footer )
  <footer>{{{ await $slots.footer() }}}</footer>
  @end
</div>
```

Using named slots:

```edge
@component( 'components/modal' )
  @slot( 'header' )
    <h2>Modal Title</h2>
  @end

  @slot( 'main' )
    <p>Modal content goes here.</p>
  @end

  @slot( 'footer' )
    <button>Close</button>
  @end
@end
```

#### Component Props

Pass data to components as attributes:

```edge
{{-- _includes/components/button.edge --}}
<button class="{{ type }}">{{ text }}</button>
```

```edge
@component( 'components/button', { type: 'primary', text: 'Click me' } )
@end

{{-- Self-closing form --}}
@!component( 'components/button', { type: 'danger', text: 'Delete' } )
```

### Comments

Edge.js comments are stripped from the output:

```edge
{{-- This comment will not appear in the HTML --}}
```

### Escaping Edge Syntax

Prefix `@` to output curly braces literally:

```edge
@{{ this will not be interpreted }}
```

### Built-in Helpers

Edge.js includes several built-in helpers:

```edge
{{-- CSS class builder --}}
<div class="{{ html.classNames( { active: isActive, hidden: !isVisible } ) }}"></div>

{{-- Truncate text --}}
<p>{{ truncate( longText, 20 ) }}</p>

{{-- Convert newlines to <br> tags --}}
{{{ nl2br( multiLineText ) }}}
```

### Newline Suppression

Use `~` to remove trailing newlines from tag output:

```edge
@if( show )~
  content
@end
```

## Layouts

Use Eleventy's built-in layout system with `.edge` files. Set the layout in front matter:

```edge
---
layout: layout.edge
title: My Page
---
<h1>{{ title }}</h1>
<p>Page content here.</p>
```

In your layout file (`_includes/layout.edge`):

```edge
<!DOCTYPE html>
<html>
<head>
  <title>{{ title }}</title>
</head>
<body>
@include( 'nav' )
  <main>{{{ content }}}</main>
</body>
</html>
```

## Example Site

This repository includes a working Eleventy site with more template and syntax examples. To run it locally:

```sh
git clone https://github.com/reverentgeek/eleventy-plugin-edgejs.git
cd eleventy-plugin-edgejs
npm install
npm run start:example
```

This starts a local dev server so you can browse the examples and experiment with Edge.js templates.

## Further Reading

- [Edge.js documentation](https://edgejs.dev/)
- [Eleventy custom template languages](https://www.11ty.dev/docs/languages/custom/)

## License

[MIT](./LICENSE)
