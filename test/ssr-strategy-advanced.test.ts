import { describe, test, expect } from "bun:test"
import { ViteSsrStrategy } from "../src/ssr/index.ts"
import type { ResolvedPluginOptions } from "../src/options.ts"

const mockOptions = (ssr: any): ResolvedPluginOptions =>
  ({
    ssr,
    entries: [],
    virtualModuleId: "virtual:effect/client",
  } as any)

describe("ViteSsrStrategy advanced", () => {
  test("getBuildEntry uses default when ssr is undefined", () => {
    const strategy = new ViteSsrStrategy()
    expect(strategy.getBuildEntry(mockOptions(undefined))).toBe("src/entry-server.tsx")
  })

  test("getBuildEntry uses default when ssr.entry is undefined", () => {
    const strategy = new ViteSsrStrategy()
    expect(strategy.getBuildEntry(mockOptions({}))).toBe("src/entry-server.tsx")
  })

  test("getBuildEntry strips extension for runtime entry URL", () => {
    const strategy = new ViteSsrStrategy()
    const url = strategy.getRuntimeEntryUrl(mockOptions({ entry: "src/entry-server.tsx" }), "/dist")
    expect(url).toContain("./ssr/entry-server.js")
  })

  test("getBuildEntry handles .js extension", () => {
    const strategy = new ViteSsrStrategy()
    const url = strategy.getRuntimeEntryUrl(mockOptions({ entry: "src/server.js" }), "/dist")
    expect(url).toContain("./ssr/server.js")
  })

  test("getBuildEntry handles .jsx extension", () => {
    const strategy = new ViteSsrStrategy()
    const url = strategy.getRuntimeEntryUrl(mockOptions({ entry: "src/app.jsx" }), "/dist")
    expect(url).toContain("./ssr/app.js")
  })
})
