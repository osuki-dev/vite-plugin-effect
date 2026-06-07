import { describe, test, expect } from "bun:test"
import { stripTypeScriptExtension } from "../src/client-generator/index.ts"

describe("stripTypeScriptExtension", () => {
  test("strips .ts extension", () => {
    expect(stripTypeScriptExtension("./src/shared.ts")).toBe("./src/shared")
  })

  test("strips .tsx extension", () => {
    expect(stripTypeScriptExtension("./src/component.tsx")).toBe("./src/component")
  })

  test("strips .mts extension", () => {
    expect(stripTypeScriptExtension("./src/module.mts")).toBe("./src/module")
  })

  test("strips .cts extension", () => {
    expect(stripTypeScriptExtension("./src/module.cts")).toBe("./src/module")
  })

  test("leaves .js extension untouched", () => {
    expect(stripTypeScriptExtension("./src/module.js")).toBe("./src/module.js")
  })

  test("leaves path without extension untouched", () => {
    expect(stripTypeScriptExtension("./src/shared")).toBe("./src/shared")
  })

  test("only strips trailing extension", () => {
    expect(stripTypeScriptExtension("./src/types.ts/utils.ts")).toBe("./src/types.ts/utils")
  })
})
