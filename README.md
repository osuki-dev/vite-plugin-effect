# vite-plugin-effect

> Beta: this plugin tracks the unstable Effect 4 API. Breaking changes may occur until Effect 4 reaches stable.

Vite plugin for Effect 4 fullstack APIs. Point it at one server entry and it reflects your `HttpApi` and `RpcGroup` definitions into a typed frontend client.

## Install

```bash
bun add -D vite-plugin-effect
# npm install -D vite-plugin-effect
# pnpm add -D vite-plugin-effect
```

Peer dependencies: `effect` `^4.0.0-beta.78`, `vite` `^8.0.0`.

## Quick Start

### 1. Define API contracts

Use normal Effect 4 APIs. Contracts can live next to the server or in a shared module; the plugin discovers them from the server entry instead of requiring a special client-only layout.

```ts
// src/server/shared.ts
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { Rpc, RpcGroup } from "effect/unstable/rpc"

export class ApiNotFound extends Schema.TaggedErrorClass<ApiNotFound>()(
  "ApiNotFound",
  {
    code: Schema.Literal("NOT_FOUND"),
    message: Schema.String,
    resource: Schema.String,
    id: Schema.String,
  },
  { httpApiStatus: 404 }
) {}

export const Todo = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  completed: Schema.Boolean,
})

export const TodoStats = Schema.Struct({
  total: Schema.Number,
  completed: Schema.Number,
  open: Schema.Number,
})

const Todos = HttpApiGroup.make("todos").add(
  HttpApiEndpoint.make("GET")("getTodos", "/todos", {
    success: Schema.Array(Todo),
  }),
  HttpApiEndpoint.make("DELETE")("deleteTodo", "/todos/:id", {
    params: { id: Schema.NumberFromString },
    success: Todo,
    error: ApiNotFound,
  })
)

export const MyApi = HttpApi.make("MyApi").add(Todos)

export const TodoRpc = RpcGroup.make(
  Rpc.make("todoStats", {
    payload: {},
    success: TodoStats,
  })
)
```

### 2. Implement the server

```ts
// src/server.ts
import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RpcSerialization, RpcServer } from "effect/unstable/rpc"
import { ApiNotFound, MyApi, TodoRpc } from "./server/shared"

const todos = [{ id: 1, title: "Learn Effect", completed: false }]

const TodosLive = HttpApiBuilder.group(MyApi, "todos", (handlers) =>
  handlers
    .handle("getTodos", () => Effect.succeed(todos))
    .handle("deleteTodo", ({ params }) => {
      const todo = todos.find((item) => item.id === Number(params.id))
      return todo
        ? Effect.succeed(todo)
        : Effect.fail(new ApiNotFound({
            code: "NOT_FOUND",
            message: `todo ${params.id} was not found`,
            resource: "todo",
            id: String(params.id),
          }))
    })
)

const HttpLive = HttpApiBuilder.layer(MyApi).pipe(Layer.provide(TodosLive))

const RpcHandlersLive = TodoRpc.toLayer(Effect.succeed({
  todoStats: () =>
    Effect.succeed({
      total: todos.length,
      completed: todos.filter((todo) => todo.completed).length,
      open: todos.filter((todo) => !todo.completed).length,
    }),
}))

const RpcLive = RpcServer.layerHttp({
  group: TodoRpc,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(RpcHandlersLive),
  Layer.provide(RpcSerialization.layerJson)
)

export const MainLive = Layer.merge(HttpLive, RpcLive)
```

### 3. Configure Vite

```ts
// vite.config.ts
import { defineConfig } from "vite"
import vitePluginEffect from "vite-plugin-effect"

export default defineConfig({
  plugins: [
    vitePluginEffect({
      serverEntry: "./src/server.ts",
      clientKind: "promise",
    }),
  ],
})
```

### 4. Use the client

```ts
import { Effect } from "effect"
import { client, effectClient, promiseClient } from "virtual:effect/client"
import type { Api, Rpc, Todo, TodoStats } from "virtual:effect/client"

const todos: readonly Todo[] = await client.api.todos.getTodos()

const deleted = await promiseClient.api.todos.deleteTodo({
  params: { id: 1 },
})

const effect = effectClient.rpc.todoStats({})
const stats: TodoStats = await Effect.runPromise(effect)

type DeleteParams = Api.todos.deleteTodo.Params
type TodoStatsPayload = Rpc.todoStats.Payload
```

Add the client types once in your app:

```ts
/// <reference types="vite-plugin-effect/client" />
```

## Generated Client

The plugin writes:

- `src/effect-client.ts`: the generated typed client.
- `src/effect-client.virtual.d.ts`: the declaration shim for `virtual:effect/client`.

Exports are intentionally small and stable:

- `client`: default client selected by `clientKind`.
- `promiseClient`: methods return `Promise`.
- `effectClient`: official Effect HTTP/RPC clients; methods return `Effect` or streams.
- Schema-derived public types such as `Todo`, `ApiNotFound`, and `TodoStats`.
- Method namespaces such as `Api.todos.deleteTodo.Params` and `Rpc.todoStats.Success`.

The generator does not emit duplicate anonymous `Struct` / `Union` / `Tuple` type aliases. Public schema types are derived from the generated schema value with `Schema.Schema.Type<typeof Name>`, and reused anonymous schemas are emitted once as private `__schemaN` constants.

## Reflection Model

`serverEntry` is loaded only by Vite during dev/build. The generator reflects the exported Effect layer and uses Effect 4's official HTTP/RPC metadata:

- `HttpApi.reflect`
- `HttpApiEndpoint.getPayloadSchemas`
- `HttpApiEndpoint.getSuccessSchemas`
- `HttpApiEndpoint.getErrorSchemas`
- `RpcGroup` reflection

This keeps the generated client aligned with the real API object used by the server. There is no second handwritten API contract for the frontend to drift from.

## Source Boundary

Server implementation code is not copied into the client. The generated file contains the public wire contract: endpoint names, paths, schema shapes, status annotations, and error schemas. Treat exported schemas as API surface, not private server source.

## Performance

Large APIs are generated as static objects. Promise clients call the reflected Effect client directly; they do not walk endpoint arrays or search metadata per request. Schema output is deduplicated by AST fingerprint so repeated shapes are shared in the generated module.

The generated client imports `effect` because it is an Effect client. If your frontend uses this plugin, `effect` is part of the frontend contract. Use `promiseClient` when the application code wants Promise ergonomics, and `effectClient` when it wants native Effect composition.

## Development

```bash
bun run dev
```

In dev, the plugin:

- reflects `serverEntry` and writes the client file;
- serves `virtual:effect/client`;
- forwards `/api/*` to `HttpApiBuilder` layers;
- forwards `/rpc` and `/rpc/*` to `RpcServer.layerHttp`.

## Production

```bash
bun run build
node dist/server/index.js
```

Build output:

- `dist/server/server-entry.js`: bundled Effect server layer.
- `dist/server/index.js`: runnable fullstack server.

Runtime `HOST` and `PORT` env vars override defaults.

### Cloudflare Workers

```ts
vitePluginEffect({
  serverEntry: "./src/server.ts",
  productionServer: {
    platform: "cloudflare",
  },
})
```

```jsonc
{
  "main": "./dist/server/index.js",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api", "/api/*", "/rpc", "/rpc/*"]
  }
}
```

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `serverEntry` | `string` | - | Server module used for API/RPC reflection and dev middleware loading. |
| `serverExport` | `string \| string[]` | `["MainLive","ServerLive","default"]` | Export names tried for the backend layer. |
| `clientKind` | `"effect" \| "promise"` | `"promise"` | Controls the default `client`; both `effectClient` and `promiseClient` are always exported. |
| `clientPath` | `string \| false` | `"src/effect-client.ts"` | Generated typed client file. |
| `dts` | `string \| false` | `"src/effect-client.virtual.d.ts"` | Virtual module declaration shim. |
| `virtualModuleId` | `string` | `"virtual:effect/client"` | Custom virtual module id. |
| `serverBuildEntry` | `string` | - | Optional production server build entry. |
| `serverOutDir` | `string` | `"dist/server"` | Production server output directory. |
| `productionServer` | `false \| object` | enabled | Emits `serverOutDir/index.js`; configure `entry`, `host`, `port`, `spaFallback`, and `platform`. |
| `ssr` | `false \| object` | - | SSR entry file and external packages for the SSR bundle build. |

## License

MIT
