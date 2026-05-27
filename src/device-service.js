import { runCommand as defaultRunCommand } from "./command-runner.js";
import { DeviceStateError } from "./errors.js";
import { parseAppList } from "./parser.js";
import { normalizeDeleteSelection } from "./validation.js";

const REQUIRED_COMMANDS = ["idevice_id", "ideviceinstaller"];
const INSTALL_COMMAND = "brew install libimobiledevice ideviceinstaller";

export function createDeviceService({ runCommand = defaultRunCommand } = {}) {
  async function health() {
    const entries = await Promise.all(
      REQUIRED_COMMANDS.map(async (command) => {
        try {
          const result = await runCommand("which", [command], { timeout: 5000 });
          return [
            command,
            {
              available: true,
              path: result.stdout.trim()
            }
          ];
        } catch {
          return [
            command,
            {
              available: false,
              path: ""
            }
          ];
        }
      })
    );

    return {
      dependencies: Object.fromEntries(entries),
      installCommand: INSTALL_COMMAND
    };
  }

  async function getDeviceStatus() {
    const { stdout } = await runCommand("idevice_id", ["-l"], { timeout: 10000 });
    const devices = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    return {
      connected: devices.length === 1,
      deviceCount: devices.length,
      devices
    };
  }

  async function requireSingleDevice() {
    const status = await getDeviceStatus();

    if (!status.connected) {
      throw new DeviceStateError(
        "Connect exactly one trusted iPhone, then refresh.",
        {
          details: status
        }
      );
    }

    return status.devices[0];
  }

  async function listApps() {
    await requireSingleDevice();
    const { stdout } = await runCommand("ideviceinstaller", ["-l", "-o", "list_user"], {
      timeout: 30000
    });

    return parseAppList(stdout);
  }

  async function deleteApps(selection) {
    const apps = normalizeDeleteSelection({ apps: selection });
    await requireSingleDevice();
    const results = [];

    for (const app of apps) {
      try {
        await runCommand("ideviceinstaller", ["-U", app.bundleId], { timeout: 60000 });
        results.push({
          bundleId: app.bundleId,
          name: app.name,
          ok: true,
          message: "Uninstalled"
        });
      } catch (error) {
        results.push({
          bundleId: app.bundleId,
          name: app.name,
          ok: false,
          message: commandErrorMessage(error)
        });
      }
    }

    return results;
  }

  return {
    health,
    getDeviceStatus,
    listApps,
    deleteApps
  };
}

function commandErrorMessage(error) {
  const stderr = String(error?.stderr ?? "").trim();
  const stdout = String(error?.stdout ?? "").trim();
  const message = String(error?.message ?? "").trim();

  return stderr || stdout || message || "Command failed";
}
