export function filterApps(apps, query) {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  if (!normalizedQuery) {
    return apps;
  }

  return apps.filter((app) => {
    const name = String(app.name ?? "").toLocaleLowerCase();
    const bundleId = String(app.bundleId ?? "").toLocaleLowerCase();
    return name.includes(normalizedQuery) || bundleId.includes(normalizedQuery);
  });
}

export function nextSelection(selectedSet, bundleId, checked) {
  const next = new Set(selectedSet);

  if (checked) {
    next.add(bundleId);
  } else {
    next.delete(bundleId);
  }

  return next;
}
