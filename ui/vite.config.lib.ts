import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";

// `telegraf-admin-for-bots/ui-kit` — библиотечный build-таргет (шаг 4 в
// docs/CUSTOMIZABLE_ADMIN_UI.md), для потребителя вроде admin-panel/web (см.
// docs/ADMIN_PANEL_APP.md). Отдельный от standalone-бандла (vite.config.ts →
// lib/ui): другой entry (src/ui-kit.ts, без App/main/TokenGate), library mode
// (ESM+CJS, не одностраничное приложение), react/mantine — externals
// (peerDependencies потребителя, не бандлятся сюда — иначе два экземпляра
// React в одном дереве).
export default defineConfig({
  plugins: [
    react(),
    dts({
      // Только граф зависимостей ui-kit.ts — без App/main/TokenGate
      // (specific for standalone-режима, не часть ui-kit, см. ui-kit.ts).
      include: ["src/ui-kit.ts", "src/types.ts", "src/api/**", "src/components/**", "src/screens/**"],
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    outDir: "../lib/ui-kit",
    emptyOutDir: true,
    lib: {
      entry: "src/ui-kit.ts",
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.mjs" : "index.js"),
    },
    rollupOptions: {
      external: [
        "react",
        "react/jsx-runtime",
        "react-dom",
        "react-dom/client",
        "@mantine/core",
        "@mantine/dates",
        "@mantine/form",
        "@mantine/hooks",
      ],
    },
  },
});
