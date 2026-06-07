import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { ResolvedConfig } from "vite"
import { defaultDtsFallbackPath } from "../defaults"
import { isClientPathEnabled, isDtsEnabled } from "../options"
import type { ResolvedPluginOptions } from "../options"
import { generateClientFile } from "./client-codegen"
import { generateVirtualClientDts } from "./dts-shim"
import { discoverSchemaExports } from "./schema-discovery"

export interface GeneratedClientOutputs {
  readonly clientCode: string
  readonly dtsCode: string
}

export const generateClientOutputs = async (
  options: ResolvedPluginOptions,
  config: ResolvedConfig
): Promise<GeneratedClientOutputs> => {
  const clientPath = isClientPathEnabled(options)
    ? path.resolve(config.root, options.clientPath)
    : path.resolve(config.root, "src/effect-client.ts")
  const dtsPath = isDtsEnabled(options)
    ? path.resolve(config.root, options.dts)
    : path.resolve(config.root, defaultDtsFallbackPath)

  const schemaExports = await discoverSchemaExports(options, config, clientPath)

  return {
    clientCode: generateClientFile(options, config, clientPath, schemaExports),
    dtsCode: generateVirtualClientDts(options, config, dtsPath),
  }
}

export const writeClientOutputs = async (
  options: ResolvedPluginOptions,
  config: ResolvedConfig
): Promise<void> => {
  const outputs = await generateClientOutputs(options, config)

  if (isClientPathEnabled(options)) {
    const clientPath = path.resolve(config.root, options.clientPath)
    await fs.mkdir(path.dirname(clientPath), { recursive: true })
    await fs.writeFile(clientPath, outputs.clientCode)
  }

  if (isDtsEnabled(options)) {
    const dtsPath = path.resolve(config.root, options.dts)
    await fs.mkdir(path.dirname(dtsPath), { recursive: true })
    await fs.writeFile(dtsPath, outputs.dtsCode)
  }
}
