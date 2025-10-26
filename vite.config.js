import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

let htmlParsePath;
try { htmlParsePath = require.resolve("html-parse-stringify2"); } catch { htmlParsePath = undefined; }

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "./src"),
      ...(htmlParsePath ? { "html-parse-stringify": htmlParsePath } : {}),
    },
  },
  server: { host: true, port: 5175, strictPort: true },
});
