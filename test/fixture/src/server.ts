import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { MyApi } from "./shared"

// Implement handlers for the "todos" group
const TodosLive = HttpApiBuilder.group(MyApi, "todos", (handlers) =>
  handlers
    .handle("getTodos", () =>
      Effect.succeed([
        { id: 1, title: "Learn Effect", completed: false },
      ])
    )
    .handle("createTodo", ({ payload }) =>
      Effect.succeed({
        id: 2,
        title: payload.title,
        completed: false,
      })
    )
)

// Assemble the full server layer
export const ServerLive = HttpApiBuilder.layer(MyApi).pipe(
  Layer.provide(TodosLive)
)
