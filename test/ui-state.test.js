import test from "node:test";
import assert from "node:assert/strict";
import { filterApps, nextSelection } from "../public/ui-state.js";

const apps = [
  {
    bundleId: "com.todoist.ios",
    name: "Todoist",
    purpose: "Capture and organize personal tasks.",
    version: "1"
  },
  {
    bundleId: "com.readwise.iOS",
    name: "Readwise Reader",
    purpose: "Read articles and newsletters later.",
    version: "2"
  }
];

test("filterApps matches app names and bundle identifiers case-insensitively", () => {
  assert.deepEqual(filterApps(apps, "READ"), [apps[1]]);
  assert.deepEqual(filterApps(apps, "todoist"), [apps[0]]);
  assert.deepEqual(filterApps(apps, "tasks"), [apps[0]]);
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
