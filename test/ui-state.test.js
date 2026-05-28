import test from "node:test";
import assert from "node:assert/strict";
import { appStorageSummary, formatStorageSize, nextSelection } from "../public/ui-state.js";

test("nextSelection toggles a bundle ID without mutating the original set", () => {
  const selected = new Set(["com.todoist.ios"]);
  const removed = nextSelection(selected, "com.todoist.ios", false);
  const added = nextSelection(selected, "com.readwise.iOS", true);

  assert.deepEqual([...removed], []);
  assert.deepEqual([...added].sort(), ["com.readwise.iOS", "com.todoist.ios"]);
  assert.deepEqual([...selected], ["com.todoist.ios"]);
});

test("formatStorageSize displays byte counts with readable units", () => {
  assert.equal(formatStorageSize(0), "0 B");
  assert.equal(formatStorageSize(512), "512 B");
  assert.equal(formatStorageSize(1536), "1.5 KB");
  assert.equal(formatStorageSize(157286400), "150 MB");
  assert.equal(formatStorageSize(null), "-");
});

test("appStorageSummary counts apps and sums known storage bytes", () => {
  assert.deepEqual(
    appStorageSummary([
      { name: "Large", storageBytes: 1000 },
      { name: "Unknown", storageBytes: null },
      { name: "Small", storageBytes: 250 }
    ]),
    {
      appCount: 3,
      totalStorageBytes: 1250
    }
  );
});
