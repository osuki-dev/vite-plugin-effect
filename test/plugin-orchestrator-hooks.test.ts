import { describe, test, expect } from "bun:test"
import { createPlugin } from "../src/plugin-orchestrator.ts"

describe("PluginOrchestrator lifecycle hooks", () => {
  test("buildStart triggers client regeneration", async () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
    })
    plugin.configResolved?.({ root: "/tmp", command: "serve", build: { outDir: "dist" } } as any)
    // buildStart should not throw
    await plugin.buildStart?.()
  })

  test("closeBundle is a no-op for server build", async () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
      serverEntry: "./src/server.ts",
    })
    plugin.configResolved?.({ root: "/tmp", command: "build", build: { outDir: "dist" } } as any)
    // closeBundle is no-op — server build is handled by buildApp
    await plugin.closeBundle?.()
  })

  test("configureServer mounts middleware", async () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
    })
    const middlewares: any[] = []
    const server = {
      middlewares: {
        use: (fn: any) => middlewares.push(fn),
      },
    } as any
    plugin.configureServer?.(server)
    expect(middlewares.length).toBeGreaterThan(0)
  })

  test("configurePreviewServer mounts preview middleware", async () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
    })
    const middlewares: any[] = []
    const server = {
      middlewares: {
        use: (fn: any) => middlewares.push(fn),
      },
    } as any
    plugin.configurePreviewServer?.(server)
    expect(middlewares.length).toBeGreaterThan(0)
  })

  test("resolveId returns undefined for unknown module", () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
    })
    plugin.configResolved?.({ root: "/tmp", command: "serve", build: { outDir: "dist" } } as any)
    const resolvedId = plugin.resolveId?.("some-random-module", "", {})
    expect(resolvedId).toBeUndefined()
  })

  test("load returns undefined for unknown module", () => {
    const plugin = createPlugin({
      sharedPath: "./src/shared.ts",
    })
    plugin.configResolved?.({ root: "/tmp", command: "serve", build: { outDir: "dist" } } as any)
    const code = plugin.load?.("\0some-random-module")
    expect(code).toBeUndefined()
  })
})
