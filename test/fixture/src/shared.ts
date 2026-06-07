import { Schema } from "effect"
import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"

export const Todo = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  completed: Schema.Boolean,
})

export const todosGroup = HttpApiGroup.make("todos").add(
  HttpApiEndpoint.make("GET")("getTodos", "/todos", {
    success: Schema.Array(Todo),
  }),
  HttpApiEndpoint.make("POST")("createTodo", "/todos", {
    payload: Schema.Struct({ title: Schema.String }),
    success: Todo,
  })
)

export const MyApi = HttpApi.make("MyApi").add(todosGroup)
