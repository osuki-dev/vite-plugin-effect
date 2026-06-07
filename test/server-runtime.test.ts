import { describe, test, expect } from "bun:test"
import { loadServerApi, handleApiRequest, sendJson, nodeRequestToWebRequest } from "../src/server-runtime.ts"
import type { ResolvedClientEntry } from "../src/options.ts"

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

describe("server-runtime", () => {
  describe("loadServerApi", () => {
    test("returns handler for legacy module", async () => {
      const handler = () => {}
      const result = await loadServerApi({ handler }, ["MainLive"])
      expect(result.type).toBe("node")
      expect(result.handler).toBe(handler)
    })

    test("throws when no matching export found", async () => {
      await expect(loadServerApi({}, ["MainLive"])).rejects.toThrow("MainLive")
    })

    test("picks first matching export", async () => {
      const layer = {}
      const result = await loadServerApi({ MainLive: layer, AppLive: {} }, ["MainLive", "AppLive"])
      expect(result.type).toBe("web")
    })
  })

  describe("sendJson", () => {
    test("sends JSON response", () => {
      const res = mockRes()
      sendJson(res, 200, { ok: true })
      expect(res.statusCode).toBe(200)
      expect(res.headers["Content-Type"]).toBe("application/json")
      expect(res.data).toContain('"ok":true')
    })

    test("sends error response", () => {
      const res = mockRes()
      sendJson(res, 500, { error: "fail" })
      expect(res.statusCode).toBe(500)
      expect(res.data).toContain("fail")
    })
  })

  describe("nodeRequestToWebRequest", () => {
    test("converts GET request", async () => {
      const req = {
        url: "/api/users",
        method: "GET",
        headers: { host: "localhost:3000" },
      } as any
      const webReq = await nodeRequestToWebRequest(req, () => {})
      expect(webReq.method).toBe("GET")
      expect(webReq.url).toContain("/api/users")
    })

    test("converts POST request with body", async () => {
      const chunks: Buffer[] = []
      const req = {
        url: "/api/users",
        method: "POST",
        headers: { host: "localhost:3000", "content-type": "application/json" },
        [Symbol.asyncIterator]: async function* () {
          yield Buffer.from(JSON.stringify({ name: "test" }))
        },
      } as any
      const webReq = await nodeRequestToWebRequest(req, () => {})
      expect(webReq.method).toBe("POST")
      const body = await webReq.json()
      expect(body).toEqual({ name: "test" })
    })
  })
})
