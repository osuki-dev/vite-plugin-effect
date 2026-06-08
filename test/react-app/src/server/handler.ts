import { Effect, Layer } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { RpcSerialization, RpcServer } from "effect/unstable/rpc"
import { ApiConflictError, ApiNotFound, ApiValidationError, MyApi, TodoRpc } from "./shared"
import { todoUseCase, userUseCase } from "./composition-root"
import { TodoPresenter } from "./presenter/todo-presenter"
import { UserPresenter } from "./presenter/user-presenter"

const validationError = (message: string, field?: string) =>
  new ApiValidationError(
    field === undefined
      ? {
          code: "VALIDATION_FAILED",
          message,
        }
      : {
          code: "VALIDATION_FAILED",
          message,
          field,
        }
  )

const notFoundError = (resource: string, id: number | string) =>
  new ApiNotFound({
    code: "NOT_FOUND",
    message: `${resource} ${id} was not found`,
    resource,
    id: String(id),
  })

const conflictError = (resource: string, message: string) =>
  new ApiConflictError({
    code: "CONFLICT",
    message,
    resource,
  })

const validateTitle = (title: string | undefined): Effect.Effect<string, ApiValidationError> => {
  const trimmed = title?.trim()
  return trimmed && trimmed.length > 0
    ? Effect.succeed(trimmed)
    : Effect.fail(validationError("Title is required", "title"))
}

const validateUserPayload = (
  payload: { readonly name?: string; readonly email?: string }
): Effect.Effect<{ readonly name: string; readonly email: string }, ApiValidationError> => {
  const name = payload.name?.trim()
  if (!name) return Effect.fail(validationError("Name is required", "name"))
  const email = payload.email?.trim()
  if (!email) return Effect.fail(validationError("Email is required", "email"))
  if (!email.includes("@")) return Effect.fail(validationError("Email must contain @", "email"))
  return Effect.succeed({ name, email })
}

const TodosLive = HttpApiBuilder.group(MyApi, "todos", (handlers) =>
  handlers
    .handle("getTodos", () =>
      Effect.succeed(TodoPresenter.presentMany(todoUseCase.getAll()))
    )
    .handle("createTodo", ({ payload }) =>
      validateTitle(payload.title).pipe(
        Effect.map((title) => TodoPresenter.present(todoUseCase.create(title)))
      ))
    .handle("deleteTodo", ({ params }) => {
      const id = Number(params.id)
      const deleted = todoUseCase.remove(id)
      return deleted
        ? Effect.succeed(TodoPresenter.present(deleted))
        : Effect.fail(notFoundError("todo", id))
    })
    .handle("updateTodo", ({ params, payload }) =>
      validateTitle(payload.title).pipe(Effect.flatMap((title) => {
        const id = Number(params.id)
        const updated = todoUseCase.update(id, title)
        return updated
          ? Effect.succeed(TodoPresenter.present(updated))
          : Effect.fail(notFoundError("todo", id))
      })))
)

const UsersLive = HttpApiBuilder.group(MyApi, "users", (handlers) =>
  handlers
    .handle("getUsers", () =>
      Effect.succeed(UserPresenter.presentMany(userUseCase.getAll()))
    )
    .handle("createUser", ({ payload }) =>
      validateUserPayload(payload).pipe(Effect.flatMap(({ name, email }) => {
        const exists = userUseCase.getAll().some((user) => user.email === email)
        return exists
          ? Effect.fail(conflictError("user", `User email ${email} already exists`))
          : Effect.succeed(UserPresenter.present(userUseCase.create(name, email)))
      })))
    .handle("deleteUser", ({ params }) => {
      const id = Number(params.id)
      const deleted = userUseCase.remove(id)
      return deleted
        ? Effect.succeed(UserPresenter.present(deleted))
        : Effect.fail(notFoundError("user", id))
    })
    .handle("updateUser", ({ params, payload }) =>
      Effect.gen(function*() {
        const { name, email } = yield* validateUserPayload(payload)
        const id = Number(params.id)
        const exists = userUseCase.getAll().some((user) => user.email === email && user.id !== id)
        if (exists) return yield* Effect.fail(conflictError("user", `User email ${email} already exists`))
        const updated = userUseCase.update(id, name, email)
        if (!updated) return yield* Effect.fail(notFoundError("user", id))
        return UserPresenter.present(updated)
      }))
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
    return todo
      ? Effect.succeed(TodoPresenter.present(todo))
      : Effect.fail(notFoundError("todo", id))
  },

  deleteTodo: ({ id }) => {
    const deleted = todoUseCase.remove(id)
    return deleted
      ? Effect.succeed(TodoPresenter.present(deleted))
      : Effect.fail(notFoundError("todo", id))
  },

  updateTodo: ({ id, title }) =>
    validateTitle(title).pipe(Effect.flatMap((validTitle) => {
      const updated = todoUseCase.update(id, validTitle)
      return updated
        ? Effect.succeed(TodoPresenter.present(updated))
        : Effect.fail(notFoundError("todo", id))
    })),
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
