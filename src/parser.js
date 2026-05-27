const BUNDLE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;
const VERSION_PATTERN = /^\d+(?:[.\w-]*\d)?$/;

export function parseAppList(output) {
  if (!output || typeof output !== "string") {
    return [];
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseLine)
    .filter(Boolean)
    .sort(compareApps);
}

function parseLine(line) {
  if (line.startsWith("Total:") || line.startsWith("CFBundleIdentifier")) {
    return null;
  }

  return parseCommaLine(line) ?? parseDashLine(line);
}

function parseCommaLine(line) {
  const parts = line.split(",").map((part) => part.trim());

  if (parts.length < 3 || !isBundleId(parts[0])) {
    return null;
  }

  const [bundleId, version, ...nameParts] = parts;
  const name = nameParts.join(", ").trim() || bundleId;

  return {
    bundleId,
    name,
    raw: line,
    version: version.trim()
  };
}

function parseDashLine(line) {
  const separator = " - ";
  const separatorIndex = line.indexOf(separator);

  if (separatorIndex < 1) {
    return null;
  }

  const bundleId = line.slice(0, separatorIndex).trim();
  const remainder = line.slice(separatorIndex + separator.length).trim();

  if (!isBundleId(bundleId) || !remainder) {
    return null;
  }

  const { name, version } = splitNameAndVersion(remainder);

  return {
    bundleId,
    name: name || bundleId,
    raw: line,
    version
  };
}

function splitNameAndVersion(value) {
  const tokens = value.split(/\s+/);
  const possibleVersion = tokens.at(-1) ?? "";

  if (tokens.length > 1 && VERSION_PATTERN.test(possibleVersion)) {
    return {
      name: tokens.slice(0, -1).join(" ").trim(),
      version: possibleVersion
    };
  }

  return {
    name: value.trim(),
    version: ""
  };
}

function compareApps(left, right) {
  return (
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
    left.bundleId.localeCompare(right.bundleId, undefined, { sensitivity: "base" })
  );
}

function isBundleId(value) {
  return BUNDLE_ID_PATTERN.test(value);
}
