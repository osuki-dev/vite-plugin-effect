import { defineConfig } from "vite"
import vitePluginEffect from "../../dist/index.js"

export default defineConfig({
  plugins: [
    vitePluginEffect({
      useReflection: true,
      mode: "http",
      apiPrefix: "/api",
      serverEntry: "./src/server.ts",
    }),
  ],
})
