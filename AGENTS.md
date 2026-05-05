# AGENTS.md — cluster-load-runner

## Project overview

`cluster-load-runner` (v3.0.2) is a Node.js library for building distributed HTTP performance testing frameworks. It uses the Node.js `cluster` module to coordinate a master process that orchestrates multiple worker processes, aggregates timing metrics, and emits results to pluggable output streams (CSV, JSON, NewRelic, InfluxDB, stdout).

Consumers install this library and build their own scenario files, custom workers, and entry points on top of it. This repo is the library itself, not a runnable test framework.

## Repository layout

```
src/
  index.js               — public API exports (all consumer-facing symbols)
  master.js              — master process: spawns workers, aggregates results
  worker.js              — worker base class: lifecycle, messaging
  math.js                — statistical utilities (mean, variance, std dev, percentiles)
  outputs/               — pluggable result formatters (csv, json, newrelic, stdout, influxdb)
  providers/             — built-in worker types (file-data-provider, mysql-data-provider)
  transports/            — Winston logger transport for cluster
  utils/                 — shared utilities (makeRequest, HTTP client, linereader, sleep, rampup…)
test/
  *.test.js              — Mocha unit tests
  babel.js               — Babel register for test transpilation
  mocha.opts             — Mocha configuration
scripts/
  npm-publish-beta.js    — beta release helper
build/                   — Babel output (generated; do not edit)
```

## Tech stack

| Tool | Purpose |
|------|---------|
| Node.js ≥18 | Runtime |
| Babel | Transpiles `src/` (ES modules) → `build/` (CommonJS) |
| Mocha v10 | Test runner |
| NYC/Istanbul | Coverage |
| ESLint v9 | Linting |
| Winston | Structured logging |
| mysql | MySQL connection pooling |
| ws | WebSocket support |
| @opentelemetry/api | Tracing hooks |

## Essential commands

```bash
npm install          # install dependencies
npm run build        # transpile src/ → build/  (runs automatically on publish)
npm test             # run unit tests with Mocha
npm run coverage     # run tests + generate HTML coverage report in coverage/
npm run lint         # ESLint HTML report → reports/eslint.html
npm run jsdoc        # generate API docs → docs/
npm run clean        # delete reports/, docs/, build/, coverage/
```

## Coding conventions

- **ES6+ modules** in `src/` (`import`/`export`). Babel handles transpilation — do not write CommonJS in `src/`.
- **Indentation**: tabs (enforced by `.editorconfig` and `.eslintrc`).
- **Quotes**: single quotes; **semicolons**: required.
- **No unused variables** (`no-unused-vars` is an ESLint error).
- Keep `src/index.js` updated whenever you add a new public export.
- Output formatters live in `src/outputs/` and must implement a writable stream interface (see existing formatters for the pattern).
- Data providers live in `src/providers/` and extend the worker base class.

## Architecture notes

**Master process** (`src/master.js`):
- Reads scenario config from the consumer project's `scenarios/` directory.
- Forks worker and provider processes via `cluster.fork()`.
- Pipes aggregated `Result` objects from workers through the selected output stream.
- Handles IPC messaging patterns: broadcast, round-robin, and direct worker addressing.

**Worker process** (`src/worker.js`):
- Loaded by consumers' entry point when `cluster.isWorker` is true.
- Exposes `config`, `onMessage(event, handler)`, `sendMessage(event, data)`, `shutdown()`.
- Consumers write custom workers that import utilities from this library (`makeRequest`, `sleep`, etc.).

**Data flow**: Master → `start` IPC → Worker → HTTP requests via `makeRequest` → `Result` IPC → Master → Output stream.

## Testing

- Tests live in `test/` and are run with Mocha (config in `test/mocha.opts`).
- Babel transpilation for tests is handled by `test/babel.js` (required by Mocha).
- Unit tests cover: `math.js`, HTTP request utilities, MySQL utilities, `linereader`, `sleep`.
- Run `npm run coverage` to see coverage gaps before adding new code paths.
- There are no integration tests that require a live server or database — keep new tests unit-scoped or mock external dependencies.

## Making changes

1. Edit source in `src/` only — never edit `build/` directly.
2. Run `npm run build` after changes to verify Babel compiles without errors.
3. Run `npm test` to confirm nothing is broken.
4. If adding a new public utility, export it from `src/index.js`.
5. If adding a new output format, create `src/outputs/<name>.js` following the writable-stream pattern used by existing formatters.
6. If adding a new built-in provider, create `src/providers/<name>.js` extending the worker base.

## Environment variables

See `.env.example` for InfluxDB integration variables. No environment variables are required for local development or testing.
