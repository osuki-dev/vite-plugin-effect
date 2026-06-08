import { Schema } from "effect"
import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
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

export class ApiValidationError extends Schema.TaggedErrorClass<ApiValidationError>()(
  "ApiValidationError",
  {
    code: Schema.Literal("VALIDATION_FAILED"),
    message: Schema.String,
    field: Schema.optional(Schema.String),
  },
  { httpApiStatus: 422 }
) {}

export class ApiConflictError extends Schema.TaggedErrorClass<ApiConflictError>()(
  "ApiConflictError",
  {
    code: Schema.Literal("CONFLICT"),
    message: Schema.String,
    resource: Schema.String,
  },
  { httpApiStatus: 409 }
) {}

export const ApiError = Schema.Union([ApiNotFound, ApiValidationError, ApiConflictError])

export const Todo = Schema.Struct({
  id: Schema.Number,
  title: Schema.String,
  completed: Schema.Boolean,
})

export const User = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  email: Schema.String,
})

export const TodoUpdate = Schema.Struct({
  title: Schema.optional(Schema.String),
  completed: Schema.optional(Schema.Boolean),
})

export const UserUpdate = Schema.Struct({
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
})

export const todosGroup = HttpApiGroup.make("todos").add(
  HttpApiEndpoint.make("GET")("getTodos", "/todos", {
    success: Schema.Array(Todo),
  }),
  HttpApiEndpoint.make("POST")("createTodo", "/todos", {
    payload: Schema.Struct({ title: Schema.String }),
    success: Todo,
    error: ApiValidationError,
  }),
  HttpApiEndpoint.make("DELETE")("deleteTodo", "/todos/:id", {
    params: { id: Schema.NumberFromString },
    success: Todo,
    error: ApiNotFound,
  }),
  HttpApiEndpoint.make("PATCH")("updateTodo", "/todos/:id", {
    params: { id: Schema.NumberFromString },
    payload: TodoUpdate,
    success: Todo,
    error: [ApiNotFound, ApiValidationError],
  })
)

export const usersGroup = HttpApiGroup.make("users").add(
  HttpApiEndpoint.make("GET")("getUsers", "/users", {
    success: Schema.Array(User),
  }),
  HttpApiEndpoint.make("POST")("createUser", "/users", {
    payload: Schema.Struct({ name: Schema.String, email: Schema.String }),
    success: User,
    error: [ApiValidationError, ApiConflictError],
  }),
  HttpApiEndpoint.make("DELETE")("deleteUser", "/users/:id", {
    params: { id: Schema.NumberFromString },
    success: User,
    error: ApiNotFound,
  }),
  HttpApiEndpoint.make("PATCH")("updateUser", "/users/:id", {
    params: { id: Schema.NumberFromString },
    payload: UserUpdate,
    success: User,
    error: [ApiNotFound, ApiValidationError, ApiConflictError],
  })
)

export const MyApi = HttpApi.make("MyApi").add(todosGroup).add(usersGroup)

export const TodoStats = Schema.Struct({
  total: Schema.Number,
  completed: Schema.Number,
  open: Schema.Number,
})

export const TodoRpc = RpcGroup.make(
  Rpc.make("todoStats", {
    payload: {
      completed: Schema.optional(Schema.Boolean),
    },
    success: TodoStats,
    error: ApiError,
  }),
  Rpc.make("toggleTodo", {
    payload: {
      id: Schema.Number,
    },
    success: Todo,
    error: ApiError,
  }),
  Rpc.make("deleteTodo", {
    payload: {
      id: Schema.Number,
    },
    success: Todo,
    error: ApiError,
  }),
  Rpc.make("updateTodo", {
    payload: {
      id: Schema.Number,
      title: Schema.String,
    },
    success: Todo,
    error: ApiError,
  })
)
