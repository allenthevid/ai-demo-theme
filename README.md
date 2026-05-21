# Base Theme

Custom WordPress theme built with [Timber](https://upstatement.com/timber/) (Twig templating), [Tailwind CSS](https://tailwindcss.com/), and ACF Blocks.

## Requirements

- WordPress 5.0+
- PHP 7.4+
- [Composer](https://getcomposer.org/) (for PHP dependencies)
- [Node.js](https://nodejs.org/) (for CSS/JS build)

## Setup

### 1. PHP Dependencies & Environment

The theme loads Composer autoload and an `.env` file from `wp-content/private/` (one level above the theme).

```bash
# From wp-content/private/
composer install
cp ../themes/base-template/.env.example .env
```

The `.env` file only needs one key:

```env
ENV="development"   # Uses uniqid() for cache busting on every page load
ENV="production"    # Uses a fixed version string
```

### 2. Node Dependencies & CSS Build

```bash
npm install
npm run tw          # Watch mode — rebuilds bf.css from Tailwind on changes
npm run build       # One-shot production build
```

Tailwind scans `.php`, `.twig`, `.js`, and `.css` files across `blocks/`, `components/`, `templates/`, `template-parts/`, and `partials/`.

## Project Structure

```
.
├── assets/
│   ├── css/theme/          # Tailwind entry, global styles, normalize
│   ├── css/external/       # Third-party CSS (Swiper, jQuery UI, ACFE)
│   ├── css/admin/          # WP admin overrides
│   ├── js/custom/          # Modular JS (app, animations, global, archive-ajax)
│   ├── js/external/        # GSAP, ScrollTrigger, Swiper
│   ├── js/vendor/          # Lottie player & interactivity
│   ├── img/                # Images (jpg, svg, png, webp)
│   └── video/              # Videos
├── blocks/                 # ACF blocks (one folder per block)
│   └── {name}/
│       ├── block.json      # Block registration
│       ├── controller.php  # PHP data for the block
│       ├── template.twig   # Twig template
│       ├── block.css       # Block-specific styles
│       ├── script.js       # Block-specific JS
│       └── preview.png     # Editor preview thumbnail
├── blocks-collection/      # Client-specific block sets (e.g., omron/)
├── components/             # Reusable Twig partials (heading, cta, image, etc.)
├── includes/               # PHP helpers & hooks
│   ├── timber.php          # Timber/Twig configuration & caching
│   ├── theme-settings.php  # CSS custom property output
│   ├── global_functions.php# Asset URL helpers (svg(), png(), block_icon(), etc.)
│   ├── hooks_filters.php   # Theme hooks & filters
│   ├── shortcodes.php      # Shortcode definitions
│   ├── acf.php             # ACF field group registration
│   ├── svg.php             # SVG handling
│   └── hide-comments.php   # Strips comments from WP admin
├── templates/              # Page templates (Twig)
├── partials/               # Layout partials (header, footer)
├── functions.php           # Theme bootstrap (Timber init, block reg, enqueues)
├── bf.json                 # Theme design tokens (colors, border-radius)
├── tailwind.config.js      # Tailwind config (reads bf.json for theme values)
├── postcss.config.js       # PostCSS pipeline
└── style.css               # Theme header metadata
```

## Block Scripts

### Scaffolding (`create-block`)

Interactive script that asks a few questions and generates a new block folder with all boilerplate files.

```bash
npm run create-block        # Interactive block scaffolding
npm run cb                  # Alias for create-block
```

### Figma-to-Block (`f2b`)

Converts a Figma design section into a block by extracting the design tree, sending it through AI to produce a Tailwind Twig template, and generating all boilerplate files.

**Requirements:**

- `FIGMA_TOKEN` — your Figma personal access token
- `ANTHROPIC_API_KEY` or `DEEPSEEK_API_KEY` — AI provider for interpreting the design
- Create a `.env` file in the theme root with these keys:

```env
FIGMA_TOKEN="figd_..."
ANTHROPIC_API_KEY="sk-ant-..."
```

**Usage:**

```bash
npm run f2b                 # Interactive mode — prompts for Figma file key, canvas, frame, section
npm run f2b -- --list       # Browse all sections in a Figma file (no account needed)
```

**CLI shortcuts (skip interactive prompts):**

```bash
node figma-to-block.js <file-key> <section-name>
```

**What it does:**

1. Fetches the Figma file from the API and caches it in `.figma-cache/`
2. Walks the design tree — extracts text nodes, layout frames, fills, fonts, buttons, images
3. Sends the summarized design data to the AI model with theme color palette and Tailwind constraints
4. Generates the block folder with `block.json`, `controller.php`, `template.twig`, `block.css`, `script.js`, `script.asset.php`, and an `acf-field-group.json` if the AI detects editable fields

## Key Conventions

- **ACF Blocks**: Each block lives in its own folder under `blocks/`. Blocks are auto-registered from `block.json` — no need to manually register in `functions.php`.
- **Timber Context**: Controllers in `controller.php` are automatically loaded and their data is passed to the matching `template.twig`.
- **CSS Cache Busting**: In `development` mode, `_S_VERSION` is a random `uniqid()`. In `production`, it's `1.0.0`.
- **Twig Caching**: Disabled (`CACHE_NONE`) for development; configure in `includes/timber.php` for production.
- **Tailwind Theme Tokens**: Colors and border-radius come from `bf.json` — edit that file to update the design system site-wide.
