#!/usr/bin/env node
/**
 * Lightweight ts-node runner to avoid tsx/esbuild spawn issues on Windows.
 * Usage: node scripts/run-ts-node.js <path-to-ts-file> [args...]
 */
const path = require("path");
const { register } = require("ts-node");

register({
  transpileOnly: true,
  preferTsExts: true,
  compilerOptions: {
    module: "CommonJS",
    moduleResolution: "Node",
    allowImportingTsExtensions: true,
  },
});

// Redirect .js imports for TS files that are authored as .ts but imported with .js extension.
const Module = require("module");
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (typeof request === "string" && request.endsWith(".js")) {
    const tsCandidate = request.replace(/\.js$/, ".ts");
    try {
      return originalResolveFilename.call(this, tsCandidate, parent, isMain, options);
    } catch (_) {
      // fall through to original request
    }
  }
  return originalResolveFilename.call(this, request, parent, isMain, options);
};

const [, , target, ...rest] = process.argv;
if (!target) {
  console.error("Usage: run-ts-node <path-to-ts-file> [args]");
  process.exit(1);
}

process.argv = [process.argv[0], target, ...rest];
require(path.resolve(target));
