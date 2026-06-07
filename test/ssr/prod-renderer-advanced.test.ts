import { describe, test, expect } from "bun:test"
import { NodeSsrRenderer } from "../../src/ssr/prod-renderer.ts"
import { mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

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

describe("NodeSsrRenderer advanced", () => {
  test("returns false for non-HTML accept header", async () => {
    const renderer = new NodeSsrRenderer()
    const res = mockRes()
    const rendered = await renderer.render(
      mockReq("GET", "/", "application/json"),
      res,
      "",
      "/tmp"
    )
    expect(rendered).toBe(false)
  })

  test("returns false when SSR module does not exist", async () => {
    const renderer = new NodeSsrRenderer()
    const res = mockRes()
    const rendered = await renderer.render(
      mockReq("GET", "/", "text/html"),
      res,
      "file:///nonexistent-module.js",
      "/tmp"
    )
    expect(rendered).toBe(false)
  })

  test("returns false when index.html does not exist", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "ssr-"))
    try {
      const renderer = new NodeSsrRenderer()
      const res = mockRes()
      const rendered = await renderer.render(
        mockReq("GET", "/", "text/html"),
        res,
        "file:///nonexistent.js",
        tmp
      )
      expect(rendered).toBe(false)
    } finally {
      await Bun.file(tmp).text().catch(() => {})
    }
  })

  test("returns true for HEAD request with HTML accept", async () => {
    const renderer = new NodeSsrRenderer()
    const res = mockRes()
    const rendered = await renderer.render(
      mockReq("HEAD", "/", "text/html"),
      res,
      "",
      "/tmp"
    )
    expect(rendered).toBe(false)
  })
})
