import { describe, test, expect } from "bun:test"
import { resolveProjectPath, toRelativeTypeImport } from "../src/path-utils.ts"
import type { ResolvedConfig } from "vite"

const mockConfig = (root: string = "/project"): ResolvedConfig =>
  ({ root } as ResolvedConfig)

describe("path-utils", () => {
  describe("resolveProjectPath", () => {
    test("resolves relative path from project root", () => {
      const result = resolveProjectPath(mockConfig("/project"), "src/main.ts")
      expect(result).toBe("/project/src/main.ts")
    })

    test("resolves absolute path", () => {
      const result = resolveProjectPath(mockConfig("/project"), "/absolute/path.ts")
      expect(result).toBe("/absolute/path.ts")
    })

    test("normalizes backslashes", () => {
      const result = resolveProjectPath(mockConfig("C:\\project"), "src\\main.ts")
      expect(result).not.toContain("\\")
    })
  })

  describe("toRelativeTypeImport", () => {
    test("returns relative path from src to shared", () => {
      const result = toRelativeTypeImport(
        mockConfig("/project"),
        "/project/src/client.ts",
        "./src/shared.ts"
      )
      expect(result).toBe("./shared.ts")
    })

    test("returns relative path from dist to src", () => {
      const result = toRelativeTypeImport(
        mockConfig("/project"),
        "/project/dist/client.js",
        "./src/shared.ts"
      )
      expect(result).toBe("../src/shared.ts")
    })

    test("handles paths without leading dot", () => {
      const result = toRelativeTypeImport(
        mockConfig("/project"),
        "/project/src/a.ts",
        "./src/b.ts"
      )
      expect(result.startsWith("./") || result.startsWith("../")).toBe(true)
    })
  })
})
