# vite-plugin-effect

> **Beta**: This plugin tracks the unstable Effect 4.0 API. Breaking changes may occur until Effect 4.0 reaches stable.

Vite plugin for Effect v4 fullstack APIs. One `serverEntry` — auto-generated typed client, dev middleware, and production server.

## Install

```bash
bun add -D vite-plugin-effect
# npm install -D vite-plugin-effect
# pnpm add -D vite-plugin-effect
```

Peer dependencies: `effect` `^4.0.0-beta.78`, `vite` `^8.0.0`

## Quick Start

### 1. Define contracts

```ts
// src/shared.ts
import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { Rpc, RpcGroup } from "effect/unstable/rpc"

export const Todo = Schema.Struct({ id: Schema.Number, title: Schema.String, completed: Schema.Boolean })

export const todosGroup = HttpApiGroup.make("todos").add(
  HttpApiEndpoint.make("GET")("getTodos", "/todos", { success: Schema.Array(Todo) }),
  HttpApiEndpoint.make("POST")("createTodo", "/todos", { payload: Schema.Struct({ title: Schema.String }), success: Todo })
)

export const MyApi = HttpApi.make("MyApi").add(todosGroup)

export const TodoRpc = RpcGroup.make(
  Rpc.make("todoStats", { payload: {}, success: Schema.Struct({ total: Schema.Number, completed: Schema.Number, open: Schema.Number }) })
)
```

### 2. Implement backend

```ts
// src/server.ts
import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RpcSerialization, RpcServer } from "effect/unstable/rpc"
import { MyApi, TodoRpc } from "./shared"

const TodosLive = HttpApiBuilder.group(MyApi, "todos", (handlers) =>
  handlers
    .handle("getTodos", () => Effect.succeed([{ id: 1, title: "Learn Effect", completed: false }]))
    .handle("createTodo", ({ payload }) => Effect.succeed({ id: 2, title: payload.title, completed: false }))
)

const HttpLive = HttpApiBuilder.layer(MyApi).pipe(Layer.provide(TodosLive))

const RpcHandlersLive = TodoRpc.toLayer(Effect.succeed({
  todoStats: () => Effect.succeed({ total: 1, completed: 0, open: 1 }),
}))

const RpcLive = RpcServer.layerHttp({ group: TodoRpc, path: "/rpc", protocol: "http" })
  .pipe(Layer.provide(RpcHandlersLive), Layer.provide(RpcSerialization.layerJson))

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
      clientKind: "promise",
      serverEntry: "./src/server.ts",
    }),
  ],
})
```

### 4. Use the client

```ts
import { client } from "virtual:effect/client"
import type { Todo } from "./effect-client"

const todos = await client.api.todos.getTodos()
const created = await client.api.todos.createTodo({ title: "Hello" })
const stats = await client.rpc.todoStats({})
```

## TypeScript

```ts
/// <reference types="vite-plugin-effect/client" />
```

The plugin generates:
- `src/effect-client.ts` — typed client
- `src/effect-client.virtual.d.ts` — virtual module declarations

## Development

```bash
bun run dev
```

The plugin auto-discovers `HttpApiBuilder.layer(...)` and `RpcServer.layerHttp(...)` from `serverEntry`, generates the client, and forwards `/api/*` and `/rpc` to your Effect layer.

## Production

```bash
bun run build
node dist/server/index.js   # or bun dist/server/index.js
```

Builds:
- `dist/server/server-entry.js` — bundled Effect layer
- `dist/server/index.js` — runnable fullstack server

Runtime `HOST` and `PORT` env vars override defaults.

### Cloudflare Workers

Set the production platform to `cloudflare` and use the generated Worker entry:

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

The generated Worker handles API/RPC routes. Cloudflare assets continue to serve the SPA; `run_worker_first` prevents `/api/*` and `/rpc` from being handled by the SPA fallback.

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `entries` | `ClientEntry[]` | — | Multiple HTTP/RPC contracts to expose from one app. |
| `clientKind` | `"effect" \| "promise"` | `"promise"` | Controls default `client`; `effectClient` and `promiseClient` are still exported. |
| `sharedPath` | `string` | — | Legacy single-entry contract path. Usually unnecessary when `serverEntry` is configured. |
| `mode` | `"http" \| "rpc"` | `"http"` | Legacy single-entry mode. |
| `exportName` | `string` | `"MyApi"` / `"router"` | Legacy single-entry contract export. |
| `apiPrefix` | `string \| RegExp` | `"/api"` | Dev middleware mount for HTTP APIs. |
| `rpcPath` | `string` | `"/rpc"` | Dev middleware mount for RPC. `/rpc/` is normalized too. |
| `clientPath` | `string \| false` | `"src/effect-client.ts"` | Generated typed client file. |
| `dts` | `string \| false` | `"src/effect-client.virtual.d.ts"` | Virtual module declaration shim. |
| `serverEntry` | `string` | — | Server-only module that exports `MainLive`, `ServerLive`, `default`, or legacy `handler`. |
| `serverExport` | `string \| string[]` | `["MainLive","ServerLive","default"]` | Export names tried for the backend layer. |
| `virtualModuleId` | `string` | `"virtual:effect/client"` | Custom virtual module id. |
| `virtualModuleContent` | `function` | — | Advanced override for generated virtual module source. |
| `serverBuildEntry` | `string` | — | Optional production server build entry. |
| `serverOutDir` | `string` | `"dist/server"` | Optional production server output dir. |
| `productionServer` | `false \| object` | enabled | Emits `serverOutDir/index.js`; configure `entry`, `host`, `port`, `spaFallback`, and `platform` (`"node"` or `"cloudflare"`). |
| `ssr` | `false \| object` | — | SSR entry file and external packages for the SSR bundle build.

## How It Works

```text
client.api.todos.getTodos()
  -> /api/todos -> HttpApiBuilder layer

client.rpc.todoStats({})
  -> /rpc/ -> RpcServer.layerHttp
```

## Architecture

```text
PluginOrchestrator
  ├─ BuildPipeline (production build steps)
  ├─ SsrStrategy (SSR dev middleware + build)
  ├─ ServerLoader (unified dev/preview API loading)
  ├─ ClientGenerator (typed client code)
  ├─ StaticFileServer (production static assets)
  └─ SsrRenderer (production SSR)
```

## License

MIT
