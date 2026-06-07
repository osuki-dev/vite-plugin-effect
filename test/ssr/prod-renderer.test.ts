import { describe, test, expect } from "bun:test"
import { NodeSsrRenderer } from "../../src/ssr/prod-renderer.ts"

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

describe("NodeSsrRenderer", () => {
  test("returns false for non-HTML requests", async () => {
    const renderer = new NodeSsrRenderer()
    const res = mockRes()
    const rendered = await renderer.render(mockReq("GET", "/", "application/json"), res, "", "/tmp")
    expect(rendered).toBe(false)
  })

  test("returns false for non-GET methods", async () => {
    const renderer = new NodeSsrRenderer()
    const res = mockRes()
    const rendered = await renderer.render(mockReq("POST", "/", "text/html"), res, "", "/tmp")
    expect(rendered).toBe(false)
  })

  test("returns false when SSR module has no render function", async () => {
    const renderer = new NodeSsrRenderer()
    const res = mockRes()
    const rendered = await renderer.render(mockReq("GET", "/", "text/html"), res, "file:///nonexistent", "/tmp")
    expect(rendered).toBe(false)
  })
})
