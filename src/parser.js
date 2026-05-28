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
  const parts = parseCsvFields(line);

  if (parts.length < 3 || !isBundleId(parts[0])) {
    return null;
  }

  const [bundleId, version, nameField, staticDiskUsage, dynamicDiskUsage] = parts;
  const name = stripCsvQuotes(nameField).trim() || bundleId;
  const app = {
    bundleId,
    name,
    raw: line,
    version: stripCsvQuotes(version.trim())
  };

  if (parts.length >= 5) {
    const staticDiskUsageBytes = parseDiskUsageBytes(staticDiskUsage);
    const dynamicDiskUsageBytes = parseDiskUsageBytes(dynamicDiskUsage);

    return {
      ...app,
      dynamicDiskUsageBytes,
      staticDiskUsageBytes,
      storageBytes: sumDiskUsageBytes(staticDiskUsageBytes, dynamicDiskUsageBytes)
    };
  }

  return app;
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
  const leftStorage = sortableStorageBytes(left);
  const rightStorage = sortableStorageBytes(right);

  if (leftStorage !== rightStorage) {
    return rightStorage - leftStorage;
  }

  return (
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }) ||
    left.bundleId.localeCompare(right.bundleId, undefined, { sensitivity: "base" })
  );
}

function sortableStorageBytes(app) {
  return Number.isFinite(app.storageBytes) ? app.storageBytes : -1;
}

function isBundleId(value) {
  return BUNDLE_ID_PATTERN.test(value);
}

function parseCsvFields(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current.trim());
  return fields;
}

function parseDiskUsageBytes(value) {
  const normalized = stripCsvQuotes(String(value ?? "")).trim();

  if (!normalized) {
    return null;
  }

  const number = Number(normalized);

  if (!Number.isFinite(number) || number < 0) {
    return null;
  }

  return number;
}

function sumDiskUsageBytes(staticDiskUsageBytes, dynamicDiskUsageBytes) {
  if (staticDiskUsageBytes === null && dynamicDiskUsageBytes === null) {
    return null;
  }

  return (staticDiskUsageBytes ?? 0) + (dynamicDiskUsageBytes ?? 0);
}

function stripCsvQuotes(value) {
  const trimmed = value.trim();

  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}
