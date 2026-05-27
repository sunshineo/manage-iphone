import test from "node:test";
import assert from "node:assert/strict";
import { createDeviceService } from "../src/device-service.js";

test("health reports available and missing command dependencies", async () => {
  const service = createDeviceService({
    runCommand: async (command, args) => {
      assert.equal(command, "which");

      if (args[0] === "idevice_id") {
        return { stdout: "/opt/homebrew/bin/idevice_id\n", stderr: "" };
      }

      const error = new Error("not found");
      error.code = 1;
      throw error;
    }
  });

  assert.deepEqual(await service.health(), {
    dependencies: {
      idevice_id: {
        available: true,
        path: "/opt/homebrew/bin/idevice_id"
      },
      ideviceinstaller: {
        available: false,
        path: ""
      }
    },
    installCommand: "brew install libimobiledevice ideviceinstaller"
  });
});

test("getDeviceStatus reports no trusted connected devices", async () => {
  const service = createDeviceService({
    runCommand: async (command, args) => {
      assert.equal(command, "idevice_id");
      assert.deepEqual(args, ["-l"]);
      return { stdout: "\n", stderr: "" };
    }
  });

  assert.deepEqual(await service.getDeviceStatus(), {
    connected: false,
    deviceCount: 0,
    devices: []
  });
});

test("listApps rejects multiple connected devices", async () => {
  const service = createDeviceService({
    runCommand: async () => ({ stdout: "device-one\ndevice-two\n", stderr: "" })
  });

  await assert.rejects(
    () => service.listApps(),
    /Connect exactly one trusted iPhone/
  );
});

test("listApps invokes ideviceinstaller and parses app rows", async () => {
  const calls = [];
  const service = createDeviceService({
    runCommand: async (command, args) => {
      calls.push([command, args]);

      if (command === "idevice_id") {
        return { stdout: "trusted-device\n", stderr: "" };
      }

      assert.equal(command, "ideviceinstaller");
      assert.deepEqual(args, ["-l", "-o", "list_user"]);
      return {
        stdout: "Total: 1 apps\ncom.todoist.ios - Todoist 23.4.1\n",
        stderr: ""
      };
    }
  });

  assert.deepEqual(await service.listApps(), [
    {
      bundleId: "com.todoist.ios",
      name: "Todoist",
      raw: "com.todoist.ios - Todoist 23.4.1",
      version: "23.4.1"
    }
  ]);
  assert.deepEqual(calls, [
    ["idevice_id", ["-l"]],
    ["ideviceinstaller", ["-l", "-o", "list_user"]]
  ]);
});

test("deleteApps uninstalls sequentially and records per-app failures", async () => {
  const calls = [];
  const service = createDeviceService({
    runCommand: async (command, args) => {
      calls.push([command, args]);

      if (command === "idevice_id") {
        return { stdout: "trusted-device\n", stderr: "" };
      }

      if (args[1] === "com.example.fail") {
        const error = new Error("uninstall failed");
        error.stderr = "Application is not uninstallable";
        throw error;
      }

      return { stdout: "Complete\n", stderr: "" };
    }
  });

  assert.deepEqual(
    await service.deleteApps([
      { bundleId: "com.example.ok", name: "Okay" },
      { bundleId: "com.example.fail", name: "Failing App" }
    ]),
    [
      {
        bundleId: "com.example.ok",
        name: "Okay",
        ok: true,
        message: "Uninstalled"
      },
      {
        bundleId: "com.example.fail",
        name: "Failing App",
        ok: false,
        message: "Application is not uninstallable"
      }
    ]
  );

  assert.deepEqual(calls, [
    ["idevice_id", ["-l"]],
    ["ideviceinstaller", ["-U", "com.example.ok"]],
    ["ideviceinstaller", ["-U", "com.example.fail"]]
  ]);
});
