/* eslint-disable @typescript-eslint/no-require-imports */
// Next.js bundles `server-only` internally; outside Next (tests, scripts) it resolves to a no-op.
const Module = require("node:module");
const path = require("node:path");
const stub = path.join(__dirname, "server-only-empty.cjs");
const resolve = Module._resolveFilename;
Module._resolveFilename = function resolveServerOnly(request, ...rest) {
  return request === "server-only" ? stub : resolve.call(this, request, ...rest);
};
