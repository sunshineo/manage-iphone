import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

test("GET /api/health returns dependency status", async () => {
  const response = await requestWithApp(
    createApp({
      service: {
        health: async () => ({
          dependencies: {
            idevice_id: { available: true, path: "/opt/homebrew/bin/idevice_id" },
            ideviceinstaller: { available: false, path: "" }
          },
          installCommand: "brew install libimobiledevice ideviceinstaller"
        })
      }
    }),
    "/api/health"
  );

  assert.equal(response.status, 200);
  assert.equal(response.body.dependencies.idevice_id.available, true);
  assert.equal(response.body.dependencies.ideviceinstaller.available, false);
});

test("GET /api/device returns connected device state", async () => {
  const response = await requestWithApp(
    createApp({
      service: {
        getDeviceStatus: async () => ({
          connected: false,
          deviceCount: 0,
          devices: []
        })
      }
    }),
    "/api/device"
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, {
    connected: false,
    deviceCount: 0,
    devices: []
  });
});

test("GET /api/apps returns app records", async () => {
  const apps = [{ bundleId: "com.todoist.ios", name: "Todoist", version: "1", raw: "raw" }];
  const response = await requestWithApp(
    createApp({
      service: {
        listApps: async () => apps
      }
    }),
    "/api/apps"
  );

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { apps });
});

test("POST /api/delete validates and returns delete results", async () => {
  const calls = [];
  const response = await requestWithApp(
    createApp({
      service: {
        deleteApps: async (selection) => {
          calls.push(selection);
          return [
            {
              bundleId: "com.todoist.ios",
              name: "Todoist",
              ok: true,
              message: "Uninstalled"
            }
          ];
        }
      }
    }),
    "/api/delete",
    {
      method: "POST",
      body: {
        apps: [{ bundleId: "com.todoist.ios", name: "Todoist" }]
      }
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(calls, [[{ bundleId: "com.todoist.ios", name: "Todoist" }]]);
  assert.deepEqual(response.body, {
    results: [
      {
        bundleId: "com.todoist.ios",
        name: "Todoist",
        ok: true,
        message: "Uninstalled"
      }
    ]
  });
});

test("POST /api/delete returns 400 for invalid selection", async () => {
  const response = await requestWithApp(
    createApp({
      service: {
        deleteApps: async () => {
          throw new Error("service should not be called");
        }
      }
    }),
    "/api/delete",
    {
      method: "POST",
      body: { bundleIds: ["bad id;rm"] }
    }
  );

  assert.equal(response.status, 400);
  assert.equal(response.body.error.code, "VALIDATION_ERROR");
  assert.match(response.body.error.message, /Invalid bundle identifier/);
});

test("GET / serves an HTML app shell", async () => {
  const response = await requestWithApp(
    createApp({ service: {} }),
    "/",
    {
      parseJson: false
    }
  );

  assert.equal(response.status, 200);
  assert.match(response.text, /iPhone App Manager/);
});

test("GET / serves app table headers without the version column", async () => {
  const response = await requestWithApp(
    createApp({ service: {} }),
    "/",
    {
      parseJson: false
    }
  );

  assert.equal(response.status, 200);
  assert.match(response.text, /<th class="app-col">App<\/th>/);
  assert.match(response.text, /<th class="storage-col">Storage<\/th>/);
  assert.doesNotMatch(response.text, /<th[^>]*>Version<\/th>/);
});

test("GET / serves summary and clear control without search controls", async () => {
  const response = await requestWithApp(
    createApp({ service: {} }),
    "/",
    {
      parseJson: false
    }
  );

  assert.equal(response.status, 200);
  assert.match(response.text, /id="appCountSummary"/);
  assert.match(response.text, /id="totalStorageSummary"/);
  assert.match(response.text, /id="clearSelectionButton"/);
  assert.doesNotMatch(response.text, /id="searchInput"/);
  assert.doesNotMatch(response.text, /id="selectVisibleButton"/);
});

async function requestWithApp(app, path, options = {}) {
  const server = app.listen(0);

  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, {
      method: options.method ?? "GET",
      headers: options.body ? { "content-type": "application/json" } : undefined,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
    const text = await response.text();

    return {
      status: response.status,
      text,
      body: options.parseJson === false ? undefined : JSON.parse(text)
    };
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}
