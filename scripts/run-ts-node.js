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

const [, , target, ...rest] = process.argv;
if (!target) {
  console.error("Usage: run-ts-node <path-to-ts-file> [args]");
  process.exit(1);
}

process.argv = [process.argv[0], target, ...rest];
require(path.resolve(target));
