import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "./errors.js";
import { normalizeDeleteSelection } from "./validation.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(currentDir, "../public");
const indexPath = path.join(publicDir, "index.html");

export function createApp({ service }) {
  const app = express();

  app.use(express.json({ limit: "128kb" }));

  app.get(
    "/api/health",
    asyncRoute(async (_request, response) => {
      response.json(await service.health());
    })
  );

  app.get(
    "/api/device",
    asyncRoute(async (_request, response) => {
      response.json(await service.getDeviceStatus());
    })
  );

  app.get(
    "/api/apps",
    asyncRoute(async (_request, response) => {
      response.json({ apps: await service.listApps() });
    })
  );

  app.post(
    "/api/delete",
    asyncRoute(async (request, response) => {
      const selection = normalizeDeleteSelection(request.body);
      response.json({ results: await service.deleteApps(selection) });
    })
  );

  app.get("/", (_request, response) => {
    if (existsSync(indexPath)) {
      response.sendFile(indexPath);
      return;
    }

    response.type("html").send(fallbackHtml());
  });

  app.use(express.static(publicDir));
  app.use(errorMiddleware);

  return app;
}

function asyncRoute(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

function errorMiddleware(error, _request, response, _next) {
  const status = error instanceof AppError ? error.status : 500;
  const code = error instanceof AppError ? error.code : "INTERNAL_ERROR";
  const message =
    status === 500 && !(error instanceof AppError)
      ? "Unexpected server error"
      : error.message;

  response.status(status).json({
    error: {
      code,
      message,
      details: error instanceof AppError ? error.details : undefined
    }
  });
}

function fallbackHtml() {
  return [
    "<!doctype html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    "<title>iPhone App Manager</title>",
    "</head>",
    "<body>",
    "<h1>iPhone App Manager</h1>",
    "</body>",
    "</html>"
  ].join("");
}
