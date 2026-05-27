# iPhone App Manager

Mac-local utility for listing user-installed apps on a trusted personal iPhone and deleting selected apps in a batch.

The tool runs only on your Mac. It does not send app or device data to a cloud service.

## Requirements

- macOS with Homebrew
- Node.js 22 or newer
- A personal iPhone connected by USB, unlocked, and trusted by this Mac
- iOS device command-line tools:

```bash
brew install libimobiledevice ideviceinstaller
```

## Install

```bash
npm install
```

## Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000).

## Use

1. Connect the iPhone to the Mac.
2. Unlock the iPhone.
3. Tap Trust on the iPhone if prompted.
4. Click Refresh in the web app.
5. Search or scan the app list.
6. Select apps with the checkboxes.
7. Click Delete Selected.
8. Review the confirmation list.
9. Click Delete Apps.

Deleting an app removes that app and its local app data from the iPhone, the same as deleting the app manually on iOS.

## Troubleshooting

Missing dependencies:

```bash
brew install libimobiledevice ideviceinstaller
```

No device detected:

- Reconnect the iPhone by USB.
- Unlock the iPhone.
- Confirm the Trust prompt on the iPhone.
- Run `idevice_id -l` to check whether the Mac sees a trusted device.

Multiple devices detected:

- Disconnect extra iPhones or iPads.
- Refresh after exactly one trusted iPhone is connected.

An app fails to delete:

- Some system or protected apps may not be removable through this tool.
- The result list shows the command error reported by the local device tool.
- You can still delete remaining apps manually on the phone if iOS blocks command-line uninstall.

## Verification

Run automated checks:

```bash
npm test
npm run check
```

The automated tests mock all iPhone command execution. They do not delete real apps.
