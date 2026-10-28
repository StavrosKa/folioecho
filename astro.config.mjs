import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import netlify from "@astrojs/netlify";
export default defineConfig({
  output: "server",
  adapter: process.env.NETLIFY === 'true' || process.env.FOLIOECHO_NETLIFY_BUILD === '1' ? netlify({ includeFiles: ['./assets/fonts/**'], middlewareMode: 'classic' }) : node({ mode: "standalone" }),
  integrations: [react()],
  vite: { define: { 'process.env.FOLIOECHO_DEPLOY_ORIGIN': JSON.stringify(process.env.DEPLOY_PRIME_URL ?? '') } },
  devToolbar: { enabled: false },
});
