import { describe, test, expect } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { ViteDevServer, ResolvedConfig } from "vite"
import { createPlugin as vitePluginEffect } from "../src/plugin-orchestrator.ts"
import { resolveOptions } from "../src/options.ts"
import { generateProductionServerRuntime } from "../src/production-server.ts"
import { NoopSsrStrategy } from "../src/ssr/index.ts"

const createMockServer = (): ViteDevServer => {
  const middlewares: Array<any> = []
  return {
    middlewares: {
      use: (fn: any) => middlewares.push(fn),
    },
    watcher: {
      on: () => {},
    },
    moduleGraph: {
      getModuleById: () => undefined,
      invalidateModule: () => {},
    },
    ws: {
      send: () => {},
    },
    ssrLoadModule: async (id: string) => {
      return { handler: null }
    },
    ssrFixStacktrace: (error: Error) => {},
  } as any as ViteDevServer
}

const createMockConfig = (root = "/tmp/vite-plugin-effect-test"): ResolvedConfig => {
  return {
    root,
    command: "serve",
    build: {
      outDir: "dist",
    },
  } as any as ResolvedConfig
}

describe("vite-plugin-effect", () => {
  test("creates a plugin with correct name", () => {
    const plugin = vitePluginEffect({
      serverEntry: "./src/server.ts",
    })
    expect(plugin.name).toBe("vite-plugin-effect")
  })

  test("does not set appType to custom", () => {
    const plugin = vitePluginEffect({
      serverEntry: "./src/server.ts",
    })
    const config = plugin.config?.()
    expect(config).toBeUndefined()
  })

  test("resolves virtual module id", () => {
    const plugin = vitePluginEffect({
      serverEntry: "./src/server.ts",
    })
    const resolvedId = plugin.resolveId?.("virtual:effect/client", "", {})
    expect(resolvedId).toBe("\0virtual:effect/client")
  })

  test("resolves custom virtual module id", () => {
    const plugin = vitePluginEffect({
      serverEntry: "./src/server.ts",
      virtualModuleId: "virtual:my-api",
    })
    const resolvedId = plugin.resolveId?.("virtual:my-api", "", {})
    expect(resolvedId).toBe("\0virtual:my-api")
  })

  test("mounts middleware in configureServer", () => {
    const plugin = vitePluginEffect({
      serverEntry: "./src/server.ts",
    })

    const server = createMockServer()
    const cleanup = plugin.configureServer?.(server)
    cleanup?.()

    expect((server.middlewares as any).use).toHaveBeenCalled
  })

  test("uses reflection mode by default", async () => {
    const root = await mkdtemp(join(tmpdir(), "vite-plugin-effect-"))
    try {
      await mkdir(join(root, "src"), { recursive: true })
      await writeFile(join(root, "src/server.ts"), `
import { Schema } from "effect"
import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
import { Rpc, RpcGroup } from "effect/unstable/rpc"

export const Todo = Schema.Struct({ id: Schema.Number, title: Schema.String }).pipe(Schema.annotate({ identifier: "Todo" }))
const todosGroup = HttpApiGroup.make("todos").add(
  HttpApiEndpoint.get("getTodos", "/todos", { success: Schema.Array(Todo) })
)
export const MyApi = HttpApi.make("MyApi").add(todosGroup)
export const TodoRpc = RpcGroup.make(
  Rpc.make("todoStats", { payload: {}, success: Schema.Struct({ total: Schema.Number }) })
)
`)
      const plugin = vitePluginEffect({
        serverEntry: "./src/server.ts",
      })

      await plugin.configResolved?.(createMockConfig(root))

      expect(plugin).toBeDefined()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("can disable generated declarations", async () => {
    const root = await mkdtemp(join(tmpdir(), "vite-plugin-effect-"))
    try {
      const plugin = vitePluginEffect({
        serverEntry: "./src/server.ts",
        dts: false,
      })

      await plugin.configResolved?.(createMockConfig(root))
      expect(plugin).toBeDefined()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("generates a production fullstack server runtime", () => {
    const options = resolveOptions({
      serverEntry: "./src/server.ts",
      productionServer: {
        host: "127.0.0.1",
        port: 8787,
        spaFallback: false,
      },
    })

    const code = generateProductionServerRuntime({
      runtimeEntryPath: "/project/dist/server/index.js",
      builtServerEntryPath: "/project/dist/server/server-entry.js",
      staticRootPath: "/project/dist",
      options,
      ssrStrategy: new NoopSsrStrategy(),
    })

    expect(code).toContain('new URL("./server-entry.js", import.meta.url)')
    expect(code).toContain('new URL("../", import.meta.url)')
    expect(code).toContain('defaultHost: "127.0.0.1"')
    expect(code).toContain("defaultPort: 8787")
    expect(code).toContain("spaFallback: false")
    expect(code).toContain("startProductionServer")
    expect(code).toContain("production-runtime.js")
  })
})
