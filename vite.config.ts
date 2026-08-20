import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ command }) => ({
  server: {
    host: "::",
    port: 5173,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  // cloudflare:workers is a virtual module provided by workerd at runtime only.
  // Exclude it from Vite's dep pre-bundler (dev) and SSR bundler so it is never
  // resolved as a real package in either vite dev or e2e (playwright + vite dev).
  optimizeDeps: {
    exclude: ["cloudflare:workers", "cloudflare:sockets"],
  },
  // BETA-074 (Issue #1981) — measurable bundle budgets. The client entry chunk
  // must stay under the warning limit (500 kB after minification) so regressions
  // in the initial JS payload surface in CI. reportCompressedSize keeps gzip
  // sizes visible in build output for the before/after performance evidence.
  build: {
    reportCompressedSize: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("framer-motion") || id.includes("motion-dom")) return "vendor-motion";
          if (id.includes("recharts") || id.includes("/d3-")) return "vendor-charts";
          if (id.includes("@stellar/") || id.includes("stellar-sdk")) return "vendor-stellar";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("@tanstack/")) return "vendor-tanstack";
          if (id.includes("react-dom") || id.includes("/react/") || id.includes("/scheduler/")) {
            return "vendor-react";
          }
          return undefined;
        },
      },
    },
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    ...(command === "build" ? cloudflare({ viteEnvironment: { name: "ssr" } }) : []),
    ...tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    react(),
  ],
}));
