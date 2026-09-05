import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import { TokenGate } from "./auth/TokenGate";
import { App } from "./App";

const container = document.getElementById("root");
if (!container) throw new Error("#root не найден");

createRoot(container).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <TokenGate>
        <App />
      </TokenGate>
    </MantineProvider>
  </StrictMode>,
);
