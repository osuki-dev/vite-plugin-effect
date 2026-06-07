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
      sharedPath: "./src/shared.ts",
    })
    expect(plugin.name).toBe("vite-plugin-effect")
  })

  test("does not set appType to custom", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
    })
    const config = plugin.config?.()
    expect(config).toBeUndefined()
  })

  test("resolves virtual module id", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
    })
    const resolvedId = plugin.resolveId?.("virtual:effect/client", "", {})
    expect(resolvedId).toBe("\0virtual:effect/client")
  })

  test("resolves custom virtual module id", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      virtualModuleId: "virtual:my-api",
    })
    const resolvedId = plugin.resolveId?.("virtual:my-api", "", {})
    expect(resolvedId).toBe("\0virtual:my-api")
  })

  test("generates virtual module that re-exports generated client by default", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "http",
    })

    plugin.configResolved?.(createMockConfig())

    const code = plugin.load?.("\0virtual:effect/client")
    expect(code).toBeDefined()
    expect(code).toContain("export { client, effectClient, promiseClient }")
    expect(code).toContain("/tmp/vite-plugin-effect-test/src/effect-client.ts")
  })

  test("throws for inline virtual client without custom content", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "http",
      clientPath: false,
    })

    plugin.configResolved?.(createMockConfig())

    expect(() => plugin.load?.("\0virtual:effect/client")).toThrow()
  })

  test("generates http client code with custom export name", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "http",
      exportName: "MyCustomApi",
    })

    plugin.configResolved?.(createMockConfig())

    const code = plugin.load?.("\0virtual:effect/client")
    expect(code).toBeDefined()
    expect(code).toContain("effect-client.ts")
    expect(code).not.toContain("MyApi")
  })

  test("generates rpc client code with default export name", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "rpc",
      rpcPath: "/rpc",
    })

    plugin.configResolved?.(createMockConfig())

    const code = plugin.load?.("\0virtual:effect/client")
    expect(code).toBeDefined()
    expect(code).toContain("effect-client.ts")
  })

  test("generates rpc client code with custom export name", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "rpc",
      exportName: "myRpcGroup",
    })

    plugin.configResolved?.(createMockConfig())

    const code = plugin.load?.("\0virtual:effect/client")
    expect(code).toBeDefined()
    expect(code).toContain("effect-client.ts")
    expect(code).not.toContain("router")
  })

  test("generates custom virtual module content", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "http",
      virtualModuleContent: ({ entry }) => {
        return `
import { customClient } from "custom-lib"
import { ${entry.exportName} } from "${entry.sharedPath}"
export const client = customClient(${entry.exportName})
`
      },
    })

    plugin.configResolved?.(createMockConfig())

    const code = plugin.load?.("\0virtual:effect/client")
    expect(code).toBeDefined()
    expect(code).toContain("customClient")
    expect(code).toContain("custom-lib")
  })

  test("mounts middleware in configureServer", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "http",
      apiPrefix: "/api",
    })

    const server = createMockServer()
    const cleanup = plugin.configureServer?.(server)
    cleanup?.()

    expect((server.middlewares as any).use).toHaveBeenCalled
  })

  test("uses default options", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
    })
    expect(plugin).toBeDefined()
  })

  test("supports custom apiPrefix as string", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "http",
      apiPrefix: "/v1",
      clientPath: "generated/client.ts",
    })

    plugin.configResolved?.(createMockConfig())

    expect(plugin.load?.("\0virtual:effect/client")).toContain("generated/client.ts")
  })

  test("supports custom apiPrefix as RegExp", () => {
    const plugin = vitePluginEffect({
      sharedPath: "./src/shared.ts",
      mode: "http",
      apiPrefix: /\/api\/v\d+/,
    })

    expect(plugin).toBeDefined()
  })

  test("writes generated declarations to custom dts path", async () => {
    const root = await mkdtemp(join(tmpdir(), "vite-plugin-effect-"))
    try {
      const plugin = vitePluginEffect({
        sharedPath: "./src/shared.ts",
        mode: "http",
        exportName: "Api",
        dts: "types/effect-client.d.ts",
      })

      await plugin.configResolved?.(createMockConfig(root))

      const content = await readFile(join(root, "types/effect-client.d.ts"), "utf8")
      expect(content).toContain('declare module "vite-plugin-effect/client"')
      expect(content).toContain('import("../src/effect-client").EffectClient')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("writes generated client to custom clientPath", async () => {
    const root = await mkdtemp(join(tmpdir(), "vite-plugin-effect-"))
    try {
      const plugin = vitePluginEffect({
        sharedPath: "./src/shared.ts",
        mode: "http",
        exportName: "Api",
        clientPath: "generated/api-client.ts",
      })

      await plugin.configResolved?.(createMockConfig(root))

      const content = await readFile(join(root, "generated/api-client.ts"), "utf8")
      expect(content).toContain('import { Api as __effectEntry0 } from "../src/shared"')
      expect(content).toContain("EffectHttpApiClientTypes.ForApi<typeof __effectEntry0>")
      expect(content).toContain("HttpApi.reflect")
      expect(content).not.toContain("new Proxy")
      expect(content).toContain("export const client")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("discovers http and rpc entries from serverEntry", async () => {
    const root = await mkdtemp(join(tmpdir(), "vite-plugin-effect-"))
    try {
      await mkdir(join(root, "src"), { recursive: true })
      await writeFile(join(root, "src/shared.ts"), `
import { Schema } from "effect"
import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
import { Rpc, RpcGroup } from "effect/unstable/rpc"

export const Todo = Schema.Struct({ id: Schema.Number, title: Schema.String })
const todosGroup = HttpApiGroup.make("todos").add(
  HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: Schema.Array(Todo) })
)
export const MyApi = HttpApi.make("MyApi").add(todosGroup)
export const TodoRpc = RpcGroup.make(
  Rpc.make("todoStats", { payload: {}, success: Schema.Struct({ total: Schema.Number }) })
)
`)
      await writeFile(join(root, "src/server.ts"), `
import { Layer } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RpcSerialization, RpcServer } from "effect/unstable/rpc"
import { MyApi, TodoRpc } from "./shared"

const HttpLive = HttpApiBuilder.layer(MyApi)
const RpcLive = RpcServer.layerHttp({ group: TodoRpc, path: "/rpc", protocol: "http" }).pipe(
  Layer.provide(RpcSerialization.layerJson)
)
export const MainLive = Layer.merge(HttpLive, RpcLive)
`)
      const plugin = vitePluginEffect({
        serverEntry: "./src/server.ts",
      })

      await plugin.configResolved?.(createMockConfig(root))

      const content = await readFile(join(root, "src/effect-client.ts"), "utf8")
      expect(content).toContain('import { MyApi as __effectEntry0 } from "./shared"')
      expect(content).toContain('import { TodoRpc as __effectEntry1 } from "./shared"')
      expect(content).toContain("export type ApiClient")
      expect(content).toContain("export type RpcClient")
      expect(content).toContain("EffectRpcClient.layerProtocolHttp({ url: \"/rpc\" })")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("generates direct schema type aliases from shared contracts", async () => {
    const root = await mkdtemp(join(tmpdir(), "vite-plugin-effect-"))
    try {
      await mkdir(join(root, "src"), { recursive: true })
      await writeFile(join(root, "src/shared.ts"), `
import { Schema } from "effect"
import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"

export const Todo = Schema.Struct({ id: Schema.Number, title: Schema.String })
export const TodoStats = Schema.Struct({ total: Schema.Number })

const todosGroup = HttpApiGroup.make("todos").add(
  HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: Schema.Array(Todo) })
)
export const Api = HttpApi.make("Api").add(todosGroup)
`)
      const plugin = vitePluginEffect({
        sharedPath: "./src/shared.ts",
        mode: "http",
        exportName: "Api",
      })

      await plugin.configResolved?.(createMockConfig(root))

      const content = await readFile(join(root, "src/effect-client.ts"), "utf8")
      expect(content).toContain('export type Todo = SchemaType<typeof import("./shared").Todo>')
      expect(content).toContain('export type TodoStats = SchemaType<typeof import("./shared").TodoStats>')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("can disable generated declarations", async () => {
    const root = await mkdtemp(join(tmpdir(), "vite-plugin-effect-"))
    try {
      const plugin = vitePluginEffect({
        sharedPath: "./src/shared.ts",
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
      entries: [
        {
          type: "http",
          name: "api",
          sharedPath: "./src/shared.ts",
          apiPrefix: /\/api\/v\d+/g,
        },
        {
          type: "rpc",
          name: "rpc",
          sharedPath: "./src/shared.ts",
          rpcPath: "/rpc",
        },
      ],
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
    expect(code).toContain('"flags": ""')
    expect(code).toContain('"rpcPath": "/rpc"')
    expect(code).toContain("startProductionServer")
    expect(code).toContain("production-runtime.js")
  })
})
