import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  dts: true,
  // clean: false — НЕ используем tsup-очистку. Она в двух местах:
  //   1) removeFiles(["**/*", ...clean]) — уважает негации, ок;
  //   2) cleanDtsFiles: removeFiles(["**/*.d.{ts,mts,cts}"]) — БЕЗУСЛОВНО
  //      сносит все .d.ts под outDir, негации из массива не применяются,
  //      т.е. убивает lib/ui-kit/**/*.d.ts на каждом прогоне.
  // Поэтому чистка вынесена в отдельный npm-скрипт `clean` (rm -rf lib),
  // который дёргается перед публикацией (prepublishOnly/pack), а vite
  // потом кладёт lib/ui и lib/ui-kit поверх. Плейн `yarn build` теперь
  // не разрушает UI-артефакты (важно для локального dev-линка).
  clean: false,
  sourcemap: true,
  target: "node18",
  // resolveUiDir() (http/uiStatic.ts) использует __dirname для поиска lib/ui —
  // в ESM-сборке этот глобал не существует нативно, tsup инжектит шим
  // (__dirname = path.dirname(fileURLToPath(import.meta.url))).
  shims: true,
  outDir: "lib",
  // express / cors / body-parser / joi (deps) и telegraf (peer) остаются внешними
});
