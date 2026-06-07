import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from "bun:test"
import { spawn, type ChildProcess } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { Effect, Scope } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
import { RpcClient, RpcSerialization } from "effect/unstable/rpc"
import { TodoRpc } from "./react-app/src/server/shared"

const __dirname = dirname(fileURLToPath(import.meta.url))
const appDir = join(__dirname, "react-app")

setDefaultTimeout(30000)

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
    const response = await fetch(`${serverUrl}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "E2E User", email: "e2e@example.com" }),
    })
    expect(response.status).toBe(200)
    const user = await response.json()
    expect(user).toHaveProperty("id")
    expect(user.name).toBe("E2E User")
    expect(user.email).toBe("e2e@example.com")
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
  })

  test("Frontend page loads and renders React app", async () => {
    const response = await fetch(`${serverUrl}/`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain("Effect Fullstack Dashboard")
    expect(html).toContain("/src/entry-client.tsx")
  })
})
