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

test("getDeviceStatus reports missing idevice_id as a dependency error", async () => {
  const service = createDeviceService({
    runCommand: async () => {
      const error = new Error("spawn idevice_id ENOENT");
      error.code = "ENOENT";
      throw error;
    }
  });

  await assert.rejects(
    () => service.getDeviceStatus(),
    (error) =>
      error.status === 424 &&
      error.code === "DEPENDENCY_MISSING" &&
      /idevice_id is not installed/.test(error.message)
  );
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
      assert.deepEqual(args, [
        "list",
        "--user",
        "--attribute",
        "CFBundleIdentifier",
        "--attribute",
        "CFBundleShortVersionString",
        "--attribute",
        "CFBundleDisplayName",
        "--attribute",
        "StaticDiskUsage",
        "--attribute",
        "DynamicDiskUsage"
      ]);
      return {
        stdout: [
          "CFBundleIdentifier, CFBundleShortVersionString, CFBundleDisplayName, StaticDiskUsage, DynamicDiskUsage",
          "com.todoist.ios, \"23.4.1\", \"Todoist\", 1000, 2000"
        ].join("\n"),
        stderr: ""
      };
    },
    metadataClient: noOpMetadataClient()
  });

  assert.deepEqual(await service.listApps(), [
    {
      bundleId: "com.todoist.ios",
      dynamicDiskUsageBytes: 2000,
      name: "Todoist",
      raw: "com.todoist.ios, \"23.4.1\", \"Todoist\", 1000, 2000",
      staticDiskUsageBytes: 1000,
      storageBytes: 3000,
      version: "23.4.1"
    }
  ]);
  assert.deepEqual(calls, [
    ["idevice_id", ["-l"]],
    [
      "ideviceinstaller",
      [
        "list",
        "--user",
        "--attribute",
        "CFBundleIdentifier",
        "--attribute",
        "CFBundleShortVersionString",
        "--attribute",
        "CFBundleDisplayName",
        "--attribute",
        "StaticDiskUsage",
        "--attribute",
        "DynamicDiskUsage"
      ]
    ]
  ]);
});

test("listApps enriches parsed apps with App Store metadata", async () => {
  const service = createDeviceService({
    runCommand: async (command) => {
      if (command === "idevice_id") {
        return { stdout: "trusted-device\n", stderr: "" };
      }

      return {
        stdout: "Total: 1 apps\ncom.todoist.ios - Todoist 23.4.1\n",
        stderr: ""
      };
    },
    metadataClient: {
      enrichApps: async (apps) =>
        apps.map((app) => ({
          ...app,
          purpose: "Capture and organize personal tasks.",
          metadata: {
            source: "appStore",
            found: true,
            appStoreName: "Todoist",
            sellerName: "Doist Inc.",
            genre: "Productivity",
            url: "https://apps.apple.com/us/app/todoist/id1"
          }
        }))
    }
  });

  assert.deepEqual(await service.listApps(), [
    {
      bundleId: "com.todoist.ios",
      name: "Todoist",
      raw: "com.todoist.ios - Todoist 23.4.1",
      version: "23.4.1",
      purpose: "Capture and organize personal tasks.",
      metadata: {
        source: "appStore",
        found: true,
        appStoreName: "Todoist",
        sellerName: "Doist Inc.",
        genre: "Productivity",
        url: "https://apps.apple.com/us/app/todoist/id1"
      }
    }
  ]);
});

test("listApps reports missing ideviceinstaller as a dependency error", async () => {
  const service = createDeviceService({
    runCommand: async (command) => {
      if (command === "idevice_id") {
        return { stdout: "trusted-device\n", stderr: "" };
      }

      const error = new Error("spawn ideviceinstaller ENOENT");
      error.code = "ENOENT";
      throw error;
    },
    metadataClient: noOpMetadataClient()
  });

  await assert.rejects(
    () => service.listApps(),
    (error) =>
      error.status === 424 &&
      error.code === "DEPENDENCY_MISSING" &&
      /ideviceinstaller is not installed/.test(error.message)
  );
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
    },
    metadataClient: noOpMetadataClient()
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
    ["ideviceinstaller", ["uninstall", "com.example.ok"]],
    ["ideviceinstaller", ["uninstall", "com.example.fail"]]
  ]);
});

function noOpMetadataClient() {
  return {
    enrichApps: async (apps) => apps
  };
}
