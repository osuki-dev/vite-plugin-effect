import { defineConfig } from "vite"
import vitePluginEffect from "../../dist/index.js"

export default defineConfig({
  plugins: [
    vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "http",
      apiPrefix: "/api",
      serverEntry: "./src/server.ts",
    }),
  ],
})
