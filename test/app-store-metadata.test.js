import test from "node:test";
import assert from "node:assert/strict";
import {
  createAppStoreMetadataClient,
  summarizeAppPurpose
} from "../src/app-store-metadata.js";

test("summarizeAppPurpose returns a concise first-sentence purpose", () => {
  assert.equal(
    summarizeAppPurpose({
      description:
        "Chat with an AI assistant, generate images, and sync conversations across devices. Additional marketing copy follows.",
      primaryGenreName: "Productivity",
      sellerName: "OpenAI"
    }),
    "Chat with an AI assistant, generate images, and sync conversations across devices."
  );
});

test("summarizeAppPurpose falls back to genre and seller when description is absent", () => {
  assert.equal(
    summarizeAppPurpose({
      primaryGenreName: "Navigation",
      sellerName: "Example Maps Inc."
    }),
    "Navigation app by Example Maps Inc."
  );
});

test("enrichApps fetches App Store metadata by bundle ID and caches results", async () => {
  const requestedUrls = [];
  const client = createAppStoreMetadataClient({
    fetchImpl: async (url) => {
      requestedUrls.push(url.toString());
      return {
        ok: true,
        json: async () => ({
          resultCount: 1,
          results: [
            {
              bundleId: "com.example.maps",
              trackName: "Example Maps",
              sellerName: "Example Inc.",
              primaryGenreName: "Navigation",
              description: "Find routes and traffic conditions in real time.",
              trackViewUrl: "https://apps.apple.com/us/app/example-maps/id1"
            }
          ]
        })
      };
    }
  });

  const apps = [
    { bundleId: "com.example.maps", name: "Maps", version: "1.0" },
    { bundleId: "com.example.private", name: "Private App", version: "2.0" }
  ];

  const first = await client.enrichApps(apps);
  const second = await client.enrichApps(apps);

  assert.equal(requestedUrls.length, 1);
  assert.match(requestedUrls[0], /bundleId=com\.example\.maps%2Ccom\.example\.private/);
  assert.deepEqual(first[0].metadata, {
    source: "appStore",
    found: true,
    appStoreName: "Example Maps",
    sellerName: "Example Inc.",
    genre: "Navigation",
    url: "https://apps.apple.com/us/app/example-maps/id1"
  });
  assert.equal(first[0].purpose, "Find routes and traffic conditions in real time.");
  assert.equal(first[1].metadata.found, false);
  assert.equal(first[1].purpose, "No App Store metadata found.");
  assert.deepEqual(second, first);
});

test("enrichApps keeps listed apps when App Store lookup fails", async () => {
  const client = createAppStoreMetadataClient({
    fetchImpl: async () => {
      throw new Error("network unavailable");
    }
  });

  assert.deepEqual(
    await client.enrichApps([
      { bundleId: "com.example.offline", name: "Offline App", version: "1.0" }
    ]),
    [
      {
        bundleId: "com.example.offline",
        name: "Offline App",
        version: "1.0",
        metadata: {
          source: "appStore",
          found: false,
          appStoreName: "",
          sellerName: "",
          genre: "",
          url: ""
        },
        purpose: "No App Store metadata found."
      }
    ]
  );
});
