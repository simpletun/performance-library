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
  run-mode.js            — parses process.argv[3] run-mode flags; populates runModeFlags Map
  math.js                — statistical utilities (mean, variance, std dev, percentiles)
  cache.js               — TTL cache factory (time-based key expiry)
  cached-function.js     — memoization wrapper built on cache.js
  constants.js           — shared constants (TTL default)
  outputs/               — pluggable result formatters (csv, json, newrelic, influxdb, stdout)
  providers/             — built-in worker types (file-data-provider, mysql-data-provider)
  transports/            — Winston logger transport for cluster
  utils/                 — shared utilities (makeRequest, HTTP client, linereader, sleep, rampup…)
test/
  *.test.cjs             — Mocha unit tests (CommonJS; kept as .cjs due to Module.prototype.require mocking)
```

There is no `build/` directory. The library publishes `src/` directly as native ESM.

## Tech stack

| Tool | Purpose |
|------|---------|
| Node.js ≥18 | Runtime |
| Mocha v10 | Test runner |
| c8 | Coverage (uses V8 native coverage; supports ESM) |
| ESLint v9 | Linting |
| Winston | Structured logging |
| mysql | MySQL connection pooling |
| ws | WebSocket support |
| @opentelemetry/api | Tracing hooks |

## Essential commands

```bash
npm install          # install dependencies
npm test             # run unit tests with Mocha
npm run coverage     # run tests + generate HTML coverage report in coverage/
npm run lint         # ESLint HTML report → reports/eslint.html
npm run jsdoc        # generate API docs → docs/
npm run clean        # delete reports/, docs/, coverage/
npm publish          # runs npm test first (prepublishOnly), then publishes
```

## Coding conventions

- **Native ESM** throughout `src/` (`import`/`export`). Do not use `require()` in `src/`.
- All intra-package imports must include the `.js` extension (required by ESM): `import { foo } from './utils/foo.js'`.
- **Indentation**: tabs (enforced by `.editorconfig` and `.eslintrc`).
- **Quotes**: single quotes; **semicolons**: required.
- **No unused variables** (`no-unused-vars` is an ESLint error).
- Keep `src/index.js` updated whenever you add a new public export.
- Output formatters live in `src/outputs/` and must implement a writable stream interface (see existing formatters for the pattern).
- Data providers live in `src/providers/` and extend the worker base class.

## Architecture notes

**Master process** (`src/master.js`):
- Reads the consumer project's scenario file via top-level `await import(...)` — this is intentionally async so config is fully loaded before workers are forked.
- Uses `process.argv[1]` (the consumer entry point path) to resolve the `scenarios/` directory at runtime.
- Forks worker and provider processes via `cluster.fork()`.
- Pipes aggregated `Result` objects from workers through the selected output stream.
- Handles IPC messaging patterns: broadcast, round-robin, and direct worker addressing.

**Worker process** (`src/worker.js`):
- Loaded by consumers' entry point when `cluster.isWorker` is true.
- Dynamically loads the consumer's worker type via `await import(...)` on the `init` IPC message.
- Exposes `config`, `onMessage(event, handler)`, `sendMessage(event, data)`, `shutdown()`.
- Consumers write custom workers that import utilities from this library (`makeRequest`, `sleep`, etc.).

**Package exports** (`package.json` `exports` field):
- `.` → `src/index.js` — all utility imports
- `./master` → `src/master.js` — consumer entry point (master side)
- `./worker` → `src/worker.js` — consumer entry point (worker side)

Deep imports into `src/` outside these three paths are blocked by the exports map.

**Run-mode flags** (`src/run-mode.js`):
- Parses `process.argv[3]` (a comma-separated string like `output:influxdb,log:debug,signalfx`) into the `runModeFlags` Map.
- Called once by the master process at startup; the populated Map is then read by output selection logic and utilities (e.g., `makeRequest` checks `runModeFlags.has('signalfx')` to decide whether to start an OpenTelemetry span).
- Exports `runModeFlags` (the Map), `parseRunMode()` (the parser), and `whenRunModeLoaded(callback)` (deferred callback for code that runs before `parseRunMode` is called).
- The `log` flag sets Winston's log level at parse time.

**Data flow**: Master → `start` IPC → Worker → HTTP requests via `makeRequest` → `Result` IPC → Master → Output stream.

## Testing

- Tests live in `test/` as `.cjs` files and run with Mocha (config in `.mocharc.json`).
- Tests are `.cjs` (not `.js`) because some use `Module.prototype.require` patching for mocking, which is CJS-only. Do not convert them to ESM without replacing the mocking strategy.
- Unit tests cover: `math.js`, `makeRequest`, low-level `request` (HTTP client), `master.js`, MySQL utilities, `linereader`, `sleep`.
- Run `npm run coverage` to see coverage gaps before adding new code paths.
- There are no integration tests that require a live server or database — keep new tests unit-scoped or mock external dependencies.

## Making changes

1. Edit source in `src/` only.
2. Run `npm test` to confirm nothing is broken.
3. If adding a new public utility, export it from `src/index.js` and include the `.js` extension on the import path.
4. If adding a new output format, create `src/outputs/<name>.js` following the writable-stream pattern used by existing formatters.
5. If adding a new built-in provider, create `src/providers/<name>.js` extending the worker base.

## File-reading pipeline

File data is read in a dedicated provider worker process and served to load-testing workers over IPC. Three components form the pipeline:

**`src/utils/linereader.js` — stream abstraction**
`LineReader` wraps `createReadStream` behind an async `nextLine(randomLine?)` API. It manages a state machine (`opening → readable → closing → closed`), buffers lines in a `lineArray`, handles partial lines across chunk boundaries, and can recycle the stream from the top on EOF when `recycleOnEof: true`. Returns `{ nextLine, eof }`.

**`src/providers/file-data-provider.js` — provider worker**
Runs as a cluster worker process (never imported directly by load workers). On start it creates one `LineReader` from worker config (`fileName`, `chunkSize`, `recycleOnEof`, `bufferSize`). It listens for `fileRead` IPC messages and calls `linereader.nextLine()` on each request, then:
- On success: sends a `direct` IPC response to the requesting worker's PID, typed with the `responseType` and `requestId` from the request.
- On EOF (no recycle): sends an `eof` message to the requester, which triggers `shutdown()`.

**`src/utils/fileReadMessenger.js` — consumer-side API**
`FileReadMessenger` is what load-testing workers instantiate. Its `async getLine(random?)` method hides the full IPC handshake: it generates a unique `requestId`, stores a deferred `Promise` in a `Map`, sends a `fileRead` message to the provider worker group via round-robin, then awaits the deferred promise. The constructor registers a listener on `responseType` that resolves the matching promise by `requestId` when the response arrives.

**Message flow:**
```
Load worker                     file-data-provider worker
    │  getLine()                                │
    │── fileRead {requestId, responseType, from}─▶│
    │                              linereader.nextLine()
    │◀── {type: responseType, results, requestId}──│
    │  deferred promise resolves, line returned  │
```

The `responseType` string must be unique per worker/messenger pair — it is the IPC event name that routes responses back to the correct instance. The `workerGroup` parameter on `FileReadMessenger` controls which provider worker group (and therefore which file) receives the requests.

## Environment variables

See `.env.example` for InfluxDB integration variables. No environment variables are required for local development or testing.
