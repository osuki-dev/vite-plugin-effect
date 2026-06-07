import * as fs from "node:fs/promises"
import { statSync } from "node:fs"
import * as path from "node:path"
import type { ResolvedConfig } from "vite"
import { defaultApiPrefix, defaultRpcPath } from "./defaults"
import type { ResolvedClientEntry, ResolvedPluginOptions } from "./options"
import { resolveProjectPath } from "./path-utils"

interface ImportedBinding {
  readonly imported: string
  readonly local: string
  readonly source: string
}

interface DiscoveredContract {
  readonly type: "http" | "rpc"
  readonly localName: string
  readonly exportName: string
  readonly sharedPath: string
  readonly rpcPath?: string
}

export const discoverEntriesFromServerEntry = async (
  options: ResolvedPluginOptions,
  config: ResolvedConfig
): Promise<ReadonlyArray<ResolvedClientEntry>> => {
  if (!options.serverEntry) {
    throw new Error(
      "vite-plugin-effect: configure serverEntry when sharedPath/entries are omitted. The plugin discovers HTTP/RPC contracts from the MainLive server module."
    )
  }

  const serverEntryPath = resolveProjectPath(config, options.serverEntry)
  const source = await readSource(serverEntryPath)
  const imports = parseNamedImports(source)
  const contracts: Array<DiscoveredContract> = []

  for (const localName of discoverHttpApiNames(source)) {
    contracts.push(resolveContract({
      type: "http",
      localName,
      imports,
      serverEntryPath,
    }))
  }

  for (const rpc of discoverRpcGroups(source)) {
    contracts.push(resolveContract({
      type: "rpc",
      localName: rpc.groupName,
      rpcPath: rpc.path,
      imports,
      serverEntryPath,
    }))
  }

  const deduped = dedupeContracts(contracts)
  if (deduped.length === 0) {
    throw new Error(
      `vite-plugin-effect: could not discover Effect HTTP/RPC contracts from ${options.serverEntry}. Expected calls like HttpApiBuilder.layer(MyApi) or RpcServer.layerHttp({ group: MyRpc, path: "/rpc" }) in the MainLive module.`
    )
  }

  return deduped.map((contract, index) => ({
    type: contract.type,
    name: defaultEntryName(contract.type, index, deduped),
    sharedPath: toProjectRelativePath(config, contract.sharedPath),
    exportName: contract.exportName,
    apiPrefix: contract.type === "http" ? defaultApiPrefix : defaultApiPrefix,
    rpcPath: contract.type === "rpc" ? contract.rpcPath ?? defaultRpcPath : defaultRpcPath,
  }))
}

const readSource = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch (error) {
    throw new Error(`vite-plugin-effect: failed to read serverEntry ${filePath}: ${(error as Error).message}`)
  }
}

const parseNamedImports = (source: string): ReadonlyArray<ImportedBinding> => {
  const imports: Array<ImportedBinding> = []
  const importPattern = /\bimport\s+(?:type\s+)?\{([\s\S]*?)\}\s+from\s+["']([^"']+)["']/g
  let match: RegExpExecArray | null

  while ((match = importPattern.exec(source)) !== null) {
    const [, specifiers, sourcePath] = match
    for (const rawSpecifier of splitTopLevelComma(specifiers ?? "")) {
      const cleaned = rawSpecifier.trim()
      if (!cleaned) continue
      const aliasMatch = cleaned.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/)
      if (!aliasMatch) continue
      imports.push({
        imported: aliasMatch[1]!,
        local: aliasMatch[2] ?? aliasMatch[1]!,
        source: sourcePath!,
      })
    }
  }

  return imports
}

const discoverHttpApiNames = (source: string): ReadonlyArray<string> => {
  const names = new Set<string>()
  const patterns = [
    /\bHttpApiBuilder\s*\.\s*layer\s*\(\s*([A-Za-z_$][\w$]*)/g,
    /\bHttpApiBuilder\s*\.\s*group\s*\(\s*([A-Za-z_$][\w$]*)/g,
  ]

  for (const pattern of patterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(source)) !== null) {
      names.add(match[1]!)
    }
  }

  return Array.from(names)
}

const discoverRpcGroups = (
  source: string
): ReadonlyArray<{ readonly groupName: string; readonly path?: string }> => {
  const groups: Array<{ groupName: string; path?: string }> = []
  const layerHttpPattern = /\bRpcServer\s*\.\s*layerHttp\s*\(\s*\{([\s\S]*?)\}\s*\)/g
  let match: RegExpExecArray | null

  while ((match = layerHttpPattern.exec(source)) !== null) {
    const objectSource = match[1] ?? ""
    const groupMatch = objectSource.match(/\bgroup\s*:\s*([A-Za-z_$][\w$]*)/)
    if (!groupMatch) continue
    groups.push({
      groupName: groupMatch[1]!,
      path: objectSource.match(/\bpath\s*:\s*["']([^"']+)["']/)?.[1],
    })
  }

  return groups
}

const resolveContract = (options: {
  readonly type: "http" | "rpc"
  readonly localName: string
  readonly rpcPath?: string
  readonly imports: ReadonlyArray<ImportedBinding>
  readonly serverEntryPath: string
}): DiscoveredContract => {
  const imported = options.imports.find((binding) => binding.local === options.localName)
  if (!imported) {
    return {
      type: options.type,
      localName: options.localName,
      exportName: options.localName,
      sharedPath: options.serverEntryPath,
      rpcPath: options.rpcPath,
    }
  }

  return {
    type: options.type,
    localName: options.localName,
    exportName: imported.imported,
    sharedPath: resolveImportFile(options.serverEntryPath, imported.source),
    rpcPath: options.rpcPath,
  }
}

const resolveImportFile = (fromFile: string, specifier: string): string => {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    throw new Error(
      `vite-plugin-effect: discovered contract import ${JSON.stringify(specifier)} is not project-local. Export Effect contracts from a local module so the generated client can reference their types.`
    )
  }

  const base = specifier.startsWith("/")
    ? specifier
    : path.resolve(path.dirname(fromFile), specifier)
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mts`,
    `${base}.cts`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.cjs`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
    path.join(base, "index.mts"),
    path.join(base, "index.js"),
  ]

  for (const candidate of candidates) {
    try {
      const stat = requireStat(candidate)
      if (stat?.isFile()) return candidate.replace(/\\/g, "/")
    } catch {
      continue
    }
  }

  return base.replace(/\\/g, "/")
}

const requireStat = (filePath: string) => {
  try {
    return statSync(filePath)
  } catch {
    return undefined
  }
}

const dedupeContracts = (
  contracts: ReadonlyArray<DiscoveredContract>
): ReadonlyArray<DiscoveredContract> => {
  const seen = new Set<string>()
  const deduped: Array<DiscoveredContract> = []

  for (const contract of contracts) {
    const key = `${contract.type}:${contract.sharedPath}:${contract.exportName}:${contract.rpcPath ?? ""}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(contract)
  }

  return deduped
}

const defaultEntryName = (
  type: "http" | "rpc",
  index: number,
  contracts: ReadonlyArray<DiscoveredContract>
): string => {
  const sameTypeBefore = contracts.slice(0, index).filter((contract) => contract.type === type).length
  if (sameTypeBefore === 0) return type === "http" ? "api" : "rpc"
  return `${type === "http" ? "api" : "rpc"}${sameTypeBefore + 1}`
}

const toProjectRelativePath = (config: ResolvedConfig, filePath: string): string => {
  const relativePath = path.relative(config.root, filePath).replace(/\\/g, "/")
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`
}

const splitTopLevelComma = (source: string): ReadonlyArray<string> => {
  const parts: Array<string> = []
  let start = 0
  let depth = 0

  for (let index = 0; index < source.length; index++) {
    const char = source[index]
    if (char === "<" || char === "(" || char === "{" || char === "[") depth++
    if (char === ">" || char === ")" || char === "}" || char === "]") depth--
    if (char === "," && depth === 0) {
      parts.push(source.slice(start, index))
      start = index + 1
    }
  }

  parts.push(source.slice(start))
  return parts
}
