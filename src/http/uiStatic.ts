import fs from "node:fs";
import path from "node:path";

/**
 * Находит собранный standalone-UI (`ui/` → `vite build` → `lib/ui/`,
 * см. docs/CUSTOMIZABLE_ADMIN_UI.md). Два кандидата, потому что путь
 * относительно этого файла разный в опубликованном пакете и в исходниках:
 * - собранный пакет: tsup сводит всё в один `lib/index.js` — `__dirname`
 *   этого кода указывает прямо на `lib/`, значит UI лежит в `lib/ui`;
 * - исходники/тесты (vitest гоняет `src/http/uiStatic.ts` напрямую, без
 *   сборки, файлы не объединены) — `__dirname` = `src/http/`, UI в
 *   `../../lib/ui`.
 */
export function resolveUiDir(): string | null {
  const candidates = [
    path.join(__dirname, "ui"), // прод: (bundled) __dirname = lib/ → lib/ui
    path.join(__dirname, "..", "..", "lib", "ui"), // dev: src/http/ → ../../lib/ui
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "index.html"))) return dir;
  }
  return null;
}
