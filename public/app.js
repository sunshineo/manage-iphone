import { appStorageSummary, formatStorageSize, nextSelection } from "./ui-state.js";

const state = {
  apps: [],
  health: null,
  device: null,
  selected: new Set(),
  loading: false,
  deleting: false,
  message: ""
};

const elements = {
  refreshButton: document.querySelector("#refreshButton"),
  dependencyBadge: document.querySelector("#dependencyBadge"),
  dependencyList: document.querySelector("#dependencyList"),
  dependencyHint: document.querySelector("#dependencyHint"),
  deviceBadge: document.querySelector("#deviceBadge"),
  deviceStatus: document.querySelector("#deviceStatus"),
  appCountSummary: document.querySelector("#appCountSummary"),
  totalStorageSummary: document.querySelector("#totalStorageSummary"),
  clearSelectionButton: document.querySelector("#clearSelectionButton"),
  appTableBody: document.querySelector("#appTableBody"),
  selectedCount: document.querySelector("#selectedCount"),
  deleteButton: document.querySelector("#deleteButton"),
  confirmDialog: document.querySelector("#confirmDialog"),
  confirmList: document.querySelector("#confirmList"),
  confirmDeleteButton: document.querySelector("#confirmDeleteButton"),
  resultsPanel: document.querySelector("#resultsPanel"),
  resultList: document.querySelector("#resultList"),
  dismissResultsButton: document.querySelector("#dismissResultsButton")
};

elements.refreshButton.addEventListener("click", () => refreshAll());
elements.clearSelectionButton.addEventListener("click", () => {
  state.selected.clear();
  renderApps();
});
elements.deleteButton.addEventListener("click", () => openConfirmDialog());
elements.confirmDeleteButton.addEventListener("click", () => deleteSelectedApps());
elements.dismissResultsButton.addEventListener("click", () => {
  elements.resultsPanel.hidden = true;
});

refreshAll();

async function refreshAll() {
  state.loading = true;
  state.message = "";
  state.apps = [];
  state.selected.clear();
  elements.resultsPanel.hidden = true;
  render();

  try {
    state.health = await requestJson("/api/health");

    if (dependencyAvailable("idevice_id")) {
      state.device = await requestJson("/api/device");
    } else {
      state.device = null;
    }

    if (dependenciesAvailable() && state.device?.connected) {
      const response = await requestJson("/api/apps");
      state.apps = response.apps;
    }
  } catch (error) {
    state.message = error.message;
  } finally {
    state.loading = false;
    render();
  }
}

async function deleteSelectedApps() {
  const selectedApps = state.apps
    .filter((app) => state.selected.has(app.bundleId))
    .map((app) => ({
      bundleId: app.bundleId,
      name: app.name
    }));

  if (selectedApps.length === 0) {
    return;
  }

  state.deleting = true;
  elements.confirmDialog.close();
  renderActions();

  try {
    const response = await requestJson("/api/delete", {
      method: "POST",
      body: { apps: selectedApps }
    });
    const failedIds = new Set(
      response.results.filter((result) => !result.ok).map((result) => result.bundleId)
    );
    state.selected = new Set([...state.selected].filter((bundleId) => failedIds.has(bundleId)));
    renderResults(response.results);
  } catch (error) {
    renderResults([
      {
        bundleId: "Request",
        name: "Delete request",
        ok: false,
        message: error.message
      }
    ]);
  } finally {
    state.deleting = false;
    renderApps();
  }
}

function render() {
  renderDependencies();
  renderDevice();
  renderApps();
}

function renderDependencies() {
  const dependencies = state.health?.dependencies ?? {};
  const names = ["idevice_id", "ideviceinstaller"];
  const missing = names.filter((name) => !dependencies[name]?.available);

  elements.dependencyBadge.textContent = state.loading
    ? "Checking"
    : missing.length === 0
      ? "Ready"
      : "Missing";
  elements.dependencyBadge.className = `badge ${missing.length === 0 ? "ok" : "warn"}`;
  elements.dependencyList.replaceChildren(
    ...names.map((name) => {
      const row = document.createElement("div");
      row.className = "dependency-row";

      const label = document.createElement("strong");
      label.textContent = name;

      const value = document.createElement("span");
      value.textContent = dependencies[name]?.available
        ? dependencies[name].path
        : "Not installed";

      row.append(label, value);
      return row;
    })
  );
  elements.dependencyHint.textContent =
    missing.length === 0
      ? "All required local commands are available."
      : `Install missing tools with: ${state.health?.installCommand ?? "brew install libimobiledevice ideviceinstaller"}`;
}

function renderDevice() {
  if (!dependencyAvailable("idevice_id")) {
    elements.deviceBadge.textContent = "Waiting";
    elements.deviceBadge.className = "badge warn";
    elements.deviceStatus.textContent = "Install idevice_id before device detection can run.";
    return;
  }

  if (state.loading && !state.device) {
    elements.deviceBadge.textContent = "Checking";
    elements.deviceBadge.className = "badge";
    elements.deviceStatus.textContent = "Checking for a trusted iPhone.";
    return;
  }

  if (!state.device) {
    elements.deviceBadge.textContent = "Unknown";
    elements.deviceBadge.className = "badge warn";
    elements.deviceStatus.textContent = state.message || "Device status is unavailable.";
    return;
  }

  if (state.device.connected) {
    elements.deviceBadge.textContent = "Connected";
    elements.deviceBadge.className = "badge ok";
    elements.deviceStatus.textContent = "One trusted iPhone is connected.";
    return;
  }

  elements.deviceBadge.textContent = state.device.deviceCount > 1 ? "Multiple" : "No Device";
  elements.deviceBadge.className = "badge warn";
  elements.deviceStatus.textContent =
    state.device.deviceCount > 1
      ? "Connect exactly one trusted iPhone before listing apps."
      : "No trusted iPhone is connected.";
}

function renderApps() {
  const apps = state.apps;
  renderAppSummary();
  elements.appTableBody.replaceChildren();

  if (state.loading) {
    renderEmptyRow("Loading app list.");
  } else if (state.message) {
    renderEmptyRow(state.message);
  } else if (!dependenciesAvailable()) {
    renderEmptyRow("Install the missing command line tools to list apps.");
  } else if (!state.device?.connected) {
    renderEmptyRow("Connect and trust one iPhone to list apps.");
  } else if (state.apps.length === 0) {
    renderEmptyRow("No user-installed apps were returned by the device tool.");
  } else {
    for (const app of apps) {
      elements.appTableBody.append(createAppRow(app));
    }
  }

  renderActions();
}

function renderAppSummary() {
  const { appCount, totalStorageBytes } = appStorageSummary(state.apps);
  elements.appCountSummary.textContent = `${appCount.toLocaleString()} ${
    appCount === 1 ? "app" : "apps"
  }`;
  elements.totalStorageSummary.textContent = `${formatStorageSize(totalStorageBytes)} total storage`;
}

function createAppRow(app) {
  const row = document.createElement("tr");

  const selectCell = document.createElement("td");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.checked = state.selected.has(app.bundleId);
  checkbox.setAttribute("aria-label", `Select ${app.name}`);
  checkbox.addEventListener("change", () => {
    state.selected = nextSelection(state.selected, app.bundleId, checkbox.checked);
    renderActions();
  });
  selectCell.append(checkbox);

  const appCell = document.createElement("td");
  const name = document.createElement("span");
  name.className = "app-name";
  name.textContent = app.name || app.bundleId;
  appCell.append(name);

  const purposeCell = document.createElement("td");
  purposeCell.className = "purpose-cell";
  const purposeText = document.createElement("span");
  purposeText.className = "purpose-text";
  purposeText.textContent = app.purpose || "No App Store metadata found.";
  purposeCell.title = app.metadata?.found
    ? `${app.metadata.genre || "App Store"} · ${app.metadata.sellerName || app.metadata.appStoreName}`
    : "No App Store metadata found for this bundle ID.";
  purposeCell.append(purposeText);

  const storageCell = document.createElement("td");
  storageCell.className = "storage-cell";
  storageCell.textContent = formatStorageSize(app.storageBytes);
  storageCell.title = storageTitle(app);

  row.append(selectCell, appCell, purposeCell, storageCell);
  return row;
}

function storageTitle(app) {
  if (app.storageBytes === null || app.storageBytes === undefined) {
    return "Storage size is unavailable for this app.";
  }

  return [
    `Total: ${formatStorageSize(app.storageBytes)}`,
    `App: ${formatStorageSize(app.staticDiskUsageBytes)}`,
    `Data: ${formatStorageSize(app.dynamicDiskUsageBytes)}`
  ].join(" · ");
}

function renderEmptyRow(message) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.colSpan = 4;
  cell.className = "empty-cell";
  cell.textContent = message;
  row.append(cell);
  elements.appTableBody.append(row);
}

function renderActions() {
  const count = state.selected.size;
  elements.selectedCount.textContent = `${count} selected`;
  elements.deleteButton.disabled = count === 0 || state.deleting;
  elements.deleteButton.textContent = state.deleting ? "Deleting..." : "Delete Selected";
  elements.clearSelectionButton.disabled = count === 0 || state.loading;
  elements.refreshButton.disabled = state.loading || state.deleting;
}

function openConfirmDialog() {
  const selectedApps = state.apps.filter((app) => state.selected.has(app.bundleId));
  elements.confirmList.replaceChildren(
    ...selectedApps.map((app) => {
      const item = document.createElement("div");
      item.className = "confirm-item";

      const name = document.createElement("strong");
      name.textContent = app.name || app.bundleId;

      const bundleId = document.createElement("div");
      bundleId.className = "bundle-id";
      bundleId.textContent = app.bundleId;

      item.append(name, bundleId);
      return item;
    })
  );
  elements.confirmDialog.showModal();
}

function renderResults(results) {
  elements.resultList.replaceChildren(
    ...results.map((result) => {
      const row = document.createElement("div");
      row.className = `result-row ${result.ok ? "ok" : "error"}`;

      const badge = document.createElement("span");
      badge.className = `badge ${result.ok ? "ok" : "error"}`;
      badge.textContent = result.ok ? "Deleted" : "Failed";

      const detail = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = result.name || result.bundleId;
      const message = document.createElement("div");
      message.className = "bundle-id";
      message.textContent = `${result.bundleId}: ${result.message}`;
      detail.append(title, message);

      row.append(badge, detail);
      return row;
    })
  );
  elements.resultsPanel.hidden = false;
}

function dependenciesAvailable() {
  return dependencyAvailable("idevice_id") && dependencyAvailable("ideviceinstaller");
}

function dependencyAvailable(name) {
  return Boolean(state.health?.dependencies?.[name]?.available);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body ? { "content-type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with ${response.status}`);
  }

  return payload;
}
