# iPhone App Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Mac-local web utility that lists user-installed iPhone apps and batch-uninstalls selected apps with explicit confirmation.

**Architecture:** A Node.js Express server owns all device command execution and exposes a small JSON API. A vanilla browser UI calls that API, handles filtering/selection, and shows deletion progress/results. Command parsing, request validation, and device operations are split into focused modules with Node test coverage.

**Tech Stack:** Node.js 22 ESM, Express, built-in `node:test`, vanilla HTML/CSS/JavaScript, Homebrew-installed `libimobiledevice` and `ideviceinstaller` at runtime.

---

## File Structure

- Create `package.json`: npm scripts and Express dependency.
- Create `.gitignore`: ignore generated dependency directories and macOS metadata.
- Create `src/errors.js`: small HTTP-aware error classes.
- Create `src/parser.js`: parse `ideviceinstaller -l -o list_user` output into normalized app records.
- Create `src/validation.js`: validate delete request payloads and normalize bundle IDs.
- Create `src/command-runner.js`: safe `execFile` wrapper with timeouts.
- Create `src/device-service.js`: dependency checks, device detection, app listing, and sequential uninstall operations.
- Create `src/app.js`: Express app factory and API route handlers.
- Create `src/server.js`: local server entrypoint.
- Create `public/index.html`: working app UI.
- Create `public/styles.css`: compact, scan-friendly interface styling.
- Create `public/ui-state.js`: pure frontend filtering/selection helpers.
- Create `public/app.js`: browser API calls and DOM updates.
- Create `test/parser.test.js`: parser coverage for realistic app list formats.
- Create `test/validation.test.js`: delete request validation coverage.
- Create `test/device-service.test.js`: command orchestration coverage with injected command runner.
- Create `test/api.test.js`: API route coverage with injected service.
- Create `test/ui-state.test.js`: frontend pure helper coverage.
- Create `README.md`: setup, run, and safety instructions.

## Task Status

- [x] Task 1: Project scaffold and initial failing tests. Status: completed.
- [x] Task 2: Parser and validation implementation. Status: completed.
- [x] Task 3: Device service implementation. Status: completed.
- [ ] Task 4: Express API implementation.
- [ ] Task 5: Frontend UI implementation.
- [ ] Task 6: Documentation, verification, and local server.

## Tasks

### Task 1: Project Scaffold And Initial Failing Tests

**Files:**
- Create: `package.json`
- Create: `test/parser.test.js`
- Create: `test/validation.test.js`
- Create: `test/ui-state.test.js`

- [x] **Step 1: Create package metadata**

Create `package.json`:

```json
{
  "name": "manage-iphone",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node src/server.js",
    "test": "node --test",
    "check": "node --check src/*.js public/*.js"
  },
  "dependencies": {
    "express": "^4.19.2"
  }
}
```

- [x] **Step 2: Write failing parser tests**

Create `test/parser.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseAppList } from "../src/parser.js";

test("parseAppList parses dash-formatted ideviceinstaller rows", () => {
  const output = [
    "Total: 2 apps",
    "com.todoist.ios - Todoist 23.4.1",
    "com.example.dashy - Name With - Dash 1.2.3"
  ].join("\n");

  assert.deepEqual(parseAppList(output), [
    {
      bundleId: "com.example.dashy",
      name: "Name With - Dash",
      raw: "com.example.dashy - Name With - Dash 1.2.3",
      version: "1.2.3"
    },
    {
      bundleId: "com.todoist.ios",
      name: "Todoist",
      raw: "com.todoist.ios - Todoist 23.4.1",
      version: "23.4.1"
    }
  ]);
});

test("parseAppList parses comma-formatted ideviceinstaller rows", () => {
  const output = [
    "CFBundleIdentifier, CFBundleVersion, CFBundleDisplayName",
    "com.duolingo.Duolingo, 7.21.0, Duolingo",
    "com.readwise.iOS, 1.0, Readwise Reader"
  ].join("\n");

  assert.deepEqual(parseAppList(output), [
    {
      bundleId: "com.duolingo.Duolingo",
      name: "Duolingo",
      raw: "com.duolingo.Duolingo, 7.21.0, Duolingo",
      version: "7.21.0"
    },
    {
      bundleId: "com.readwise.iOS",
      name: "Readwise Reader",
      raw: "com.readwise.iOS, 1.0, Readwise Reader",
      version: "1.0"
    }
  ]);
});
```

- [x] **Step 3: Write failing validation tests**

Create `test/validation.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDeleteSelection } from "../src/validation.js";

test("normalizeDeleteSelection accepts app objects and removes duplicate bundle IDs", () => {
  assert.deepEqual(
    normalizeDeleteSelection({
      apps: [
        { bundleId: "com.example.one", name: "One" },
        { bundleId: "com.example.one", name: "One Duplicate" },
        { bundleId: "com.example.two", name: "Two" }
      ]
    }),
    [
      { bundleId: "com.example.one", name: "One" },
      { bundleId: "com.example.two", name: "Two" }
    ]
  );
});

test("normalizeDeleteSelection accepts bundleIds arrays", () => {
  assert.deepEqual(
    normalizeDeleteSelection({ bundleIds: ["com.example.one"] }),
    [{ bundleId: "com.example.one", name: "" }]
  );
});

test("normalizeDeleteSelection rejects empty selection", () => {
  assert.throws(
    () => normalizeDeleteSelection({ apps: [] }),
    /Select at least one app/
  );
});

test("normalizeDeleteSelection rejects invalid bundle IDs", () => {
  assert.throws(
    () => normalizeDeleteSelection({ bundleIds: ["com.example.good", "bad id;rm"] }),
    /Invalid bundle identifier/
  );
});
```

- [x] **Step 4: Write failing frontend helper tests**

Create `test/ui-state.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { filterApps, nextSelection } from "../public/ui-state.js";

const apps = [
  { bundleId: "com.todoist.ios", name: "Todoist", version: "1" },
  { bundleId: "com.readwise.iOS", name: "Readwise Reader", version: "2" }
];

test("filterApps matches app names and bundle identifiers case-insensitively", () => {
  assert.deepEqual(filterApps(apps, "READ"), [apps[1]]);
  assert.deepEqual(filterApps(apps, "todoist"), [apps[0]]);
  assert.deepEqual(filterApps(apps, ""), apps);
});

test("nextSelection toggles a bundle ID without mutating the original set", () => {
  const selected = new Set(["com.todoist.ios"]);
  const removed = nextSelection(selected, "com.todoist.ios", false);
  const added = nextSelection(selected, "com.readwise.iOS", true);

  assert.deepEqual([...removed], []);
  assert.deepEqual([...added].sort(), ["com.readwise.iOS", "com.todoist.ios"]);
  assert.deepEqual([...selected], ["com.todoist.ios"]);
});
```

- [x] **Step 5: Install dependencies and verify tests fail for missing modules**

Run:

```bash
npm install
npm test
```

Expected: `npm test` fails because `src/parser.js`, `src/validation.js`, and `public/ui-state.js` do not exist yet.

Evidence: `npm install` completed with 68 packages added and 0 vulnerabilities. `npm test` exited 1 with expected `ERR_MODULE_NOT_FOUND` failures for `src/parser.js`, `src/validation.js`, and `public/ui-state.js`.

### Task 2: Parser And Validation Implementation

**Files:**
- Create: `src/errors.js`
- Create: `src/parser.js`
- Create: `src/validation.js`
- Create: `public/ui-state.js`
- Test: `test/parser.test.js`
- Test: `test/validation.test.js`
- Test: `test/ui-state.test.js`

- [x] **Step 1: Implement HTTP-aware validation error**

Create `src/errors.js` with `AppError`, `ValidationError`, and `DeviceStateError`.

- [x] **Step 2: Implement app list parsing**

Create `src/parser.js` with:

- `parseAppList(output)`
- dash row parser for `bundle.id - App Name 1.2.3`
- comma row parser for `bundle.id, 1.2.3, App Name`
- sorting by app display name, then bundle ID

- [x] **Step 3: Implement delete payload validation**

Create `src/validation.js` with `normalizeDeleteSelection(payload)`.

Validation rules:

- Accept `{ apps: [{ bundleId, name }] }` and `{ bundleIds: ["bundle.id"] }`.
- Trim bundle IDs and names.
- Reject empty selections.
- Reject IDs that fail `/^[A-Za-z0-9][A-Za-z0-9.-]*$/`.
- Deduplicate by bundle ID while preserving first name.

- [x] **Step 4: Implement frontend pure state helpers**

Create `public/ui-state.js` with:

- `filterApps(apps, query)`
- `nextSelection(selectedSet, bundleId, checked)`

- [x] **Step 5: Run focused tests**

Run:

```bash
npm test -- test/parser.test.js test/validation.test.js test/ui-state.test.js
```

Expected: all focused tests pass.

Evidence: `npm test -- test/parser.test.js test/validation.test.js test/ui-state.test.js` exited 0 with 8 tests passing and 0 failures.

### Task 3: Device Service Implementation

**Files:**
- Create: `src/command-runner.js`
- Create: `src/device-service.js`
- Create: `test/device-service.test.js`

- [x] **Step 1: Write failing device service tests**

Create `test/device-service.test.js` covering:

- dependency health reports available and missing commands;
- no connected devices returns `connected: false`;
- multiple connected devices blocks app listing;
- list apps calls `ideviceinstaller -l -o list_user` and parses output;
- delete apps calls `ideviceinstaller -U <bundleId>` sequentially and records per-app failures.

- [x] **Step 2: Run device service tests to verify red state**

Run:

```bash
npm test -- test/device-service.test.js
```

Expected: fails because `src/device-service.js` and `src/command-runner.js` do not exist.

- [x] **Step 3: Implement safe command runner**

Create `src/command-runner.js`:

- use `child_process.execFile`;
- default timeout `15000`;
- resolve `{ stdout, stderr }`;
- reject with `code`, `stdout`, and `stderr` copied to the error.

- [x] **Step 4: Implement device service factory**

Create `src/device-service.js` with `createDeviceService({ runCommand })`.

Methods:

- `health()`;
- `getDeviceStatus()`;
- `listApps()`;
- `deleteApps(selection)`.

- [x] **Step 5: Run device service tests**

Run:

```bash
npm test -- test/device-service.test.js
```

Expected: all device service tests pass.

Evidence: first `npm test -- test/device-service.test.js` exited 1 with expected `ERR_MODULE_NOT_FOUND` for `src/device-service.js`. After implementation, the same command exited 0 with 5 tests passing and 0 failures.

### Task 4: Express API Implementation

**Files:**
- Create: `src/app.js`
- Create: `src/server.js`
- Create: `test/api.test.js`

- [ ] **Step 1: Write failing API tests**

Create `test/api.test.js` with an in-process HTTP server and injected fake service. Cover:

- `GET /api/health`;
- `GET /api/device`;
- `GET /api/apps`;
- `POST /api/delete`;
- validation failure from `POST /api/delete`;
- static app serving for `/`.

- [ ] **Step 2: Run API tests to verify red state**

Run:

```bash
npm test -- test/api.test.js
```

Expected: fails because `src/app.js` does not exist.

- [ ] **Step 3: Implement Express app factory**

Create `src/app.js` with `createApp({ service })`.

Route behavior:

- JSON body parsing.
- Static file serving from `public`.
- Route handlers return JSON.
- Error middleware maps `AppError.status` to HTTP status and defaults to `500`.

- [ ] **Step 4: Implement server entrypoint**

Create `src/server.js`:

- create real device service;
- listen on `process.env.PORT || 3000`;
- print local URL.

- [ ] **Step 5: Run API tests**

Run:

```bash
npm test -- test/api.test.js
```

Expected: all API tests pass.

### Task 5: Frontend UI Implementation

**Files:**
- Create: `public/index.html`
- Create: `public/styles.css`
- Create: `public/app.js`
- Modify: `public/ui-state.js` only if UI helper coverage requires it.

- [ ] **Step 1: Create app shell**

Create `public/index.html` with:

- dependency/device status region;
- refresh button;
- search input;
- select visible and clear selection buttons;
- app table;
- selected count action bar;
- delete confirmation dialog;
- result panel.

- [ ] **Step 2: Create compact styles**

Create `public/styles.css` with:

- stable table row height;
- responsive layout;
- clear destructive button styling;
- modal styling;
- status badges for success, warning, and error states.

- [ ] **Step 3: Implement browser behavior**

Create `public/app.js`:

- fetch health/device/apps on load;
- render dependency and device states;
- render searchable app table;
- track selection with a `Set`;
- open confirmation dialog with selected apps;
- send `POST /api/delete` with selected `{ bundleId, name }` objects;
- render per-app results;
- refresh app list after deletion only when the user clicks refresh.

- [ ] **Step 4: Run syntax and helper tests**

Run:

```bash
npm run check
npm test -- test/ui-state.test.js
```

Expected: syntax check and UI helper tests pass.

### Task 6: Documentation, Verification, And Local Server

**Files:**
- Create: `README.md`
- Modify: `docs/superpowers/plans/2026-05-27-iphone-app-manager.md`

- [ ] **Step 1: Write README**

Create `README.md` with:

- install prerequisites;
- dependency install command;
- how to connect and trust the iPhone;
- how to run the local server;
- deletion warning;
- troubleshooting for missing tools and no device.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run check
```

Expected: all tests and syntax checks pass.

- [ ] **Step 3: Start local server**

Run:

```bash
npm start
```

Expected: server listens on `http://localhost:3000`.

- [ ] **Step 4: Verify UI in browser**

Open `http://localhost:3000` and verify:

- dependency status renders;
- no connected phone state renders when no iPhone is present;
- table/search controls render without overlapping text;
- delete button is disabled while no app is selected.

- [ ] **Step 5: Record evidence in this plan**

Update this plan with:

- files changed;
- verification commands and results;
- local server URL;
- known limitation that no real phone deletion was exercised unless a trusted iPhone was connected.
