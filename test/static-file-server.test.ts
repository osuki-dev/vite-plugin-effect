import { describe, test, expect } from "bun:test"
import { mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { NodeStaticFileServer } from "../src/static-file-server.ts"
import { NodeSsrRenderer } from "../src/ssr/prod-renderer.ts"

const mockReq = (method: string = "GET", url: string = "/", accept?: string) =>
  ({
    method,
    url,
    headers: { accept },
  } as any)

const mockRes = () => {
  const res: any = {
    statusCode: 0,
    headers: {},
    ended: false,
    data: "",
    _listeners: {} as Record<string, any[]>,
    writeHead: (code: number, headers: any) => {
      res.statusCode = code
      res.headers = headers
    },
    write: (chunk: any) => {
      if (typeof chunk === "string") {
        res.data += chunk
      } else {
        res.data += Buffer.from(chunk).toString()
      }
      return true
    },
    end: (data?: string) => {
      res.ended = true
      if (data) res.data += data
      const listeners = res._listeners["finish"] || []
      listeners.forEach((cb: any) => cb())
    },
    destroy: () => {},
    emit: (event: string, ...args: any[]) => {
      const listeners = res._listeners[event] || []
      listeners.forEach((cb: any) => cb(...args))
    },
    removeListener: (event: string, callback: any) => {
      if (!res._listeners[event]) return
      res._listeners[event] = res._listeners[event].filter((cb: any) => cb !== callback)
    },
    on: (event: string, callback: any) => {
      if (!res._listeners[event]) res._listeners[event] = []
      res._listeners[event].push(callback)
    },
    once: (event: string, callback: any) => {
      const onceCb = (...args: any[]) => {
        res.removeListener(event, onceCb)
        callback(...args)
      }
      res.on(event, onceCb)
    },
  }
  return res
}

describe("NodeStaticFileServer", () => {
  test("serves a static file", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "vfs-"))
    await writeFile(join(tmp, "hello.txt"), "world")
    const server = new NodeStaticFileServer()
    const req = mockReq("GET", "/hello.txt")
    const res = mockRes()
    await server.serve(req, res, tmp, false)
    expect(res.statusCode).toBe(200)
    expect(res.data).toBe("world")
  })

  test("returns 404 for missing file", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "vfs-"))
    const server = new NodeStaticFileServer()
    const req = mockReq("GET", "/missing.txt")
    const res = mockRes()
    await server.serve(req, res, tmp, false)
    expect(res.statusCode).toBe(404)
  })

  test("returns 405 for POST requests", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "vfs-"))
    const server = new NodeStaticFileServer()
    const req = mockReq("POST", "/hello.txt")
    const res = mockRes()
    await server.serve(req, res, tmp, false)
    expect(res.statusCode).toBe(405)
  })

  test("returns 403 for path traversal", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "vfs-"))
    const server = new NodeStaticFileServer()
    const req = mockReq("GET", "/%2e%2e%2fetc%2fpasswd")
    const res = mockRes()
    await server.serve(req, res, tmp, false)
    expect(res.statusCode).toBe(403)
  })
})

describe("NodeSsrRenderer", () => {
  test("returns false for non-HTML requests", async () => {
    const renderer = new NodeSsrRenderer()
    const tmp = await mkdtemp(join(tmpdir(), "vfs-"))
    const req = mockReq("GET", "/", "application/json")
    const res = mockRes()
    const rendered = await renderer.render(req, res, "", tmp)
    expect(rendered).toBe(false)
  })
})
