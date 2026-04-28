# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev server (port 9000, auto-open)
npm run dev

# Build library to dist/
npm run build

# Lint + fix
npm run lint

# Format
npm run format

# Bundle analyzer
npm run analyzer
```

No test suite exists in this repo.

## Architecture

**Umo Editor** is a Vue 3 component library published as `@umoteam/editor`. Entry point: `src/components/index.js` exports `UmoEditor` (default), `UmoMenuButton`, `UmoDialog`, `UmoTooltip`, and the Vue plugin `useUmoEditor`.

Build target: `dist/umo-editor.js` + `dist/umo-editor.css` (library mode, all deps externalized). All runtime deps in `package.json` are externalized — consuming apps must install them separately.

### Layer model

```
src/components/index.vue      ← root UmoEditor component
  ├── components/toolbar/     ← classic.vue / ribbon.vue toolbar modes
  ├── components/menus/       ← block menu, bubble menu, toolbar menu buttons
  │   └── toolbar/{base,insert,table,tools,page,view,export}/
  ├── components/editor/      ← EditorContent wrapper (Tiptap)
  ├── components/statusbar/   ← bottom status bar
  └── components/container/   ← page/zoom container
```

### Extensions (`src/extensions/`)

`index.js` exports `getDefaultExtensions()` and `inputAndPasteRules()`. `getDefaultExtensions()` assembles every Tiptap extension into a single array. Extensions can be disabled at runtime via `options.disableExtensions[]` — the check compares against extension `.name`. Custom extensions follow the same pattern: each folder exports a Tiptap `Node`, `Mark`, or `Extension`.

`StarterKit` is used with many sub-features **disabled** (bold, codeBlock, horizontalRule, undoRedo, link, placeholder, dropcursor, selection, bulletList, orderedList, trailingNode) because custom replacements are registered individually.

### State & composables

`src/composables/state.js` — `useState(key, options)` wraps `@vueuse/core`'s `useStorage` for six persisted keys: `document`, `recent`, `toolbar`, `theme`, `skin`, `layout`. Storage key format: `umo-editor:{editorKey}:{key}`.

`src/composables/` is auto-imported by `unplugin-auto-import` — no explicit imports needed inside `src/`. Same applies to `vue` and `@vueuse/core` APIs.

### Options (`src/options/`)

`config/index.js` holds all default option values (locale, toolbar, page margins, document, echarts, etc.). `schema.js` validates options at runtime using `@eslint/object-schema`. Options flow via Vue's `provide/inject` — the root component provides: `options`, `page`, `container`, `uploadFileMap`, `historyRecords`, `destroyed`.

### Toolbar menu groups

Seven groups under `src/components/menus/toolbar/`: `base`, `insert`, `table`, `tools`, `page`, `view`, `export`. To add a toolbar button, add a component to the relevant group folder and register it in `src/options/config/index.js` under `toolbar.menus`.

### Styling

LESS with `@prefix: umo` variable. TDesign Vue Next (`tdesign-vue-next`) is the UI component library (dev-only, auto-resolved via `unplugin-vue-components`). CSS class prefix for all internal elements is `umo-`. The LESS post-processor in `vite.config.js` strips `.flex-center` class definitions to avoid conflicts with consuming apps.

### i18n

`src/i18n.js` + `src/locales/{en-US,zh-CN,ru-RU,it-IT,bo}.json`. The composable `src/composables/i18n.js` exports `l()` (locale-aware lookup supporting `{zh_CN, en_US}` object or plain string) and `t()` (vue-i18n translate). Locale passed via `options.locale`.

### Vite config notes

- `base: '/umo-editor'` for dev server asset paths
- `src/` aliased to `@`
- SVG icons auto-registered from `src/assets/icons/` with symbol id `umo-icon-[name]`
- `unplugin-vue-macros` + `ReactivityTransform` enabled (`$computed`, `$ref` shorthand usable)
- `esbuild.drop: ['debugger']` strips debugger statements on build
- `rolldown` pinned to `1.0.0-rc.5` via overrides — do not change without testing build

### Non-Vue3 / iframe integration

For embedding in non-Vue3 apps (including ai_rdsj), use an iframe pointing to the dev/prod server. The dev server serves at `http://localhost:9000/umo-editor`. Communication with the parent page is via `postMessage`.
