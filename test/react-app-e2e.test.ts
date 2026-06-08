import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from "bun:test"
import { spawn, type ChildProcess } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { Effect, Scope } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { RpcClient, RpcSerialization } from "effect/unstable/rpc"
import { TodoRpc } from "./react-app/src/server/shared"

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = join(__dirname, "react-app")
const generatedClientPath = join(appDir, "src/lib/effect-client.ts")

setDefaultTimeout(30000)

async function readJson(response: Response): Promise<any> {
  const text = await response.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Expected JSON response, got: ${text}`)
  }
}

function expectApiError(
  error: any,
  expected: { readonly _tag: string; readonly code: string; readonly message?: string; readonly field?: string }
) {
  expect(error._tag).toBe(expected._tag)
  expect(error.code).toBe(expected.code)
  if (expected.message) {
    expect(error.message).toContain(expected.message)
  }
  if (expected.field) {
    expect(error.field).toBe(expected.field)
  }
}

describe("vite-plugin-effect React app e2e", () => {
  let devServer: ChildProcess
  let serverUrl: string

  beforeAll(async () => {
    devServer = spawn("bun", ["run", "dev", "--", "--host", "127.0.0.1"], {
      cwd: appDir,
      stdio: "pipe",
    })

    const output = await new Promise<string>((resolve, reject) => {
      let buffer = ""
      const timeout = setTimeout(() => reject(new Error(`Timed out waiting for dev server:\n${buffer}`)), 15000)

      devServer.stdout?.on("data", (data) => {
        buffer += data.toString()
        const match = buffer.match(/http:\/\/(?:localhost|127\.0\.0\.1):\d+/)
        if (match) {
          clearTimeout(timeout)
          resolve(buffer)
        }
      })
      devServer.stderr?.on("data", (data) => {
        buffer += data.toString()
      })
      devServer.once("exit", (code) => {
        clearTimeout(timeout)
        reject(new Error(`Dev server exited with ${code}:\n${buffer}`))
      })
    })

    const match = output.match(/http:\/\/(?:localhost|127\.0\.0\.1):\d+/)
    serverUrl = match?.[0] || "http://127.0.0.1:5173"
  })

  afterAll(() => {
    devServer.kill()
  })

  test("generated client exposes only contract code", () => {
    const client = readFileSync(generatedClientPath, "utf8")

    expect(client).toContain("export const effectClient")
    expect(client).toContain("export const promiseClient")
    expect(client).toContain("export type Todo = Schema.Schema.Type<typeof Todo>")
    expect(client).toContain("export type ApiError = Schema.Schema.Type<typeof ApiError>")
    expect(client).toContain("const ApiNotFound = class ApiNotFound extends Schema.TaggedErrorClass<ApiNotFound>()")
    expect(client).toContain("const ApiValidationError = class ApiValidationError extends Schema.TaggedErrorClass<ApiValidationError>()")
    expect(client).toContain("const ApiConflictError = class ApiConflictError extends Schema.TaggedErrorClass<ApiConflictError>()")
    expect(client).toContain("export namespace Api")
    expect(client).toContain("export namespace todos")
    expect(client).toContain("export namespace updateTodo")
    expect(client).toContain("export type Params = MethodParams<Input>")
    expect(client).toContain("export type Payload = MethodPayload<Input>")
    expect(client).toContain("export type Success = MethodSuccess<Method>")
    expect(client).toContain("export type Error = MethodError<Method>")
    expect(client).toContain("export namespace Rpc")
    expect(client).toContain("export namespace toggleTodo")
    expect(client).not.toContain("export type ApiTodos")
    expect(client).not.toContain("export type RpcToggle")
    expect(client).not.toContain("type Struct")
    expect(client).not.toContain("type Tuple")
    expect(client).not.toContain("type Union")
    expect(client).not.toContain("ApiNotFound1")
    expect(client).not.toContain("ApiValidationError1")
    expect(client).not.toContain("ApiConflictError1")
    expect(client).not.toMatch(/\bany\b/)
    expect(client).not.toMatch(/\bunknown\b/)
    expect(client).not.toContain("makeHttpPromiseClient")
    expect(client).not.toContain("makeRpcPromiseClient")

    for (const serverOnly of [
      "composition-root",
      "presenter",
      "todoUseCase",
      "userUseCase",
      "HttpApiBuilder.group",
      "RpcServer.layer",
    ]) {
      expect(client).not.toContain(serverOnly)
    }
  })

  test("API endpoints return expected data", async () => {
    const todosRes = await fetch(`${serverUrl}/api/todos`)
    expect(todosRes.status).toBe(200)
    const todos = await todosRes.json()
    expect(todos).toBeArray()
    expect(todos.length).toBeGreaterThan(0)
    expect(todos[0]).toHaveProperty("id")
    expect(todos[0]).toHaveProperty("title")
    expect(todos[0]).toHaveProperty("completed")

    const usersRes = await fetch(`${serverUrl}/api/users`)
    expect(usersRes.status).toBe(200)
    const users = await usersRes.json()
    expect(users).toBeArray()
    expect(users.length).toBeGreaterThan(0)
    expect(users[0]).toHaveProperty("id")
    expect(users[0]).toHaveProperty("name")
    expect(users[0]).toHaveProperty("email")
  })

  test("POST /api/todos creates a todo", async () => {
    const response = await fetch(`${serverUrl}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "E2E Test Todo" }),
    })
    expect(response.status).toBe(200)
    const todo = await response.json()
    expect(todo).toHaveProperty("id")
    expect(todo.title).toBe("E2E Test Todo")
    expect(todo.completed).toBe(false)
  })

  test("POST /api/users creates a user", async () => {
    const email = `e2e-${Date.now()}@example.com`
    const response = await fetch(`${serverUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "E2E User", email }),
    })
    expect(response.status).toBe(200)
    const user = await response.json()
    expect(user).toHaveProperty("id")
    expect(user.name).toBe("E2E User")
    expect(user.email).toBe(email)
  })

  test("HTTP endpoints return typed domain errors", async () => {
    const invalidTodo = await fetch(`${serverUrl}/api/todos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    })
    expect(invalidTodo.status).toBe(422)
    expectApiError(await readJson(invalidTodo), {
      _tag: "ApiValidationError",
      code: "VALIDATION_FAILED",
      message: "Title is required",
      field: "title",
    })

    const missingTodo = await fetch(`${serverUrl}/api/todos/999999`, {
      method: "DELETE",
    })
    expect(missingTodo.status).toBe(404)
    const missingTodoError = await readJson(missingTodo)
    expectApiError(missingTodoError, {
      _tag: "ApiNotFound",
      code: "NOT_FOUND",
      message: "todo 999999 was not found",
    })
    expect(missingTodoError.resource).toBe("todo")
    expect(missingTodoError.id).toBe("999999")

    const email = `duplicate-${Date.now()}@example.com`
    const createdUser = await fetch(`${serverUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Duplicate User", email }),
    })
    expect(createdUser.status).toBe(200)

    const duplicateUser = await fetch(`${serverUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Duplicate User", email }),
    })
    expect(duplicateUser.status).toBe(409)
    const conflict = await readJson(duplicateUser)
    expectApiError(conflict, {
      _tag: "ApiConflictError",
      code: "CONFLICT",
      message: `User email ${email} already exists`,
    })
    expect(conflict.resource).toBe("user")
  })

  test("RPC endpoints return expected data", async () => {
    const scope = Scope.makeUnsafe()
    const rpcClient = await Effect.runPromise(
      RpcClient.make(TodoRpc).pipe(
        Effect.provide(RpcClient.layerProtocolHttp({ url: `${serverUrl}/rpc` })),
        Effect.provide(RpcSerialization.layerJson),
        Effect.provideService(Scope.Scope, scope),
        Effect.provide(FetchHttpClient.layer)
      )
    )

    const stats = await Effect.runPromise(rpcClient.todoStats({}))
    expect(stats.total).toBeGreaterThan(0)
    expect(stats.open + stats.completed).toBe(stats.total)

    const toggled = await Effect.runPromise(rpcClient.toggleTodo({ id: 1 }))
    expect(toggled).toHaveProperty("id", 1)
    expect(toggled).toHaveProperty("completed")

    try {
      await Effect.runPromise(rpcClient.toggleTodo({ id: 999999 }))
      throw new Error("Expected missing todo RPC call to fail")
    } catch (error) {
      expectApiError(error, {
        _tag: "ApiNotFound",
        code: "NOT_FOUND",
        message: "todo 999999 was not found",
      })
      expect((error as any).resource).toBe("todo")
      expect((error as any).id).toBe("999999")
    }
  })

  test("Frontend page loads and renders React app", async () => {
    const response = await fetch(`${serverUrl}/`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain("Effect Fullstack Dashboard")
    expect(html).toContain("/src/entry-client.tsx")
  })
})
