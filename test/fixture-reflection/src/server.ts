import { Effect, Layer } from "effect"
import { Schema } from "effect"
import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
import { HttpApiBuilder } from "effect/unstable/httpapi"

export const Todo = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  completed: Schema.Boolean,
}).pipe(Schema.annotate({ identifier: "Todo" }))

export const todosGroup = HttpApiGroup.make("todos").add(
  HttpApiEndpoint.get("getTodos", "/todos", {
    success: Schema.Array(Todo),
  })
)

export const MyApi = HttpApi.make("MyApi").add(todosGroup)

const TodosLive = HttpApiBuilder.group(MyApi, "todos", (handlers) =>
  handlers
    .handle("getTodos", () =>
      Effect.succeed([
        { id: 1, title: "Learn Effect", completed: false },
      ])
    )
)

export const ServerLive = HttpApiBuilder.layer(MyApi).pipe(
  Layer.provide(TodosLive)
)

// Legacy handler for dev server
export default async function handler(req: any, res: any) {
  const url = req.url || "/"
  if (url === "/api/todos" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify([{ id: 1, title: "Learn Effect", completed: false }]))
    return
  }
  res.writeHead(404)
  res.end("Not Found")
}
