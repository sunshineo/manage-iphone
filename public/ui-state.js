export function nextSelection(selectedSet, bundleId, checked) {
  const next = new Set(selectedSet);

  if (checked) {
    next.add(bundleId);
  } else {
    next.delete(bundleId);
  }

  return next;
}

export function formatStorageSize(bytes) {
  if (bytes === null || bytes === undefined || bytes === "") {
    return "-";
  }

  const value = Number(bytes);

  if (!Number.isFinite(value) || value < 0) {
    return "-";
  }

  if (value === 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  if (unitIndex === 0) {
    return `${Math.round(size)} B`;
  }

  const maximumFractionDigits = size < 10 ? 1 : 0;
  return `${size.toLocaleString(undefined, {
    maximumFractionDigits,
    minimumFractionDigits: 0
  })} ${units[unitIndex]}`;
}

export function appStorageSummary(apps) {
  return {
    appCount: apps.length,
    totalStorageBytes: apps.reduce((total, app) => {
      const value = Number(app.storageBytes);
      return Number.isFinite(value) && value > 0 ? total + value : total;
    }, 0)
  };
}
