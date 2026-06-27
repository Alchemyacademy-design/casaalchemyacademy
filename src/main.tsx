import { QueryClientProvider } from "@tanstack/react-query";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import "@/manus/styles/official-platform.css";
import "@/manus/styles/official-module-route.css";
import "@/manus/styles/academy-design-system.css";
import { queryClient } from "@/manus/lib/query-client";
import CrossTabQuerySync from "@/manus/components/CrossTabQuerySync";

declare global {
  interface Window {
    __aaStartupError?: (msg: string) => void;
  }
}

function removeStartupFallback() {
  const el = document.getElementById("aa-startup-fallback");
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

function reportStartupError(err: unknown) {
  const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
  if (typeof window !== "undefined" && typeof window.__aaStartupError === "function") {
    window.__aaStartupError(msg);
  } else {
    // Last-resort visible fallback if the inline handler is missing.
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML =
        '<div style="padding:24px;font-family:DM Sans,system-ui,sans-serif;color:#2A2318;background:#F5F0E8;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px">' +
        '<h1 style="font-family:Cormorant Garamond,Georgia,serif;font-size:24px;font-weight:400;margin:0;color:#3D3A2A">Alchemy Academy could not start.</h1>' +
        '<button onclick="location.reload()" style="background:#3D3A2A;color:#F5F0E8;border:0;padding:10px 18px;cursor:pointer">Reload</button>' +
        "</div>";
    }
  }
  // eslint-disable-next-line no-console
  console.error("[startup]", err);
}

try {
  const container = document.getElementById("root");
  if (!container) throw new Error("#root element missing from index.html");

  createRoot(container).render(
    <QueryClientProvider client={queryClient}>
      <CrossTabQuerySync />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>,
  );
  // Defer removal until after first paint so users never see a flash of empty body.
  requestAnimationFrame(() => requestAnimationFrame(removeStartupFallback));
} catch (err) {
  reportStartupError(err);
}
