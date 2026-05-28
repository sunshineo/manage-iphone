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
    "CFBundleIdentifier, CFBundleShortVersionString, CFBundleDisplayName",
    "com.duolingo.Duolingo, \"7.21.0\", \"Duolingo\"",
    "com.readwise.iOS, \"1.0\", \"Readwise Reader\""
  ].join("\n");

  assert.deepEqual(parseAppList(output), [
    {
      bundleId: "com.duolingo.Duolingo",
      name: "Duolingo",
      raw: "com.duolingo.Duolingo, \"7.21.0\", \"Duolingo\"",
      version: "7.21.0"
    },
    {
      bundleId: "com.readwise.iOS",
      name: "Readwise Reader",
      raw: "com.readwise.iOS, \"1.0\", \"Readwise Reader\"",
      version: "1.0"
    }
  ]);
});

test("parseAppList parses app and data disk usage attributes", () => {
  const output = [
    "CFBundleIdentifier, CFBundleShortVersionString, CFBundleDisplayName, StaticDiskUsage, DynamicDiskUsage",
    "com.example.large, \"4.2\", \"Large App\", 104857600, 52428800",
    "com.example.unknown, \"1.0\", \"Unknown Size\", , "
  ].join("\n");

  assert.deepEqual(parseAppList(output), [
    {
      bundleId: "com.example.large",
      dynamicDiskUsageBytes: 52428800,
      name: "Large App",
      raw: "com.example.large, \"4.2\", \"Large App\", 104857600, 52428800",
      staticDiskUsageBytes: 104857600,
      storageBytes: 157286400,
      version: "4.2"
    },
    {
      bundleId: "com.example.unknown",
      dynamicDiskUsageBytes: null,
      name: "Unknown Size",
      raw: "com.example.unknown, \"1.0\", \"Unknown Size\", ,",
      staticDiskUsageBytes: null,
      storageBytes: null,
      version: "1.0"
    }
  ]);
});

test("parseAppList sorts apps with storage from largest to smallest", () => {
  const output = [
    "CFBundleIdentifier, CFBundleShortVersionString, CFBundleDisplayName, StaticDiskUsage, DynamicDiskUsage",
    "com.example.small, \"1.0\", \"Alpha Small\", 1000, 2000",
    "com.example.large, \"1.0\", \"Charlie Large\", 10000, 5000",
    "com.example.medium, \"1.0\", \"Bravo Medium\", 4000, 4000"
  ].join("\n");

  assert.deepEqual(
    parseAppList(output).map((app) => app.name),
    ["Charlie Large", "Bravo Medium", "Alpha Small"]
  );
});
