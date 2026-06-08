import * as fs from "node:fs/promises"
import { statSync } from "node:fs"
import * as path from "node:path"
import * as ts from "typescript"
import type { ResolvedConfig } from "vite"
import { defaultApiPrefix, defaultRpcPath } from "./defaults"
import type { DiscoveredEntry, ResolvedPluginOptions } from "./options"
import { resolveProjectPath } from "./path-utils"

interface EffectBindings {
  readonly httpApi: ReadonlySet<string>
  readonly httpApiBuilder: ReadonlySet<string>
  readonly rpcGroup: ReadonlySet<string>
  readonly rpcServer: ReadonlySet<string>
  readonly importAliases: ReadonlyMap<string, string>
  readonly importSources: ReadonlyMap<string, string>
}

interface DiscoveredContract {
  readonly type: "http" | "rpc"
  readonly displayName: string
  readonly expression: string
  readonly schemaSourcePath?: string
  readonly rpcPath?: string
}

export const discoverEntriesFromServerEntry = async (
  options: ResolvedPluginOptions,
  config: ResolvedConfig
): Promise<ReadonlyArray<DiscoveredEntry>> => {
  if (!options.serverEntry) {
    return []
  }

  const serverEntryPath = resolveProjectPath(config, options.serverEntry)
  const source = await readSource(serverEntryPath)
  if (!source) {
    return []
  }

  const contracts = discoverContracts(source, serverEntryPath)
  const deduped = dedupeContracts(contracts)
  if (deduped.length === 0) {
    return []
  }

  const reflectionSourcePath = toProjectRelativePath(config, serverEntryPath)

  return deduped.map((contract, index) => ({
    type: contract.type,
    name: defaultEntryName(contract.type, index, deduped),
    exportName: contract.displayName,
    sharedPath: contract.schemaSourcePath
      ? toProjectRelativePath(config, contract.schemaSourcePath)
      : reflectionSourcePath,
    apiPrefix: defaultApiPrefix,
    rpcPath: contract.type === "rpc" ? contract.rpcPath ?? defaultRpcPath : defaultRpcPath,
    reflectionName: `__vitePluginEffectContract${index}`,
    reflectionSourcePath,
    reflectionExpression: contract.expression,
  }))
}

const readSource = async (filePath: string): Promise<string> => {
  try {
    return await fs.readFile(filePath, "utf8")
  } catch (error) {
    console.warn(`[vite-plugin-effect] failed to read serverEntry ${filePath}: ${(error as Error).message}`)
    return ""
  }
}

const discoverContracts = (
  source: string,
  fileName: string
): ReadonlyArray<DiscoveredContract> => {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const bindings = collectEffectBindings(sourceFile)
  const contracts: Array<DiscoveredContract> = []

  const visit = (node: ts.Node) => {
    if (ts.isVariableStatement(node) && hasExportModifier(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue
        if (isHttpApiExpression(declaration.initializer, bindings)) {
          contracts.push({
            type: "http",
            displayName: declaration.name.text,
            expression: declaration.name.text,
          })
        }
        if (isRpcGroupExpression(declaration.initializer, bindings)) {
          contracts.push({
            type: "rpc",
            displayName: declaration.name.text,
            expression: declaration.name.text,
          })
        }
      }
    }

    if (ts.isCallExpression(node)) {
      const httpContract = discoverHttpContract(node, sourceFile, bindings)
      if (httpContract) {
        contracts.push(httpContract)
      }

      const rpcContract = discoverRpcContract(node, sourceFile, bindings)
      if (rpcContract) {
        contracts.push(rpcContract)
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return contracts
}

const collectEffectBindings = (sourceFile: ts.SourceFile): EffectBindings => {
  const httpApi = new Set<string>(["HttpApi"])
  const httpApiBuilder = new Set<string>(["HttpApiBuilder"])
  const rpcGroup = new Set<string>(["RpcGroup"])
  const rpcServer = new Set<string>(["RpcServer"])
  const importAliases = new Map<string, string>()
  const importSources = new Map<string, string>()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue

    const moduleName = statement.moduleSpecifier.text
    const importClause = statement.importClause
    if (!importClause) continue
    collectImportMetadata(importClause, moduleName, sourceFile.fileName, importAliases, importSources)

    if (moduleName === "effect/unstable/httpapi") {
      collectNamedImport(importClause, "HttpApi", httpApi)
      collectNamedImport(importClause, "HttpApiBuilder", httpApiBuilder)
    }
    if (moduleName === "effect/unstable/httpapi/HttpApi") {
      collectNamespaceOrDefaultImport(importClause, httpApi)
    }
    if (moduleName === "effect/unstable/httpapi/HttpApiBuilder") {
      collectNamespaceOrDefaultImport(importClause, httpApiBuilder)
    }

    if (moduleName === "effect/unstable/rpc") {
      collectNamedImport(importClause, "RpcGroup", rpcGroup)
      collectNamedImport(importClause, "RpcServer", rpcServer)
    }
    if (moduleName === "effect/unstable/rpc/RpcGroup") {
      collectNamespaceOrDefaultImport(importClause, rpcGroup)
    }
    if (moduleName === "effect/unstable/rpc/RpcServer") {
      collectNamespaceOrDefaultImport(importClause, rpcServer)
    }
  }

  return { httpApi, httpApiBuilder, rpcGroup, rpcServer, importAliases, importSources }
}

const collectImportMetadata = (
  importClause: ts.ImportClause,
  moduleName: string,
  fromFile: string,
  aliases: Map<string, string>,
  sources: Map<string, string>
): void => {
  const namedBindings = importClause.namedBindings
  if (!namedBindings || !ts.isNamedImports(namedBindings)) return
  const sourcePath = resolveImportFile(fromFile, moduleName)

  for (const element of namedBindings.elements) {
    const imported = element.propertyName?.text ?? element.name.text
    aliases.set(element.name.text, imported)
    if (sourcePath) {
      sources.set(element.name.text, sourcePath)
    }
  }
}

const collectNamedImport = (
  importClause: ts.ImportClause,
  importedName: string,
  result: Set<string>
): void => {
  const namedBindings = importClause.namedBindings
  if (!namedBindings || !ts.isNamedImports(namedBindings)) return

  for (const element of namedBindings.elements) {
    const name = element.propertyName?.text ?? element.name.text
    if (name === importedName) {
      result.add(element.name.text)
    }
  }
}

const collectNamespaceOrDefaultImport = (
  importClause: ts.ImportClause,
  result: Set<string>
): void => {
  if (importClause.name) {
    result.add(importClause.name.text)
  }

  const namedBindings = importClause.namedBindings
  if (namedBindings && ts.isNamespaceImport(namedBindings)) {
    result.add(namedBindings.name.text)
  }
}

const discoverHttpContract = (
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  bindings: EffectBindings
): DiscoveredContract | undefined => {
  const callee = getNamespacedCall(node)
  if (!callee) return undefined
  if (!bindings.httpApiBuilder.has(callee.namespace)) return undefined
  if (callee.method !== "layer" && callee.method !== "group") return undefined

  const expression = node.arguments[0]
  if (!expression) return undefined

  return {
    type: "http",
    displayName: expressionDisplayName(expression, "Api", bindings),
    expression: expression.getText(sourceFile),
    schemaSourcePath: expressionSchemaSourcePath(expression, bindings),
  }
}

const discoverRpcContract = (
  node: ts.CallExpression,
  sourceFile: ts.SourceFile,
  bindings: EffectBindings
): DiscoveredContract | undefined => {
  const callee = getNamespacedCall(node)
  if (!callee) return undefined
  if (!bindings.rpcServer.has(callee.namespace)) return undefined

  if (callee.method === "layerHttp") {
    const options = node.arguments[0]
    if (!options || !ts.isObjectLiteralExpression(options)) return undefined

    const group = getObjectPropertyInitializer(options, "group")
    if (!group) return undefined

    return {
      type: "rpc",
      displayName: expressionDisplayName(group, "Rpc", bindings),
      expression: group.getText(sourceFile),
      schemaSourcePath: expressionSchemaSourcePath(group, bindings),
      rpcPath: getStaticStringObjectProperty(options, "path"),
    }
  }

  if (callee.method === "layer") {
    const expression = node.arguments[0]
    if (!expression) return undefined
    return {
      type: "rpc",
      displayName: expressionDisplayName(expression, "Rpc", bindings),
      expression: expression.getText(sourceFile),
      schemaSourcePath: expressionSchemaSourcePath(expression, bindings),
    }
  }

  return undefined
}

const getNamespacedCall = (
  node: ts.CallExpression
): { readonly namespace: string; readonly method: string } | undefined => {
  const expression = node.expression
  if (!ts.isPropertyAccessExpression(expression)) return undefined
  if (!ts.isIdentifier(expression.expression)) return undefined
  return {
    namespace: expression.expression.text,
    method: expression.name.text,
  }
}

const getObjectPropertyInitializer = (
  object: ts.ObjectLiteralExpression,
  propertyName: string
): ts.Expression | undefined => {
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue
    if (propertyNameText(property.name) === propertyName) {
      return property.initializer
    }
  }
  return undefined
}

const getStaticStringObjectProperty = (
  object: ts.ObjectLiteralExpression,
  propertyName: string
): string | undefined => {
  const initializer = getObjectPropertyInitializer(object, propertyName)
  return initializer && ts.isStringLiteralLike(initializer) ? initializer.text : undefined
}

const propertyNameText = (name: ts.PropertyName): string | undefined => {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name) || ts.isNumericLiteral(name)) {
    return name.text
  }
  return undefined
}

const expressionDisplayName = (
  expression: ts.Expression,
  fallback: string,
  bindings: EffectBindings
): string => {
  if (ts.isIdentifier(expression)) {
    return bindings.importAliases.get(expression.text) ?? expression.text
  }
  if (ts.isPropertyAccessExpression(expression)) {
    return expression.name.text
  }
  const makeName = getMakeCallName(expression)
  if (makeName) {
    return toIdentifier(makeName) || fallback
  }
  return fallback
}

const expressionSchemaSourcePath = (
  expression: ts.Expression,
  bindings: EffectBindings
): string | undefined => {
  if (ts.isIdentifier(expression)) {
    return bindings.importSources.get(expression.text)
  }
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    return bindings.importSources.get(expression.expression.text)
  }
  return undefined
}

const hasExportModifier = (node: ts.Node): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node)?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false)

const isHttpApiExpression = (expression: ts.Expression, bindings: EffectBindings): boolean =>
  isRootedMakeExpression(expression, bindings.httpApi)

const isRpcGroupExpression = (expression: ts.Expression, bindings: EffectBindings): boolean =>
  isRootedMakeExpression(expression, bindings.rpcGroup)

const isRootedMakeExpression = (expression: ts.Expression, namespaces: ReadonlySet<string>): boolean => {
  const unwrapped = unwrapExpression(expression)
  if (!ts.isCallExpression(unwrapped)) return false

  const namespaced = getNamespacedCall(unwrapped)
  if (namespaced?.method === "make" && namespaces.has(namespaced.namespace)) {
    return true
  }

  const callee = unwrapped.expression
  if (ts.isPropertyAccessExpression(callee) && ts.isCallExpression(callee.expression)) {
    return isRootedMakeExpression(callee.expression, namespaces)
  }

  return false
}

const getMakeCallName = (expression: ts.Expression): string | undefined => {
  const unwrapped = unwrapExpression(expression)
  if (!ts.isCallExpression(unwrapped)) return undefined

  const namespaced = getNamespacedCall(unwrapped)
  if (namespaced?.method === "make") {
    const firstArg = unwrapped.arguments[0]
    return firstArg && ts.isStringLiteralLike(firstArg) ? firstArg.text : undefined
  }

  const callee = unwrapped.expression
  if (ts.isPropertyAccessExpression(callee) && ts.isCallExpression(callee.expression)) {
    return getMakeCallName(callee.expression)
  }

  return undefined
}

const unwrapExpression = (expression: ts.Expression): ts.Expression => {
  let current = expression
  while (ts.isParenthesizedExpression(current)) {
    current = current.expression
  }
  return current
}

const toIdentifier = (value: string): string => {
  const candidate = value.replace(/[^A-Za-z0-9_$]+/g, "_").replace(/^[^A-Za-z_$]+/, "")
  return candidate && /^[A-Za-z_$]/.test(candidate) ? candidate : ""
}

const resolveImportFile = (fromFile: string, specifier: string): string | undefined => {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    return undefined
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
    const stat = requireStat(candidate)
    if (stat?.isFile()) return candidate.replace(/\\/g, "/")
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
    const key = `${contract.type}:${contract.expression}:${contract.rpcPath ?? ""}`
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
