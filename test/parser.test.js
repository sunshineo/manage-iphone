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
