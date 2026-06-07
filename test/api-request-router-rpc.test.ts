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

const mockReq = (url: string = "/", method: string = "GET") =>
  ({ url, method, headers: {} } as any)

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
    end: (data?: string | Buffer) => {
      res.ended = true
      if (data) {
        if (Buffer.isBuffer(data)) {
          res.data += data.toString()
        } else {
          res.data += data
        }
      }
    },
  }
  return res
}

describe("ApiRequestRouter RPC", () => {
  test("matches exact RPC path", async () => {
    const handler = async (request: Request) => {
      return new Response(JSON.stringify({ result: "ok" }), { status: 200 })
    }
    const loader: ServerLoader = {
      load: async () => ({ type: "web" as const, handler }),
      dispose: async () => {},
    }
    const router = new ApiRequestRouter(
      loader,
      () => mockOptions([{ type: "rpc", rpcPath: "/rpc", apiPrefix: "" }]),
      () => mockConfig()
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    const res = mockRes()
    await router.route(mockReq("/rpc"), res, next)
    expect(nextCalled).toBe(false)
    expect(res.statusCode).toBe(200)
    expect(res.data).toContain("ok")
  })

  test("skips RPC sub-paths (exact match only)", async () => {
    const loader: ServerLoader = {
      load: async () => ({ type: "node" as const, handler: null }),
      dispose: async () => {},
    }
    const router = new ApiRequestRouter(
      loader,
      () => mockOptions([{ type: "rpc", rpcPath: "/rpc", apiPrefix: "" }]),
      () => mockConfig()
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    const res = mockRes()
    await router.route(mockReq("/rpc/todoStats"), res, next)
    expect(nextCalled).toBe(true)
  })

  test("skips RPC request when no RPC entry", async () => {
    const loader: ServerLoader = {
      load: async () => ({ type: "node" as const, handler: null }),
      dispose: async () => {},
    }
    const router = new ApiRequestRouter(
      loader,
      () => mockOptions([{ type: "http", apiPrefix: "/api", rpcPath: "" }]),
      () => mockConfig()
    )
    let nextCalled = false
    const next = () => { nextCalled = true }
    const res = mockRes()
    await router.route(mockReq("/rpc/todoStats"), res, next)
    expect(nextCalled).toBe(true)
  })
})
