import { defineConfig } from "vite"
import * as path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    ssr: true,
    emptyOutDir: false,
    outDir: path.resolve(__dirname, "dist"),
    rollupOptions: {
      input: path.resolve(__dirname, "src/production-runtime.ts"),
      output: {
        entryFileNames: "production-runtime.bundle.js",
        chunkFileNames: "chunks/[name]-[hash].js",
      },
      external: [
        "effect",
        /^effect\//,
        /^node:/,
      ],
    },
  },
})
