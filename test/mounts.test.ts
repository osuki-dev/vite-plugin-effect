import { describe, test, expect } from "bun:test"
import {
  createHttpMount,
  createRpcMount,
  getMount,
  matchPluginRequest,
  isPluginRequest,
  rewriteRequestUrl,
  toFrontendBaseUrl,
} from "../src/mounts.ts"

describe("mounts", () => {
  describe("createHttpMount", () => {
    test("matches exact string prefix", () => {
      const mount = createHttpMount("/api")
      expect(mount.match("/api")).toBe(true)
      expect(mount.match("/api/")).toBe(true)
      expect(mount.match("/api/todos")).toBe(true)
      expect(mount.match("/rpc")).toBe(false)
      expect(mount.match("/")).toBe(false)
    })

    test("matches RegExp prefix", () => {
      const mount = createHttpMount(/\/api\/v\d+/)
      expect(mount.match("/api/v1")).toBe(true)
      expect(mount.match("/api/v2/todos")).toBe(true)
      expect(mount.match("/api")).toBe(false)
      expect(mount.match("/rpc")).toBe(false)
    })

    test("returns frontend base URL for string prefix", () => {
      const mount = createHttpMount("/api")
      expect(mount.toFrontendBaseUrl()).toBe("/api")
    })

    test("returns default prefix for RegExp mount", () => {
      const mount = createHttpMount(/\/api\/v\d+/)
      expect(mount.toFrontendBaseUrl()).toBe("/api")
    })

    test("rewrites backend path for string prefix", () => {
      const mount = createHttpMount("/api")
      const url = new URL("http://localhost/api/todos")
      mount.rewriteBackendPath(url)
      expect(url.pathname).toBe("/todos")
    })

    test("rewrites exact prefix to root", () => {
      const mount = createHttpMount("/api")
      const url = new URL("http://localhost/api")
      mount.rewriteBackendPath(url)
      expect(url.pathname).toBe("/")
    })

    test("does not rewrite non-matching paths", () => {
      const mount = createHttpMount("/api")
      const url = new URL("http://localhost/other")
      mount.rewriteBackendPath(url)
      expect(url.pathname).toBe("/other")
    })
  })

  describe("createRpcMount", () => {
    test("matches RPC path", () => {
      const mount = createRpcMount("/rpc")
      expect(mount.match("/rpc")).toBe(true)
      expect(mount.match("/rpc/")).toBe(true)
      expect(mount.match("/api")).toBe(false)
      expect(mount.match("/")).toBe(false)
    })

    test("returns RPC path as frontend base URL", () => {
      const mount = createRpcMount("/rpc")
      expect(mount.toFrontendBaseUrl()).toBe("/rpc")
    })

    test("normalizes trailing slash on rewrite", () => {
      const mount = createRpcMount("/rpc")
      const url = new URL("http://localhost/rpc/")
      mount.rewriteBackendPath(url)
      expect(url.pathname).toBe("/rpc")
    })

    test("does not rewrite exact path", () => {
      const mount = createRpcMount("/rpc")
      const url = new URL("http://localhost/rpc")
      mount.rewriteBackendPath(url)
      expect(url.pathname).toBe("/rpc")
    })
  })

  describe("getMount", () => {
    test("returns HTTP mount for http entry", () => {
      const entry = createHttpEntry("/api")
      const mount = getMount(entry)
      expect(mount.match("/api/todos")).toBe(true)
    })

    test("returns RPC mount for rpc entry", () => {
      const entry = createRpcEntry("/rpc")
      const mount = getMount(entry)
      expect(mount.match("/rpc")).toBe(true)
    })
  })

  describe("matchPluginRequest", () => {
    test("matches HTTP entry", () => {
      const entries = [createHttpEntry("/api")]
      const result = matchPluginRequest(entries, "http://localhost/api/todos")
      expect(result).toBeDefined()
      expect(result?.type).toBe("http")
    })

    test("matches RPC entry", () => {
      const entries = [createRpcEntry("/rpc")]
      const result = matchPluginRequest(entries, "http://localhost/rpc")
      expect(result).toBeDefined()
      expect(result?.type).toBe("rpc")
    })

    test("returns undefined for non-matching URL", () => {
      const entries = [createHttpEntry("/api")]
      const result = matchPluginRequest(entries, "http://localhost/other")
      expect(result).toBeUndefined()
    })

    test("matches first entry when multiple entries", () => {
      const entries = [createHttpEntry("/api"), createRpcEntry("/rpc")]
      expect(matchPluginRequest(entries, "/api")?.type).toBe("http")
      expect(matchPluginRequest(entries, "/rpc")?.type).toBe("rpc")
    })
  })

  describe("isPluginRequest", () => {
    test("returns true for matching URL", () => {
      const entries = [createHttpEntry("/api")]
      expect(isPluginRequest(entries, "/api/todos")).toBe(true)
    })

    test("returns false for non-matching URL", () => {
      const entries = [createHttpEntry("/api")]
      expect(isPluginRequest(entries, "/other")).toBe(false)
    })
  })

  describe("rewriteRequestUrl", () => {
    test("rewrites HTTP entry URL", () => {
      const entry = createHttpEntry("/api")
      const url = new URL("http://localhost/api/todos")
      rewriteRequestUrl(entry, url)
      expect(url.pathname).toBe("/todos")
    })

    test("rewrites RPC entry URL", () => {
      const entry = createRpcEntry("/rpc")
      const url = new URL("http://localhost/rpc/")
      rewriteRequestUrl(entry, url)
      expect(url.pathname).toBe("/rpc")
    })
  })

  describe("toFrontendBaseUrl", () => {
    test("returns HTTP prefix for http entry", () => {
      const entry = createHttpEntry("/api")
      expect(toFrontendBaseUrl(entry)).toBe("/api")
    })

    test("returns RPC path for rpc entry", () => {
      const entry = createRpcEntry("/rpc")
      expect(toFrontendBaseUrl(entry)).toBe("/rpc")
    })

    test("returns default prefix for RegExp HTTP entry", () => {
      const entry = createHttpEntryRegExp(/\/api\/v\d+/)
      expect(toFrontendBaseUrl(entry)).toBe("/api")
    })
  })
})

function createHttpEntry(apiPrefix: string | RegExp) {
  return {
    type: "http" as const,
    name: "api",
    sharedPath: "./src/shared.ts",
    exportName: "MyApi",
    apiPrefix,
    rpcPath: "/rpc",
  }
}

function createHttpEntryRegExp(apiPrefix: RegExp) {
  return {
    type: "http" as const,
    name: "api",
    sharedPath: "./src/shared.ts",
    exportName: "MyApi",
    apiPrefix,
    rpcPath: "/rpc",
  }
}

function createRpcEntry(rpcPath: string) {
  return {
    type: "rpc" as const,
    name: "rpc",
    sharedPath: "./src/shared.ts",
    exportName: "TodoRpc",
    apiPrefix: "/api",
    rpcPath,
  }
}
