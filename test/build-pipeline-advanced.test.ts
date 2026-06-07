import { describe, test, expect } from "bun:test"
import { runBuildPipeline } from "../src/build-pipeline.ts"
import type { ResolvedConfig } from "vite"
import type { ResolvedPluginOptions } from "../src/options.ts"
import { NoopSsrStrategy } from "../src/ssr/index.ts"

describe("runBuildPipeline advanced", () => {
  test("runs with builder present", async () => {
    const strategy = new NoopSsrStrategy()
    const config = { root: "/tmp", build: { outDir: "dist" } } as ResolvedConfig
    const options = {
      entries: [],
      productionServer: {
        entry: "index.js",
        host: "127.0.0.1",
        port: 3000,
        spaFallback: false,
      },
      ssr: false,
    } as ResolvedPluginOptions
    // Should run production runtime and skip SSR bundle
    await runBuildPipeline(config, options, "/tmp/dist", { mock: true }, strategy)
  })

  test("runs without production server", async () => {
    const strategy = new NoopSsrStrategy()
    const config = { root: "/tmp", build: { outDir: "dist" } } as ResolvedConfig
    const options = {
      entries: [],
      productionServer: false,
      ssr: false,
    } as ResolvedPluginOptions
    // Should skip production runtime and just generate server entry
    await runBuildPipeline(config, options, "/tmp/dist", undefined, strategy)
  })
})
