import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => ({
  server: { host: "::", port: 8080, hmr: { overlay: false } },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: { alias: { "@": path.resolve(__dirname, "./src") }, dedupe: ["react", "react-dom"] },
  build: {
    // chunkSizeWarningLimit is intentionally left at the Vite default so the
    // bundle report keeps surfacing oversized chunks. The manual chunk plan
    // below targets vendor reuse + admin segregation.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/react-router") || /node_modules\/react(-dom)?\//.test(id) || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          if (id.includes("/@supabase/")) return "vendor-supabase";
          if (id.includes("/@tanstack/")) return "vendor-tanstack";
          if (id.includes("/@radix-ui/")) return "vendor-radix";
          if (id.includes("/lucide-react/")) return "vendor-lucide";
          if (id.includes("/framer-motion/")) return "vendor-framer";
          if (id.includes("/date-fns/")) return "vendor-datefns";
          // NOTE: do NOT manually chunk recharts/d3 together. Recharts and the
          // d3-* packages have intra-package circular re-exports that Rollup
          // resolves correctly only when it controls chunk boundaries. Forcing
          // them into a single manual chunk produces a TDZ ("Cannot access
          // 'S' before initialization") at runtime in the production build.
          return undefined;
        },
      },
    },
  },
}));
