import { describe, test, expect } from "bun:test"
import { runBuildPipeline } from "../src/build-pipeline.ts"
import type { ResolvedConfig } from "vite"
import type { ResolvedPluginOptions } from "../src/options.ts"
import { NoopSsrStrategy } from "../src/ssr/index.ts"

describe("runBuildPipeline conditions", () => {
  test("is exported as a function", () => {
    expect(typeof runBuildPipeline).toBe("function")
  })

  test("returns early when productionServer is false", async () => {
    const strategy = new NoopSsrStrategy()
    const config = { root: "/tmp" } as ResolvedConfig
    const options = { productionServer: false, ssr: false } as ResolvedPluginOptions
    // Should not throw and should return early
    await runBuildPipeline(config, options, "/tmp/dist", undefined, strategy)
  })

  test("skips SSR bundle when builder is absent", async () => {
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
    // Should not throw and should skip SSR bundle
    await runBuildPipeline(config, options, "/tmp/dist", undefined, strategy)
  })
})
