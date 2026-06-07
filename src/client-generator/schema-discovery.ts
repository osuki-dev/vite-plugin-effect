import * as fs from "node:fs/promises"
import * as path from "node:path"
import type { ResolvedConfig } from "vite"
import type { ResolvedPluginOptions } from "../options"
import { toRelativeTypeImport } from "../path-utils"
import {
  entryTypeName,
  toPascalIdentifier,
  type SchemaExport,
} from "./codegen-utils"

export const stripTypeScriptExtension = (specifier: string): string =>
  specifier.replace(/\.(mts|cts|ts|tsx)$/, "")

export const discoverSchemaExports = async (
  options: ResolvedPluginOptions,
  config: ResolvedConfig,
  clientPath: string
): Promise<ReadonlyArray<SchemaExport>> => {
  const seenFiles = new Set<string>()
  const seenNames = new Set<string>()
  const reserved = generatedTypeNames(options)
  const exports: Array<SchemaExport> = []

  for (const entry of options.entries) {
    const sharedPath = path.resolve(config.root, entry.sharedPath)
    if (seenFiles.has(sharedPath)) continue
    seenFiles.add(sharedPath)

    let source: string
    try {
      source = await fs.readFile(sharedPath, "utf8")
    } catch {
      continue
    }

    const specifier = stripTypeScriptExtension(
      toRelativeTypeImport(config, clientPath, entry.sharedPath)
    )
    for (const name of scanSchemaExportNames(source)) {
      if (seenNames.has(name) || reserved.has(name)) continue
      seenNames.add(name)
      exports.push({ name, specifier })
    }
  }

  return exports
}

export const scanSchemaExportNames = (source: string): ReadonlyArray<string> => {
  const names = new Set<string>()
  const patterns = [
    /\bexport\s+(?:const|let|var)\s+([A-Z][A-Za-z0-9_]*)\s*(?::[^=]+)?=\s*Schema\./g,
    /\bexport\s+class\s+([A-Z][A-Za-z0-9_]*)\s+extends\s*Schema\./g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      names.add(match[1]!)
    }
  }

  return Array.from(names)
}

export const generatedTypeNames = (options: ResolvedPluginOptions): ReadonlySet<string> => {
  const names = new Set([
    "Client",
    "EffectClient",
    "PromiseClient",
    "SchemaType",
    "EntryResultMap",
    "EntryInputMap",
    "EntryPayloadMap",
    "ClientResults",
    "ClientInputs",
    "ClientPayloads",
    "ClientGroups",
    "ClientGroupName",
    "ClientGroup",
    "ClientTopLevelEndpointName",
    "ClientEndpointName",
    "ClientEndpoint",
    "TopLevelEndpoint",
    "EndpointInput",
    "EndpointPayload",
    "EndpointResult",
  ])
  options.entries.forEach((entry, index) => {
    names.add(`${entryTypeName(index)}EffectClient`)
    names.add(`${entryTypeName(index)}PromiseClient`)
    const entryName = toPascalIdentifier(entry.name)
    if (entryName) {
      names.add(`${entryName}EffectClient`)
      names.add(`${entryName}PromiseClient`)
      names.add(`${entryName}Client`)
      names.add(`${entryName}Results`)
      names.add(`${entryName}Inputs`)
      names.add(`${entryName}Payloads`)
    }
  })
  return names
}
