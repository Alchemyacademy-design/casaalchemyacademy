import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080, hmr: { overlay: false } },
  plugins: [react(), mcpPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: { alias: { "@": path.resolve(__dirname, "./src") }, dedupe: ["react", "react-dom"] },
  build: {
    // chunkSizeWarningLimit is intentionally left at the Vite default so the
    // bundle report keeps surfacing oversized chunks. The manual chunk plan
    // below targets vendor reuse + admin segregation.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Keep react + react-dom + scheduler together so a single React copy
          // initializes before anything imports it. Do NOT bundle react-router
          // here — react-router pulls React at module init and, when grouped
          // with unrelated vendors, Rollup can order the chunk such that the
          // React binding is still in its TDZ ("Cannot access 'Le' before
          // initialization") when a downstream vendor chunk (e.g. Radix, which
          // does `React[" use ".trim()]` at top level) evaluates.
          if (/node_modules\/react(-dom)?\//.test(id) || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          if (id.includes("/@supabase/")) return "vendor-supabase";
          if (id.includes("/@tanstack/")) return "vendor-tanstack";
          if (id.includes("/lucide-react/")) return "vendor-lucide";
          if (id.includes("/framer-motion/")) return "vendor-framer";
          if (id.includes("/date-fns/")) return "vendor-datefns";
          // NOTE: do NOT manually chunk @radix-ui/*, react-router, recharts or
          // d3-* together. These packages have intra-package circular
          // re-exports (and, for Radix, top-level `React[" use "]` access)
          // that Rollup resolves correctly only when it controls chunk
          // boundaries. Forcing them into a single manual chunk produces a
          // TDZ ("Cannot access 'Le'/'S' before initialization") in prod.
          return undefined;
        },
      },
    },
  },
}));
