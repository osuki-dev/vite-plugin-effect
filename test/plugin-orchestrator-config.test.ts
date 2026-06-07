import { describe, test, expect } from "bun:test"
import { createPlugin } from "../src/plugin-orchestrator.ts"

describe("PluginOrchestrator config hook", () => {
  test("returns undefined for non-build command", () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
      serverEntry: "./src/server.ts",
    })
    const config = plugin.config?.({}, { command: "serve" })
    expect(config).toBeUndefined()
  })

  test("returns builder config for build command", () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
      serverEntry: "./src/server.ts",
    })
    plugin.configResolved?.({ root: "/tmp", command: "build", build: { outDir: "dist" } } as any)
    const config = plugin.config?.({}, { command: "build" })
    expect(config).toBeDefined()
    expect(config).toHaveProperty("builder")
    expect(config).toHaveProperty("environments")
    expect(config.environments).toHaveProperty("client")
    expect(config.environments).toHaveProperty("server")
  })

  test("returns undefined when no serverEntry configured", () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
    })
    const config = plugin.config?.({}, { command: "build" })
    expect(config).toBeUndefined()
  })

  test("server environment has SSR enabled", () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
      serverEntry: "./src/server.ts",
    })
    plugin.configResolved?.({ root: "/tmp", command: "build", build: { outDir: "dist" } } as any)
    const config = plugin.config?.({}, { command: "build" })
    expect(config.environments.server.build.ssr).toBe(true)
  })

  test("server environment has correct rollup externals", () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
      serverEntry: "./src/server.ts",
    })
    plugin.configResolved?.({ root: "/tmp", command: "build", build: { outDir: "dist" } } as any)
    const config = plugin.config?.({}, { command: "build" })
    const external = config.environments.server.build.rollupOptions.external
    expect(external).toContain("effect")
    expect(external.some((e: any) => e instanceof RegExp && e.source === "^effect\\/")).toBe(true)
    expect(external.some((e: any) => e instanceof RegExp && e.source === "^node:")).toBe(true)
  })
})
