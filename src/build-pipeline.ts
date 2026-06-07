import * as fs from "node:fs/promises"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import type { ResolvedConfig } from "vite"
import { defaultBuiltServerEntryFileName } from "./defaults"
import type { ResolvedPluginOptions } from "./options"
import { isProductionServerEnabled } from "./options"
import { writeProductionServerRuntime } from "./production-server"
import type { SsrStrategy } from "./ssr/index.ts"
import { buildSsrBundle } from "./ssr/build-step"

const runtimeModuleDir = path.dirname(fileURLToPath(import.meta.url))

export async function copyProductionRuntime(serverOutDir: string, platform: "node" | "cloudflare" = "node"): Promise<void> {
  const runtimeName = platform === "cloudflare" ? "cloudflare-runtime" : "production-runtime"
  const targetPath = path.resolve(serverOutDir, `${runtimeName}.js`)

  if (platform === "node") {
    const bundlePath = path.resolve(runtimeModuleDir, `${runtimeName}.bundle.js`)
    try {
      await fs.access(bundlePath)
      console.log(`[vite-plugin-effect] Copying ${runtimeName} to ${serverOutDir}`)
      await fs.mkdir(serverOutDir, { recursive: true })
      await fs.copyFile(bundlePath, targetPath)
      console.log(`[vite-plugin-effect] ${runtimeName} copy complete`)
      return
    } catch {
      // Bundle not found - fall back to building from source.
    }
  }

  const runtimePath = await findRuntimeSource(runtimeName)
  console.log(`[vite-plugin-effect] Building ${runtimeName} to ${serverOutDir}`)
  const vite = await import("vite")
  await vite.build({
    root: process.cwd(),
    configFile: false,
    build: {
      ssr: true,
      emptyOutDir: false,
      outDir: serverOutDir,
      rollupOptions: {
        input: runtimePath,
        output: {
          entryFileNames: `${runtimeName}.js`,
          chunkFileNames: "chunks/[name]-[hash].js",
        },
        external: [
          "effect",
          /^effect\//,
          /^node:/,
        ],
      },
    },
  })
  console.log(`[vite-plugin-effect] ${runtimeName} build complete`)
}

async function findRuntimeSource(runtimeName: string): Promise<string> {
  const candidates = [
    path.resolve(runtimeModuleDir, `${runtimeName}.js`),
    path.resolve(runtimeModuleDir, `${runtimeName}.ts`),
  ]
  for (const candidate of candidates) {
    try {
      await fs.access(candidate)
      return candidate
    } catch {
      // Try the next emitted/source runtime path.
    }
  }
  throw new Error(`vite-plugin-effect: unable to find ${runtimeName}.js or ${runtimeName}.ts`)
}

export async function generateServerEntry(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
  serverOutDir: string,
  ssrStrategy: SsrStrategy,
): Promise<void> {
  await writeProductionServerRuntime({
    config,
    options,
    serverOutDir,
    builtServerEntryFileName: defaultBuiltServerEntryFileName,
    ssrStrategy,
  })
}

export async function runBuildPipeline(
  config: ResolvedConfig,
  options: ResolvedPluginOptions,
  serverOutDir: string,
  builder: any | undefined,
  ssrStrategy: SsrStrategy,
): Promise<void> {
  if (isProductionServerEnabled(options)) {
    await copyProductionRuntime(serverOutDir, options.productionServer.platform)
  }
  if (builder) {
    await buildSsrBundle(config, options, serverOutDir, ssrStrategy)
  } else {
    console.log("[vite-plugin-effect] Skipping SSR bundle build — requires builder")
  }
  await generateServerEntry(config, options, serverOutDir, ssrStrategy)
}
