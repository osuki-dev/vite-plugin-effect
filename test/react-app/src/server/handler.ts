import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RpcSerialization, RpcServer } from "effect/unstable/rpc"
import { MyApi, TodoRpc } from "./shared"
import { todoUseCase, userUseCase } from "./composition-root"
import { TodoPresenter } from "./presenter/todo-presenter"
import { UserPresenter } from "./presenter/user-presenter"

const TodosLive = HttpApiBuilder.group(MyApi, "todos", (handlers) =>
  handlers
    .handle("getTodos", () =>
      Effect.succeed(TodoPresenter.presentMany(todoUseCase.getAll()))
    )
    .handle("createTodo", ({ payload }) => {
      const todo = todoUseCase.create(payload.title)
      return Effect.succeed(TodoPresenter.present(todo))
    })
    .handle("deleteTodo", ({ params }) => {
      const id = Number(params.id)
      const deleted = todoUseCase.remove(id)
      return Effect.succeed(TodoPresenter.present(deleted))
    })
    .handle("updateTodo", ({ params, payload }) => {
      const id = Number(params.id)
      const updated = todoUseCase.update(id, payload.title ?? "")
      return Effect.succeed(TodoPresenter.present(updated))
    })
)

const UsersLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  handlers
    .handle("getUsers", () =>
      Effect.succeed(UserPresenter.presentMany(userUseCase.getAll()))
    )
    .handle("createUser", ({ payload }) => {
      const user = userUseCase.create(payload.name, payload.email)
      return Effect.succeed(UserPresenter.present(user))
    })
    .handle("deleteUser", ({ params }) => {
      const id = Number(params.id)
      const deleted = userUseCase.remove(id)
      return Effect.succeed(UserPresenter.present(deleted))
    })
    .handle("updateUser", ({ params, payload }) => {
      const id = Number(params.id)
      const updated = userUseCase.update(id, payload.name ?? "", payload.email ?? "")
      return Effect.succeed(UserPresenter.present(updated))
    })
)

const HttpLive = HttpApiBuilder.layer(MyApi).pipe(
  Layer.provide(TodosLive),
  Layer.provide(UsersLive)
)

const TodoRpcHandlersLive = TodoRpc.toLayer(Effect.succeed({
  todoStats: ({ completed }) => {
    const scopedTodos = completed === undefined
      ? todoUseCase.getAll()
      : todoUseCase.getAll().filter(todo => todo.completed === completed)
    return Effect.succeed(TodoPresenter.presentStats({
      total: scopedTodos.length,
      completed: scopedTodos.filter(todo => todo.completed).length,
      open: scopedTodos.filter(todo => !todo.completed).length,
    }))
  },

  toggleTodo: ({ id }) => {
    const todo = todoUseCase.toggle(id)
    return Effect.succeed(TodoPresenter.present(todo))
  },

  deleteTodo: ({ id }) => {
    const deleted = todoUseCase.remove(id)
    return Effect.succeed(TodoPresenter.present(deleted))
  },

  updateTodo: ({ id, title }) => {
    const updated = todoUseCase.update(id, title)
    return Effect.succeed(TodoPresenter.present(updated))
  },
}))

const RpcLive = RpcServer.layerHttp({
  group: TodoRpc,
  path: "/rpc",
  protocol: "http",
}).pipe(
  Layer.provide(TodoRpcHandlersLive),
  Layer.provide(RpcSerialization.layerJson)
)

export const MainLive = Layer.merge(HttpLive, RpcLive)
export const ServerLive = MainLive
