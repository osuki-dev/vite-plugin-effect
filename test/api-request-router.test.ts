import { describe, test, expect } from "bun:test"
import { ApiRequestRouter } from "../src/api-request-router.ts"
import type { ResolvedPluginOptions } from "../src/options.ts"
import type { ResolvedConfig } from "vite"
import type { ServerLoader } from "../src/server-loader.ts"

const mockConfig = (root: string = "/tmp") =>
  ({ root } as ResolvedConfig)

const mockOptions = (entries: any[] = []): ResolvedPluginOptions =>
  ({
    entries,
    serverEntry: undefined,
    virtualModuleId: "virtual:effect/client",
    resolvedVirtualModuleId: "\0virtual:effect/client",
  } as any)

const mockLoader = (handler: unknown = null): ServerLoader => ({
  load: async () => ({ type: "node" as const, handler }),
  dispose: async () => {},
})

const mockReq = (url: string = "/") =>
  ({ url, method: "GET", headers: {} } as any)

const mockRes = () => {
  const res: any = {
    statusCode: 0,
    headers: {},
    ended: false,
    data: "",
    writeHead: (code: number, headers: any) => {
      res.statusCode = code
      res.headers = headers
    },
    end: (data?: string) => {
      res.ended = true
      if (data) res.data = data
    },
  }
  return res
}

describe("ApiRequestRouter", () => {
  test("calls next when no matched entry", async () => {
    const router = new ApiRequestRouter(
      mockLoader(),
      () => mockOptions(),
      () => mockConfig()
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    await router.route(mockReq("/"), mockRes(), next)
    expect(nextCalled).toBe(true)
  })

  test("returns 200 info when handler is null", async () => {
    const router = new ApiRequestRouter(
      mockLoader(null),
      () => mockOptions([{ type: "http", apiPrefix: "/api", rpcPath: "" }]),
      () => mockConfig()
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    const res = mockRes()
    await router.route(mockReq("/api/users"), res, next)
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(200)
    expect(res.data).toContain("vite-plugin-effect is running")
  })

  test("calls error handler on exception", async () => {
    const errorLoader: ServerLoader = {
      load: async () => { throw new Error("load error") },
      dispose: async () => {},
    }
    let errorHandled: Error | null = null
    const router = new ApiRequestRouter(
      errorLoader,
      () => mockOptions([{ type: "http", apiPrefix: "/api", rpcPath: "" }]),
      () => mockConfig(),
      (error) => { errorHandled = error }
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    const res = mockRes()
    await router.route(mockReq("/api/users"), res, next)
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(500)
    expect(errorHandled).not.toBeNull()
    expect(errorHandled!.message).toBe("load error")
  })
})
