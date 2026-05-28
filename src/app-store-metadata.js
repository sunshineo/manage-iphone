const LOOKUP_URL = "https://itunes.apple.com/lookup";
const DEFAULT_COUNTRY = "us";
const DEFAULT_BATCH_SIZE = 25;
const MAX_PURPOSE_LENGTH = 180;

export function createAppStoreMetadataClient({
  fetchImpl = globalThis.fetch,
  country = DEFAULT_COUNTRY,
  batchSize = DEFAULT_BATCH_SIZE,
  cache = new Map()
} = {}) {
  async function enrichApps(apps) {
    const bundleIds = [...new Set(apps.map((app) => app.bundleId).filter(Boolean))];
    const missing = bundleIds.filter((bundleId) => !cache.has(bundleId));

    for (const batch of chunk(missing, batchSize)) {
      const metadataByBundleId = await safeLookupBundleIds(batch);

      for (const bundleId of batch) {
        cache.set(bundleId, metadataByBundleId.get(bundleId) ?? notFoundMetadata());
      }
    }

    return apps.map((app) => {
      const metadata = cache.get(app.bundleId) ?? notFoundMetadata();
      return {
        ...app,
        metadata: publicMetadata(metadata),
        purpose: metadata.found ? summarizeAppPurpose(metadata) : "No App Store metadata found."
      };
    });
  }

  async function safeLookupBundleIds(bundleIds) {
    try {
      return await lookupBundleIds(bundleIds);
    } catch {
      return new Map();
    }
  }

  async function lookupBundleIds(bundleIds) {
    if (bundleIds.length === 0) {
      return new Map();
    }

    const url = new URL(LOOKUP_URL);
    url.searchParams.set("bundleId", bundleIds.join(","));
    url.searchParams.set("country", country);
    url.searchParams.set("entity", "software");

    const response = await fetchImpl(url);

    if (!response.ok) {
      return new Map();
    }

    const payload = await response.json();
    const metadataByBundleId = new Map();

    for (const result of payload.results ?? []) {
      if (!result.bundleId) {
        continue;
      }

      metadataByBundleId.set(result.bundleId, {
        source: "appStore",
        found: true,
        appStoreName: result.trackName ?? "",
        sellerName: result.sellerName ?? "",
        genre: result.primaryGenreName ?? "",
        url: result.trackViewUrl ?? "",
        description: normalizeWhitespace(result.description ?? "")
      });
    }

    return metadataByBundleId;
  }

  return {
    enrichApps
  };
}

export function summarizeAppPurpose(metadata) {
  const description = normalizeWhitespace(metadata.description ?? "");
  const firstSentence = firstUsefulSentence(description);

  if (firstSentence) {
    return truncate(firstSentence, MAX_PURPOSE_LENGTH);
  }

  if (metadata.primaryGenreName && metadata.sellerName) {
    return sentence(`${metadata.primaryGenreName} app by ${metadata.sellerName}`);
  }

  if (metadata.genre && metadata.sellerName) {
    return sentence(`${metadata.genre} app by ${metadata.sellerName}`);
  }

  if (metadata.primaryGenreName || metadata.genre) {
    return sentence(`${metadata.primaryGenreName || metadata.genre} app`);
  }

  return "No App Store description found.";
}

function firstUsefulSentence(description) {
  const sentences = description.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g) ?? [];
  const sentence = sentences
    .map((value) => value.trim())
    .find((value) => value.length >= 20);

  return sentence ?? description;
}

function normalizeWhitespace(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}...`;
}

function notFoundMetadata() {
  return {
    source: "appStore",
    found: false,
    appStoreName: "",
    sellerName: "",
    genre: "",
    url: ""
  };
}

function publicMetadata(metadata) {
  return {
    source: metadata.source,
    found: metadata.found,
    appStoreName: metadata.appStoreName,
    sellerName: metadata.sellerName,
    genre: metadata.genre,
    url: metadata.url
  };
}

function sentence(value) {
  const trimmed = String(value).trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function chunk(values, size) {
  const chunks = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}
