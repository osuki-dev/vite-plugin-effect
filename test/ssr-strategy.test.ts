import { describe, test, expect } from "bun:test"
import { NoopSsrStrategy, ViteSsrStrategy } from "../src/ssr/index.ts"
import type { ResolvedPluginOptions } from "../src/options.ts"

const mockOptions = (ssr: any): ResolvedPluginOptions =>
  ({
    ssr,
    entries: [],
    virtualModuleId: "virtual:effect/client",
  } as any)

describe("SsrStrategy", () => {
  describe("NoopSsrStrategy", () => {
    test("enabled is false", () => {
      const strategy = new NoopSsrStrategy()
      expect(strategy.enabled).toBe(false)
    })

    test("createDevMiddleware returns null", () => {
      const strategy = new NoopSsrStrategy()
      expect(strategy.createDevMiddleware(null as any, () => mockOptions(false), () => ({} as any))).toBeNull()
    })

    test("getBuildEntry returns null", () => {
      const strategy = new NoopSsrStrategy()
      expect(strategy.getBuildEntry(mockOptions(false))).toBeNull()
    })

    test("getRuntimeEntryUrl returns null", () => {
      const strategy = new NoopSsrStrategy()
      expect(strategy.getRuntimeEntryUrl(mockOptions(false), "/tmp")).toBeNull()
    })
  })

  describe("ViteSsrStrategy", () => {
    test("enabled is true", () => {
      const strategy = new ViteSsrStrategy()
      expect(strategy.enabled).toBe(true)
    })

    test("getBuildEntry returns ssr.entry", () => {
      const strategy = new ViteSsrStrategy()
      expect(strategy.getBuildEntry(mockOptions({ entry: "src/server.tsx" }))).toBe("src/server.tsx")
    })

    test("getBuildEntry returns default when entry is undefined", () => {
      const strategy = new ViteSsrStrategy()
      expect(strategy.getBuildEntry(mockOptions({}))).toBe("src/entry-server.tsx")
    })

    test("getRuntimeEntryUrl returns a relative URL", () => {
      const strategy = new ViteSsrStrategy()
      const url = strategy.getRuntimeEntryUrl(mockOptions({ entry: "src/server.tsx" }), "/dist/server")
      expect(url).toContain("./ssr/server.js")
      expect(url).toContain("import.meta.url")
    })
  })
})
