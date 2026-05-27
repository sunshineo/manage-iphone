import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDeleteSelection } from "../src/validation.js";

test("normalizeDeleteSelection accepts app objects and removes duplicate bundle IDs", () => {
  assert.deepEqual(
    normalizeDeleteSelection({
      apps: [
        { bundleId: "com.example.one", name: "One" },
        { bundleId: "com.example.one", name: "One Duplicate" },
        { bundleId: "com.example.two", name: "Two" }
      ]
    }),
    [
      { bundleId: "com.example.one", name: "One" },
      { bundleId: "com.example.two", name: "Two" }
    ]
  );
});

test("normalizeDeleteSelection accepts bundleIds arrays", () => {
  assert.deepEqual(
    normalizeDeleteSelection({ bundleIds: ["com.example.one"] }),
    [{ bundleId: "com.example.one", name: "" }]
  );
});

test("normalizeDeleteSelection rejects empty selection", () => {
  assert.throws(
    () => normalizeDeleteSelection({ apps: [] }),
    /Select at least one app/
  );
});

test("normalizeDeleteSelection rejects invalid bundle IDs", () => {
  assert.throws(
    () => normalizeDeleteSelection({ bundleIds: ["com.example.good", "bad id;rm"] }),
    /Invalid bundle identifier/
  );
});
