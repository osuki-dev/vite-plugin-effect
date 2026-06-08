import { describe, test, expect } from "bun:test"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { ResolvedConfig } from "vite"
import { discoverEntriesFromServerEntry } from "../src/discovery.ts"

const createMockConfig = (root: string): ResolvedConfig => ({
  root,
  command: "serve",
  build: { outDir: "dist" },
} as any)

const createFixture = async (root: string, files: Record<string, string>) => {
  for (const [filePath, content] of Object.entries(files)) {
    const fullPath = join(root, filePath)
    await mkdir(join(fullPath, ".."), { recursive: true })
    await writeFile(fullPath, content)
  }
}

describe("discoverEntriesFromServerEntry", () => {
  test("discovers HTTP API from simple named imports", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const todosGroup = HttpApiGroup.make("todos").add(
            HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: HttpApiEndpoint.make("GET") })
          )
          export const MyApi = HttpApi.make("MyApi").add(todosGroup)
        `,
        "src/server.ts": `
          import { HttpApiBuilder } from "effect/unstable/httpapi"
          import { MyApi } from "./shared"
          const HttpLive = HttpApiBuilder.layer(MyApi)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].type).toBe("http")
      expect(entries[0].exportName).toBe("MyApi")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("discovers aliased imports", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const todosGroup = HttpApiGroup.make("todos").add(
            HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: HttpApiEndpoint.make("GET") })
          )
          export const MyApi = HttpApi.make("MyApi").add(todosGroup)
        `,
        "src/server.ts": `
          import { HttpApiBuilder } from "effect/unstable/httpapi"
          import { MyApi as Api } from "./shared"
          const HttpLive = HttpApiBuilder.layer(Api)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].exportName).toBe("MyApi")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("discovers type imports", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const todosGroup = HttpApiGroup.make("todos").add(
            HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: HttpApiEndpoint.make("GET") })
          )
          export const MyApi = HttpApi.make("MyApi").add(todosGroup)
        `,
        "src/server.ts": `
          import { HttpApiBuilder } from "effect/unstable/httpapi"
          import type { MyApi } from "./shared"
          const HttpLive = HttpApiBuilder.layer(MyApi)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].exportName).toBe("MyApi")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("discovers multiple import statements", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const todosGroup = HttpApiGroup.make("todos").add(
            HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: HttpApiEndpoint.make("GET") })
          )
          export const MyApi = HttpApi.make("MyApi").add(todosGroup)
        `,
        "src/server.ts": `
          import { HttpApiBuilder } from "effect/unstable/httpapi"
          import { MyApi } from "./shared"
          import { Layer } from "effect"
          const HttpLive = HttpApiBuilder.layer(MyApi)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("ignores default imports", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const todosGroup = HttpApiGroup.make("todos").add(
            HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: HttpApiEndpoint.make("GET") })
          )
          export const MyApi = HttpApi.make("MyApi").add(todosGroup)
        `,
        "src/server.ts": `
          import { HttpApiBuilder } from "effect/unstable/httpapi"
          import MyApi from "./shared"
          const HttpLive = HttpApiBuilder.layer(MyApi)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].exportName).toBe("MyApi")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("ignores generic type parameters (known limitation)", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const todosGroup = HttpApiGroup.make("todos").add(
            HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: HttpApiEndpoint.make("GET") })
          )
          export const MyApi = HttpApi.make("MyApi").add(todosGroup)
        `,
        "src/server.ts": `
          import { HttpApiBuilder } from "effect/unstable/httpapi"
          import { SomeType<T, U> } from "./shared"
          const HttpLive = HttpApiBuilder.layer(MyApi)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].exportName).toBe("MyApi")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("finds HttpApiBuilder.layer and group calls", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const todosGroup = HttpApiGroup.make("todos").add(
            HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: HttpApiEndpoint.make("GET") })
          )
          export const MyApi = HttpApi.make("MyApi").add(todosGroup)
        `,
        "src/server.ts": `
          import { HttpApiBuilder } from "effect/unstable/httpapi"
          import { MyApi } from "./shared"
          const TodosLive = HttpApiBuilder.group(MyApi, "todos", (handlers) => handlers)
          const HttpLive = HttpApiBuilder.layer(MyApi)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].exportName).toBe("MyApi")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("discovers local non-exported HTTP API expressions", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/server.ts": `
          import { Effect, Layer, Schema } from "effect"
          import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
          const Todo = Schema.Struct({ id: Schema.Number })
          const MyApi = HttpApi.make("MyApi").add(
            HttpApiGroup.make("todos").add(
              HttpApiEndpoint.get("getTodos", "/todos", { success: Schema.Array(Todo) })
            )
          )
          const TodosLive = HttpApiBuilder.group(MyApi, "todos", handlers =>
            handlers.handle("getTodos", () => Effect.succeed([]))
          )
          export const ServerLive = HttpApiBuilder.layer(MyApi).pipe(Layer.provide(TodosLive))
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["ServerLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].type).toBe("http")
      expect(entries[0].exportName).toBe("MyApi")
      expect(entries[0].reflectionExpression).toBe("MyApi")
      expect(entries[0].reflectionName).toBe("__vitePluginEffectContract0")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("discovers inline HTTP API expressions", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/server.ts": `
          import { HttpApi, HttpApiBuilder, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
          export const ServerLive = HttpApiBuilder.layer(
            HttpApi.make("InlineApi").add(
              HttpApiGroup.make("health").add(HttpApiEndpoint.get("ping", "/ping"))
            )
          )
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["ServerLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].type).toBe("http")
      expect(entries[0].exportName).toBe("InlineApi")
      expect(entries[0].reflectionExpression).toContain('HttpApi.make("InlineApi")')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("finds different API names", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const todosGroup = HttpApiGroup.make("todos").add(
            HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: HttpApiEndpoint.make("GET") })
          )
          export const MyApi = HttpApi.make("MyApi").add(todosGroup)
        `,
        "src/other.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const usersGroup = HttpApiGroup.make("users").add(
            HttpApiEndpoint.make("GET")("getUsers", "/users", { success: HttpApiEndpoint.make("GET") })
          )
          export const OtherApi = HttpApi.make("OtherApi").add(usersGroup)
        `,
        "src/server.ts": `
          import { HttpApiBuilder } from "effect/unstable/httpapi"
          import { MyApi } from "./shared"
          import { OtherApi } from "./other"
          const HttpLive = HttpApiBuilder.layer(MyApi)
          const OtherLive = HttpApiBuilder.layer(OtherApi)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(2)
      expect(entries.map((e) => e.exportName)).toContain("MyApi")
      expect(entries.map((e) => e.exportName)).toContain("OtherApi")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("returns empty when no API matches", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/server.ts": `const foo = "bar"`,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )
      expect(entries).toHaveLength(0)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("finds RpcServer.layerHttp call", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { Rpc, RpcGroup } from "effect/unstable/rpc"
          export const TodoRpc = RpcGroup.make(
            Rpc.make("todoStats", { payload: {}, success: {} })
          )
        `,
        "src/server.ts": `
          import { RpcServer } from "effect/unstable/rpc"
          import { TodoRpc } from "./shared"
          const RpcLive = RpcServer.layerHttp({ group: TodoRpc, path: "/rpc", protocol: "http" })
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].type).toBe("rpc")
      expect(entries[0].exportName).toBe("TodoRpc")
      expect(entries[0].rpcPath).toBe("/rpc")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("discovers local non-exported RPC group expressions", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/server.ts": `
          import { Effect, Schema } from "effect"
          import { Rpc, RpcGroup, RpcSerialization, RpcServer } from "effect/unstable/rpc"
          const TodoRpc = RpcGroup.make(
            Rpc.make("todoStats", { payload: {}, success: Schema.Struct({ total: Schema.Number }) })
          )
          const TodoRpcLive = TodoRpc.toLayer(Effect.succeed({
            todoStats: () => Effect.succeed({ total: 1 })
          }))
          export const ServerLive = RpcServer.layerHttp({ group: TodoRpc, path: "/rpc", protocol: "http" })
            .pipe(Effect.provide(TodoRpcLive), Effect.provide(RpcSerialization.layerJson))
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["ServerLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].type).toBe("rpc")
      expect(entries[0].exportName).toBe("TodoRpc")
      expect(entries[0].reflectionExpression).toBe("TodoRpc")
      expect(entries[0].rpcPath).toBe("/rpc")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("finds multiple RPC groups", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { Rpc, RpcGroup } from "effect/unstable/rpc"
          export const TodoRpc = RpcGroup.make(
            Rpc.make("todoStats", { payload: {}, success: {} })
          )
        `,
        "src/other.ts": `
          import { Rpc, RpcGroup } from "effect/unstable/rpc"
          export const OtherRpc = RpcGroup.make(
            Rpc.make("otherStats", { payload: {}, success: {} })
          )
        `,
        "src/server.ts": `
          import { RpcServer } from "effect/unstable/rpc"
          import { TodoRpc } from "./shared"
          import { OtherRpc } from "./other"
          const RpcLive = RpcServer.layerHttp({ group: TodoRpc, path: "/rpc" })
          const OtherRpcLive = RpcServer.layerHttp({ group: OtherRpc, path: "/other" })
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(2)
      expect(entries[0].exportName).toBe("TodoRpc")
      expect(entries[0].rpcPath).toBe("/rpc")
      expect(entries[1].exportName).toBe("OtherRpc")
      expect(entries[1].rpcPath).toBe("/other")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("handles missing RPC path", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/shared.ts": `
          import { Rpc, RpcGroup } from "effect/unstable/rpc"
          export const TodoRpc = RpcGroup.make(
            Rpc.make("todoStats", { payload: {}, success: {} })
          )
        `,
        "src/server.ts": `
          import { RpcServer } from "effect/unstable/rpc"
          import { TodoRpc } from "./shared"
          const RpcLive = RpcServer.layerHttp({ group: TodoRpc })
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].type).toBe("rpc")
      expect(entries[0].rpcPath).toBe("/rpc")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("falls back to local name when not imported", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/server.ts": `
          import { HttpApiBuilder } from "effect/unstable/httpapi"
          const HttpLive = HttpApiBuilder.layer(MyApi)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].exportName).toBe("MyApi")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("discovers exported HttpApi declarations directly", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/server.ts": `
          import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
          const todosGroup = HttpApiGroup.make("todos").add(
            HttpApiEndpoint.get("getTodos", "/todos", { success: {} })
          )
          export const MyApi = HttpApi.make("MyApi").add(todosGroup)
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].exportName).toBe("MyApi")
      expect(entries[0].type).toBe("http")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test("discovers exported RpcGroup declarations directly", async () => {
    const root = await mkdtemp(join(tmpdir(), "vpe-discovery-"))
    try {
      await createFixture(root, {
        "src/server.ts": `
          import { Rpc, RpcGroup } from "effect/unstable/rpc"
          export const TodoRpc = RpcGroup.make(
            Rpc.make("todoStats", { payload: {}, success: {} })
          )
        `,
      })

      const entries = await discoverEntriesFromServerEntry(
        { serverEntry: "./src/server.ts", serverExports: ["MainLive"], entries: [] } as any,
        createMockConfig(root)
      )

      expect(entries).toHaveLength(1)
      expect(entries[0].exportName).toBe("TodoRpc")
      expect(entries[0].type).toBe("rpc")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
