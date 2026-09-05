import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standalone-UI для createAdmin({ http: { ui: { enabled: true } } }).
// Собирается в lib/ui — тот же lib/, что уже несёт основной пакет,
// AdminServer отдаёт содержимое через express.static (см. docs/CUSTOMIZABLE_ADMIN_UI.md).
export default defineConfig({
  plugins: [react()],
  // Относительные пути к ассетам — бандл может быть смонтирован на любом
  // пути (не обязательно "/"), если бота с несколькими фичами держат за
  // прокси с префиксом.
  base: "./",
  build: {
    outDir: "../lib/ui",
    emptyOutDir: true,
  },
});
