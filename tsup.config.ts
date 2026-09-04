import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node18",
  outDir: "lib",
  // express / cors / body-parser / joi (deps) и telegraf (peer) остаются внешними
});
