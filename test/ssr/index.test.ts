import { describe, test, expect } from "bun:test"
import {
  SsrStrategy,
  NoopSsrStrategy,
  ViteSsrStrategy,
  createSsrMiddleware,
  SsrRenderer,
  NodeSsrRenderer,
  buildSsrBundle,
} from "../../src/ssr/index.ts"

describe("ssr/index exports", () => {
  test("exports SsrStrategy type", () => {
    // SsrStrategy is a type, so we can verify it's importable by using it
    const strategy: SsrStrategy = new NoopSsrStrategy()
    expect(strategy.enabled).toBe(false)
  })

  test("exports NoopSsrStrategy", () => {
    expect(typeof NoopSsrStrategy).toBe("function")
  })

  test("exports ViteSsrStrategy", () => {
    expect(typeof ViteSsrStrategy).toBe("function")
  })

  test("exports createSsrMiddleware", () => {
    expect(typeof createSsrMiddleware).toBe("function")
  })

  test("exports NodeSsrRenderer", () => {
    expect(typeof NodeSsrRenderer).toBe("function")
  })

  test("exports buildSsrBundle", () => {
    expect(typeof buildSsrBundle).toBe("function")
  })

  test("NodeSsrRenderer implements SsrRenderer", () => {
    const renderer: SsrRenderer = new NodeSsrRenderer()
    expect(typeof renderer.render).toBe("function")
  })
})
