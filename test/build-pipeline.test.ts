import { describe, test, expect } from "bun:test"
import {
  runBuildPipeline,
  copyProductionRuntime,
  generateServerEntry,
} from "../src/build-pipeline.ts"
import { buildSsrBundle } from "../src/ssr/build-step.ts"

describe("build-pipeline", () => {
  test("exports runBuildPipeline", () => {
    expect(typeof runBuildPipeline).toBe("function")
  })

  test("exports copyProductionRuntime", () => {
    expect(typeof copyProductionRuntime).toBe("function")
  })

  test("exports buildSsrBundle", () => {
    expect(typeof buildSsrBundle).toBe("function")
  })

  test("exports generateServerEntry", () => {
    expect(typeof generateServerEntry).toBe("function")
  })
})
