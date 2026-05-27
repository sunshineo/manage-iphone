# iPhone App Manager Design

Date: 2026-05-27

## Goal

Build a Mac-local utility for a personal iPhone that lists installed apps and lets the user select multiple user-installed apps for deletion in one batch.

The tool is intended to reduce the friction of manually deleting many rarely used apps on the iPhone. It does not need app last-used data.

## Constraints

- The target is the user's own personal iPhone.
- The tool runs locally on macOS from this repository.
- The iPhone must be connected, unlocked, and trusted by the Mac.
- The tool may require Homebrew-installed iOS device utilities:
  - `libimobiledevice`
  - `ideviceinstaller`
- The tool must not use a cloud service or send device/app data outside the local machine.
- Deleting an app removes that app's local data, matching normal iOS app deletion behavior.
- Protected/system apps may not be removable. Removal failures must be shown clearly rather than hidden.

## Recommended Approach

Create a local web app backed by a small Node/Express server.

This provides a practical selection UI while keeping device operations on the Mac:

- Backend runs shell commands for device detection, app listing, and app deletion.
- Frontend shows a searchable table of apps with checkboxes.
- Delete flow requires explicit selection and confirmation.
- Results show per-app success or failure.

## Alternatives Considered

### Terminal CLI

Fast to build, but selecting many apps from a terminal list is awkward and error-prone. This is a poor fit for the user's main pain point: quickly selecting many apps.

### Native macOS App

Could provide a polished experience, but it adds significant implementation overhead without changing the underlying iPhone management constraints.

### iPhone App

Not viable for this goal. A normal iOS app cannot list and delete other installed apps on the device.

## User Experience

The first screen is the working tool, not a landing page.

Primary states:

- Dependency missing: show which command is unavailable and the Homebrew command needed to install dependencies.
- No device connected: show instructions to connect, unlock, and trust the iPhone.
- Device connected: show app list controls.
- Delete running: disable destructive controls and show progress.
- Delete complete: show success/failure for each selected app and offer to refresh the list.

Main controls:

- Refresh device/app list.
- Search apps by name or bundle identifier.
- Select individual apps with checkboxes.
- Select visible filtered apps.
- Clear selection.
- Delete selected.

## Data Model

The backend normalizes listed apps into:

```json
{
  "name": "Example",
  "bundleId": "com.example.app",
  "version": "1.0",
  "raw": "original command output row"
}
```

Deletion results use:

```json
{
  "bundleId": "com.example.app",
  "name": "Example",
  "ok": true,
  "message": "Uninstalled"
}
```

## Backend Design

Use Node.js with Express.

Endpoints:

- `GET /api/health`
  - Reports availability of required commands.
- `GET /api/device`
  - Reports whether a trusted iPhone is connected.
- `GET /api/apps`
  - Lists installed apps from the connected device.
- `POST /api/delete`
  - Accepts selected bundle IDs and deletes them one at a time.

Command handling:

- Use `child_process.execFile`, not shell string interpolation.
- Treat bundle IDs as opaque arguments.
- Set command timeouts.
- Capture stdout/stderr for failure messages.
- Never log secrets. No credentials are expected.

Likely commands:

- `idevice_id -l` to detect paired devices.
- `ideviceinstaller -l` to list apps.
- `ideviceinstaller -U <bundleId>` to uninstall an app.

If local command output differs from expected parsing, adapt the parser to the installed tool's actual output before enabling deletion.

## Deletion Guardrails

- No app is selected by default.
- The delete button is disabled when selection is empty.
- The confirmation modal lists selected app names and bundle IDs.
- The backend deletes only bundle IDs supplied in the request.
- Deletions run sequentially so the UI can attribute failures to the right app.
- Failures do not abort reporting for other selected apps.
- System/protected app failures are shown as normal failures.
- The UI warns that deleting apps removes local app data.

## Frontend Design

Use a compact dashboard layout:

- Header area with device/dependency status and refresh action.
- Search and selection toolbar.
- Dense app table with stable row height.
- Sticky footer or action bar showing selected count and delete action.
- Confirmation modal for destructive action.
- Results panel after deletion.

The UI should be utilitarian and scan-friendly.

## Testing And Verification

Local verification:

- Unit test app-list parser with realistic sample outputs.
- Unit test delete request validation.
- Run lint/build/test commands.
- Start local server.
- Verify the UI in a browser.

Device verification, when an iPhone is connected:

- Confirm dependency detection.
- Confirm trusted device detection.
- Confirm app list loads.
- Delete only a deliberately selected disposable app first.
- Refresh and confirm the app no longer appears.

## Scope Boundaries

In scope:

- Single connected iPhone.
- Local app listing.
- Multi-select batch deletion.
- Clear per-app results.

Out of scope:

- Last-used app information.
- Cloud sync.
- Device fleet management.
- MDM enrollment.
- App backup or restore.
- Automatic recommendations about what to delete.
