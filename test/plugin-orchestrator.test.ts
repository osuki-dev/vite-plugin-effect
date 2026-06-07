import { describe, test, expect } from "bun:test"
import { PluginOrchestrator, createPlugin } from "../src/plugin-orchestrator.ts"
import type { VitePluginEffectOptions } from "../src/options.ts"
import type { ResolvedConfig } from "vite"

const mockConfig = (root: string = "/tmp"): ResolvedConfig =>
  ({
    root,
    command: "serve",
    build: { outDir: "dist" },
  } as any)

describe("PluginOrchestrator", () => {
  test("can be created with dependency injection", () => {
    const options: VitePluginEffectOptions = {
      sharedPath: "./src/shared.ts",
      mode: "http",
    }
    const plugin = createPlugin(options)
    expect(plugin.name).toBe("vite-plugin-effect")
    expect(plugin.config).toBeDefined()
    expect(plugin.configResolved).toBeDefined()
    expect(plugin.resolveId).toBeDefined()
    expect(plugin.load).toBeDefined()
    expect(plugin.configureServer).toBeDefined()
    expect(plugin.configurePreviewServer).toBeDefined()
    expect(plugin.buildStart).toBeDefined()
    expect(plugin.closeBundle).toBeDefined()
    expect(plugin.buildApp).toBeDefined()
  })

  test("resolveVirtualModuleId returns resolved id for virtual module", () => {
    const options: VitePluginEffectOptions = {
      sharedPath: "./src/shared.ts",
      mode: "http",
    }
    const plugin = createPlugin(options)
    plugin.configResolved?.(mockConfig())
    const resolvedId = plugin.resolveId?.("virtual:effect/client", "", {})
    expect(resolvedId).toBe("\0virtual:effect/client")
  })

  test("resolveVirtualModuleId returns undefined for unknown module", () => {
    const options: VitePluginEffectOptions = {
      sharedPath: "./src/shared.ts",
    }
    const plugin = createPlugin(options)
    plugin.configResolved?.(mockConfig())
    const resolvedId = plugin.resolveId?.("unknown-module", "", {})
    expect(resolvedId).toBeUndefined()
  })

  test("load generates virtual module code", () => {
    const options: VitePluginEffectOptions = {
      sharedPath: "./src/shared.ts",
      mode: "http",
    }
    const plugin = createPlugin(options)
    plugin.configResolved?.(mockConfig())
    const code = plugin.load?.("\0virtual:effect/client")
    expect(code).toBeDefined()
    expect(code).toContain("effect-client.ts")
  })

  test("load generates virtual types module", () => {
    const options: VitePluginEffectOptions = {
      sharedPath: "./src/shared.ts",
    }
    const plugin = createPlugin(options)
    plugin.configResolved?.(mockConfig())
    const code = plugin.load?.("\0virtual:effect/client?types")
    expect(code).toBeDefined()
    expect(code).toContain("AwaitableClient")
  })
})
