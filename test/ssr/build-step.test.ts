import { describe, test, expect } from "bun:test"
import { buildSsrBundle } from "../../src/ssr/build-step.ts"
import type { ResolvedConfig } from "vite"
import type { ResolvedPluginOptions } from "../../src/options.ts"
import { NoopSsrStrategy } from "../../src/ssr/index.ts"

describe("buildSsrBundle", () => {
  test("is exported as a function", () => {
    expect(typeof buildSsrBundle).toBe("function")
  })

  test("returns early when ssrStrategy returns no entry", async () => {
    const strategy = new NoopSsrStrategy()
    const config = { root: "/tmp" } as ResolvedConfig
    const options = { ssr: false } as ResolvedPluginOptions
    // Should not throw and should return early
    await buildSsrBundle(config, options, "/tmp/dist", strategy)
  })
})
