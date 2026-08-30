import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import netlify from "@netlify/vite-plugin-tanstack-start";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

// Standard TanStack Start + Vite config (no Lovable-specific wrapper).
// The previous config used @lovable.dev/vite-tanstack-config, which:
//   1) hard-coded the Nitro deploy target to "cloudflare" (wrong for Vercel), and
//   2) resolved entry files in a way that failed outside Lovable's own hosting
//      ("Could not resolve entry for router entry: router in .../src").
// This config uses the official plugin directly, which auto-detects Vercel via
// its build environment and finds src/router.tsx, src/server.ts and
// src/routes/** using TanStack Start's normal file conventions — no extra
// options needed since this project already follows those conventions.
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart({
      customViteReactPlugin: true,
    }),
    netlify(),
    viteReact(),
  ],
});
