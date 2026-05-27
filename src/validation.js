import { ValidationError } from "./errors.js";

const BUNDLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;

export function normalizeDeleteSelection(payload) {
  const rawItems = Array.isArray(payload?.apps)
    ? payload.apps.map((app) => ({
        bundleId: app?.bundleId,
        name: app?.name
      }))
    : Array.isArray(payload?.bundleIds)
      ? payload.bundleIds.map((bundleId) => ({ bundleId, name: "" }))
      : [];

  if (rawItems.length === 0) {
    throw new ValidationError("Select at least one app before deleting.");
  }

  const normalized = [];
  const seen = new Set();

  for (const item of rawItems) {
    const bundleId = String(item.bundleId ?? "").trim();
    const name = String(item.name ?? "").trim();

    if (!BUNDLE_ID_PATTERN.test(bundleId)) {
      throw new ValidationError(`Invalid bundle identifier: ${bundleId || "(empty)"}`);
    }

    if (!seen.has(bundleId)) {
      normalized.push({ bundleId, name });
      seen.add(bundleId);
    }
  }

  if (normalized.length === 0) {
    throw new ValidationError("Select at least one app before deleting.");
  }

  return normalized;
}
