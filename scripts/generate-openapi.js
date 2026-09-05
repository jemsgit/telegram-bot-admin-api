#!/usr/bin/env node
// Пишет openapi.json (core+feature роуты, все фичи включены) в корень пакета.
// Требует собранный `lib/` (`yarn build`) — читает готовый экспорт, тем самым
// заодно проверяя, что `buildOpenApiDocument`/`DEFAULT_FEATURES` реально
// доступны потребителю пакета, а не только внутри src/.
const fs = require("node:fs");
const path = require("node:path");

const libIndex = path.join(__dirname, "..", "lib", "index.js");
if (!fs.existsSync(libIndex)) {
  console.error(
    "openapi: lib/index.js не найден — сначала `yarn build` (или `npx tsup`).",
  );
  process.exit(1);
}

const { buildOpenApiDocument, DEFAULT_FEATURES } = require(libIndex);
const pkg = require("../package.json");

const doc = buildOpenApiDocument(DEFAULT_FEATURES, {
  title: pkg.name,
  version: pkg.version,
});

const outPath = path.join(__dirname, "..", "openapi.json");
fs.writeFileSync(outPath, JSON.stringify(doc, null, 2) + "\n");
console.log(`openapi: записано ${Object.keys(doc.paths).length} путей в ${outPath}`);
