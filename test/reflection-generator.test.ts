import { test, expect } from "bun:test"
import { Schema } from "effect"
import { HttpApi, HttpApiGroup, HttpApiEndpoint } from "effect/unstable/httpapi"
import { reflectHttpApi, generateHttpClient } from "../src/reflection-generator"
import { collectSchemas } from "../src/reflection-generator/schema-reflector"

test("reflection generator - http client", () => {
  const Book = Schema.Struct({
    id: Schema.String,
    title: Schema.String,
    author: Schema.String
  }).pipe(Schema.annotate({ identifier: "Book" }))

  const BookApi = HttpApi.make("BookApi").add(
    HttpApiGroup.make("books").add(
      HttpApiEndpoint.get("list", "/api/books", { success: Schema.Array(Book) })
    )
  )

  const info = reflectHttpApi(BookApi, "BookApi")
  expect(info.identifier).toBe("BookApi")
  expect(info.endpoints.length).toBe(1)
  expect(info.endpoints[0].name).toBe("list")
  expect(info.endpoints[0].method).toBe("GET")
  expect(info.endpoints[0].path).toBe("/api/books")
  expect(info.endpoints[0].success).toBeDefined()

  const code = generateHttpClient(info, { clientKind: "effect", baseUrl: "/api" })
  expect(code).toContain("const BookApi = HttpApi.make")
  expect(code).toContain('HttpApiEndpoint.make("GET")')
  expect(code).toContain("HttpApiClient.make")
  expect(code).toContain("const Book = Schema.Struct")
  expect(code).toContain("export type Book")
  expect(code).toContain("export const effectClient")
})

test("schema reflection exports only user-facing types", () => {
  class ApiNotFound extends Schema.TaggedErrorClass<ApiNotFound>()(
    "ApiNotFound",
    {
      code: Schema.Literal("NOT_FOUND"),
      message: Schema.String,
      resource: Schema.String,
      id: Schema.String,
    },
    { httpApiStatus: 404 }
  ) {}
  class ApiValidationError extends Schema.TaggedErrorClass<ApiValidationError>()(
    "ApiValidationError",
    {
      code: Schema.Literal("VALIDATION_FAILED"),
      message: Schema.String,
      field: Schema.optional(Schema.String),
    },
    { httpApiStatus: 422 }
  ) {}
  class ApiConflictError extends Schema.TaggedErrorClass<ApiConflictError>()(
    "ApiConflictError",
    {
      code: Schema.Literal("CONFLICT"),
      message: Schema.String,
      resource: Schema.String,
    },
    { httpApiStatus: 409 }
  ) {}

  const Todo = Schema.Struct({
    id: Schema.Number,
    title: Schema.String,
  })
  const TodoUpdate = Schema.Struct({
    title: Schema.optional(Schema.String),
  })
  const ApiError = Schema.Union([ApiNotFound, ApiValidationError, ApiConflictError])
  const schemaNames = new Map<Schema.Top, string>([
    [ApiNotFound, "ApiNotFound"],
    [ApiValidationError, "ApiValidationError"],
    [ApiConflictError, "ApiConflictError"],
    [Todo, "Todo"],
    [TodoUpdate, "TodoUpdate"],
    [ApiError, "ApiError"],
  ])

  const registry = collectSchemas([
    Schema.Array(Todo),
    Schema.Struct({ title: Schema.String }),
    Schema.Struct({ id: Schema.Number, title: Schema.String }),
    TodoUpdate,
    ApiError,
  ], schemaNames)
  const typeAliases = registry.typeAliases.join("\n")
  const declarations = registry.declarations.join("\n")

  expect(declarations).not.toContain("const Struct")
  expect(declarations).not.toContain("const Tuple")
  expect(declarations).not.toContain("ApiNotFound1")
  expect(typeAliases).not.toContain("type Struct")
  expect(typeAliases).not.toContain("type Tuple")
  expect(typeAliases).not.toContain("ApiNotFound1")
  expect(typeAliases).not.toContain("ApiValidationError1")
  expect(typeAliases).not.toContain("ApiConflictError1")
  expect(typeAliases).toContain("export type Todo = Schema.Schema.Type<typeof Todo>")
  expect(typeAliases).toContain("export type TodoUpdate = Schema.Schema.Type<typeof TodoUpdate>")
  expect(typeAliases).toContain("export type ApiNotFound = Schema.Schema.Type<typeof ApiNotFound>")
  expect(typeAliases).toContain("export type ApiValidationError = Schema.Schema.Type<typeof ApiValidationError>")
  expect(typeAliases).toContain("export type ApiConflictError = Schema.Schema.Type<typeof ApiConflictError>")
  expect(typeAliases).toContain("export type ApiError = Schema.Schema.Type<typeof ApiError>")
})

test("schema reflection keeps Effect 4 class schema declarations", () => {
  class User extends Schema.Class<User>("User")({
    id: Schema.Number,
    name: Schema.String,
  }) {}
  class ApiNotFound extends Schema.TaggedErrorClass<ApiNotFound>()(
    "ApiNotFound",
    {
      id: Schema.Number,
      message: Schema.String,
    },
    { httpApiStatus: 404 }
  ) {}

  const registry = collectSchemas([User, ApiNotFound], new Map<Schema.Top, string>([
    [User, "User"],
    [ApiNotFound, "ApiNotFound"],
  ]))
  const declarations = registry.declarations.join("\n")

  expect(declarations).toContain('const User = class User extends Schema.Class<User>("User")')
  expect(declarations).toContain("const ApiNotFound = class ApiNotFound extends Schema.TaggedErrorClass<ApiNotFound>()")
  expect(declarations).toContain('"message": Schema.String')
  expect(declarations).toContain('{ "httpApiStatus": 404 }')
  expect(declarations).not.toContain("const User = Schema.Struct")
  expect(declarations).not.toContain("const ApiNotFound = Schema.Struct")
})

test("reflection generator reuses repeated anonymous schemas", () => {
  const Todo = Schema.Struct({
    id: Schema.Number,
    title: Schema.String,
  })

  const TodoApi = HttpApi.make("TodoApi").add(
    HttpApiGroup.make("todos").add(
      HttpApiEndpoint.post("createTodo", "/todos", {
        payload: Schema.Struct({ title: Schema.String }),
        success: Todo,
      }),
      HttpApiEndpoint.post("createAnotherTodo", "/todos/another", {
        payload: Schema.Struct({ title: Schema.String }),
        success: Todo,
      })
    )
  )
  const info = reflectHttpApi(TodoApi, "TodoApi", new Map<Schema.Top, string>([
    [Todo, "Todo"],
  ]))
  const code = generateHttpClient(info, { clientKind: "promise", baseUrl: "/api" })

  expect(code).toContain('const __schema0 = Schema.Struct({ "title": Schema.String })')
  expect(code.match(/payload: __schema0/g)?.length).toBe(2)
  expect(code).not.toContain("export type __schema0")
})

test("reflection generator preserves multiple error schemas", () => {
  class ApiNotFound extends Schema.TaggedErrorClass<ApiNotFound>()(
    "ApiNotFound",
    {
      code: Schema.Literal("NOT_FOUND"),
      message: Schema.String,
      resource: Schema.String,
      id: Schema.String,
    },
    { httpApiStatus: 404 }
  ) {}
  class ApiValidationError extends Schema.TaggedErrorClass<ApiValidationError>()(
    "ApiValidationError",
    {
      code: Schema.Literal("VALIDATION_FAILED"),
      message: Schema.String,
      field: Schema.optional(Schema.String),
    },
    { httpApiStatus: 422 }
  ) {}

  const Todo = Schema.Struct({
    id: Schema.Number,
    title: Schema.String,
  })
  const TodoApi = HttpApi.make("TodoApi").add(
    HttpApiGroup.make("todos").add(
      HttpApiEndpoint.patch("updateTodo", "/todos/:id", {
        params: { id: Schema.NumberFromString },
        payload: Schema.Struct({ title: Schema.String }),
        success: Todo,
        error: [ApiNotFound, ApiValidationError],
      })
    )
  )
  const info = reflectHttpApi(TodoApi, "TodoApi", new Map<Schema.Top, string>([
    [ApiNotFound, "ApiNotFound"],
    [ApiValidationError, "ApiValidationError"],
    [Todo, "Todo"],
  ]))
  const code = generateHttpClient(info, { clientKind: "promise", baseUrl: "/api" })

  expect(code).not.toContain("const Union")
  expect(code).toContain("error: Schema.Union([ApiNotFound, ApiValidationError])")
  expect(code).not.toContain("export type Union")
})
