# Repository Guidelines

## Project Structure & Module Organization

This repository implements the `study-sheet` skill for generating printable English, math, and Chinese worksheets. `SKILL.md` defines the user-facing workflow; `references/` contains subject rules, the input schema, and implementation notes. `scripts/` contains TypeScript validation, arithmetic, rendering, browser, and PDF generation code. `assets/templates/` and `assets/print.css` control presentation; `assets/fonts/` holds the bundled font and license. Tests live in `tests/`, with example inputs in `tests/fixtures/`. Generated files belong in `output/` or `.test-output/`, both ignored by Git.

## Build, Test, and Development Commands

Use Node.js 22.6 or later and install dependencies with `npm ci`.

- `npm run typecheck` — check TypeScript without emitting files.
- `npm test` — run unit tests using Node's test runner.
- `npm run test:browser` — exercise browser rendering and PDF output.
- `npm run samples` — verify and replace the single sample set at `output/samples/`; `npm run examples` updates the curated documentation PDF/PNG previews.
- `npm run generate -- --input tests/fixtures/english.json --out output/example --answers` — generate a worksheet and separate answers. Omit `--answers` when answers are not needed; use `--html-only` to skip PDF export.

Browser tests and PDF generation require Chrome or Playwright Chromium. Install the latter with `npx playwright install chromium`, or set `STUDY_SHEET_CHROME` to a browser executable.

## Coding Style & Naming Conventions

Use TypeScript ES modules, two-space indentation, single-quoted strings, and semicolons, following nearby code. Keep TypeScript strict and use descriptive camelCase names for functions and variables. Name test files `*.test.ts` and fixtures after their subject or scenario. There is no configured formatter or linter; run the type checker and follow existing conventions.

## Testing Guidelines

For script or template changes, run type checking, unit tests, and browser tests. Add focused `node:test` cases for changed behavior; use browser tests for pagination, print output, answer isolation, or responsive layout. Inspect generated PDFs and screenshots when changing layout. No coverage threshold is configured.

## Commit & Pull Request Guidelines

Git history is unavailable in this checkout, so no established commit convention can be verified. Use concise, imperative commit subjects describing the change. Pull requests should explain the behavior and validation performed, link relevant issues, and include screenshots or sample PDFs for visible layout changes. Do not commit generated output or student data, except the curated synthetic PDF/PNG examples in `docs/examples/` generated from `tests/fixtures/`.
