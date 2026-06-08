import { describe, test, expect, beforeAll, afterAll, setDefaultTimeout } from "bun:test"
import { spawn, type ChildProcess } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(__dirname, "fixture-reflection")

setDefaultTimeout(30000)

describe("vite-plugin-effect reflection e2e", () => {
  let devServer: ChildProcess
  let serverUrl: string

  beforeAll(async () => {
    devServer = spawn("bun", ["run", "dev", "--", "--host", "127.0.0.1"], {
      cwd: fixtureDir,
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

  test("API endpoint returns expected data", async () => {
    const response = await fetch(`${serverUrl}/api/todos`)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toEqual([{ id: 1, title: "Learn Effect", completed: false }])
  })

  test("virtual module loads and executes in browser", async () => {
    const response = await fetch(`${serverUrl}/`)
    expect(response.status).toBe(200)
    const html = await response.text()
    expect(html).toContain("vite-plugin-effect reflection fixture")
    expect(html).toContain("./src/main.ts")
  })

  test("generated client file exists", async () => {
    const fs = await import("node:fs/promises")
    const clientPath = join(fixtureDir, "src", "effect-client.ts")
    const content = await fs.readFile(clientPath, "utf8")
    expect(content).toContain("MyApi")
    expect(content).toContain("HttpApi.make")
    expect(content).toContain('HttpApiEndpoint.make("GET")')
  })
})
