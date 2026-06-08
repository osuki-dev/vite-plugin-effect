import * as SchemaAST from "effect/SchemaAST"
import * as Schema from "effect/Schema"
import { SchemaRepresentation } from "effect"

export interface SchemaInfo {
  readonly identifier: string
  readonly schema: Schema.Top
  readonly ast: SchemaAST.AST
  readonly code: SchemaRepresentation.Code
}

export interface SchemaRegistry {
  readonly schemas: ReadonlyMap<string, SchemaInfo>
  readonly declarations: ReadonlyArray<string>
  readonly typeAliases: ReadonlyArray<string>
  readonly getIdentifier: (schema: Schema.Top) => string | undefined
  readonly getExpression: (schema: Schema.Top) => string | undefined
}

export function collectSchemas(schemas: ReadonlyArray<Schema.Top>, schemaNames?: Map<Schema.Top, string>): SchemaRegistry {
  const schemaMap = new Map<string, SchemaInfo>()
  const objectToId = new Map<Schema.Top, string>()
  const declarations: Array<string> = []
  const publicAliasToId = new Map<string, string>()
  const privateSharedRuntimeNames = new Set<string>()

  const schemaJsonToName = buildSchemaJsonToName(schemaNames)
  const schemaFingerprints = schemas.map(getSchemaFingerprint)
  const schemaUseCountByFingerprint = countBy(schemaFingerprints)
  const privateIdByFingerprint = new Map<string, string>()
  const schemaNaming = schemas.map((schema) => {
    const publicName = getPublicSchemaIdentifier(schema, schemaNames)
    return {
      identifier: publicName ?? getSchemaIdentifierWithCache(schema, schemaNames, schemaJsonToName),
      publicName
    }
  })
  const publicTypeNames = new Set([
    ...Array.from(schemaNames?.values() ?? []),
    ...schemaNaming.flatMap((naming) => naming.publicName ? [naming.publicName] : []),
  ])
  const schemaByPublicName = new Map<string, Schema.Top>()
  for (const [schema, name] of schemaNames?.entries() ?? []) {
    if (!schemaByPublicName.has(name)) {
      schemaByPublicName.set(name, schema)
    }
  }
  const schemaByIdentifier = new Map<string, Schema.Top>()
  for (let i = 0; i < schemas.length; i++) {
    const identifier = schemaNaming[i]!.identifier
    if (!schemaByIdentifier.has(identifier)) {
      schemaByIdentifier.set(identifier, schemas[i]!)
    }
  }

  const asts = schemas.map(s => SchemaAST.toType(s.ast))

  if (asts.length === 0) {
    return {
      schemas: schemaMap,
      declarations: [],
      typeAliases: [],
      getIdentifier: () => undefined,
      getExpression: () => undefined
    }
  }

  const firstAst = asts[0]!
  const multiDocument =
    asts.length === 1
      ? SchemaRepresentation.toMultiDocument(SchemaRepresentation.fromAST(firstAst))
      : SchemaRepresentation.fromASTs(asts as [SchemaAST.AST, ...Array<SchemaAST.AST>])

  const codeDoc = SchemaRepresentation.toCodeDocument(multiDocument)

  // Track used identifiers to ensure uniqueness
  const usedIds = new Set<string>()

  function ensureUniqueId(id: string): string {
    if (!usedIds.has(id)) {
      usedIds.add(id)
      return id
    }
    let suffix = 0
    let candidate = id
    while (usedIds.has(candidate)) {
      candidate = `${id}${++suffix}`
    }
    usedIds.add(candidate)
    return candidate
  }

  // Map runtime strings to identifiers to deduplicate identical schemas
  const runtimeToId = new Map<string, string>()

  // Process references (non-recursive and recursive)
  for (const { $ref, code } of codeDoc.references.nonRecursives) {
    const schema = schemaByPublicName.get($ref) ?? schemaByIdentifier.get($ref)
    const uniqueId = ensureUniqueId($ref)
    if (schema) {
      schemaMap.set(uniqueId, {
        identifier: uniqueId,
        schema,
        ast: schema.ast,
        code
      })
      objectToId.set(schema, uniqueId)
      runtimeToId.set(code.runtime, uniqueId)
      if (publicTypeNames.has(uniqueId)) {
        publicAliasToId.set(uniqueId, uniqueId)
      }
    }
    if (!isInternalGeneratedTypeName(uniqueId, publicTypeNames)) {
      publicAliasToId.set(uniqueId, uniqueId)
    }
    declarations.push(`const ${$ref} = ${code.runtime}`)
  }

  for (const [$ref, code] of Object.entries(codeDoc.references.recursives)) {
    const schema = schemaByPublicName.get($ref) ?? schemaByIdentifier.get($ref)
    const uniqueId = ensureUniqueId($ref)
    if (schema) {
      schemaMap.set(uniqueId, {
        identifier: uniqueId,
        schema,
        ast: schema.ast,
        code
      })
      objectToId.set(schema, uniqueId)
      runtimeToId.set(code.runtime, uniqueId)
      if (publicTypeNames.has(uniqueId)) {
        publicAliasToId.set(uniqueId, uniqueId)
      }
    }
    if (!isInternalGeneratedTypeName(uniqueId, publicTypeNames)) {
      publicAliasToId.set(uniqueId, uniqueId)
    }
    declarations.push(`const ${$ref} = ${code.runtime}`)
  }

  // Process main schemas - deduplicate by runtime
  for (let i = 0; i < codeDoc.codes.length; i++) {
    const code = codeDoc.codes[i]!
    const schema = schemas[i]!
    const existingSchemaId = objectToId.get(schema)
    if (existingSchemaId) {
      continue
    }

    let id = schemaNaming[i]!.identifier
    const isPublic = schemaNaming[i]!.publicName !== undefined || publicTypeNames.has(id)
    const existingPublicId = isPublic ? publicAliasToId.get(id) : undefined
    if (existingPublicId) {
      objectToId.set(schema, existingPublicId)
      continue
    }

    const existingId = runtimeToId.get(code.runtime)
    if (existingId) {
      objectToId.set(schema, existingId)
      if (isPublic) {
        publicAliasToId.set(schemaNaming[i]!.identifier, existingId)
      }
      continue
    }

    const fingerprint = schemaFingerprints[i]!
    const shouldEmitPrivateShared =
      !isPublic && (schemaUseCountByFingerprint.get(fingerprint) ?? 0) > 1
    if (shouldEmitPrivateShared) {
      id = privateIdByFingerprint.get(fingerprint) ?? ensureUniqueId(`__schema${privateIdByFingerprint.size}`)
      privateIdByFingerprint.set(fingerprint, id)
      privateSharedRuntimeNames.add(id)
    } else {
      id = ensureUniqueId(id)
    }
    if (isPublic) {
      publicAliasToId.set(schemaNaming[i]!.identifier, id)
    }

    runtimeToId.set(code.runtime, id)
    schemaMap.set(id, {
      identifier: id,
      schema,
      ast: schema.ast,
      code
    })
    objectToId.set(schema, id)

    // Main schemas are already defined in references, don't duplicate
    const existingDecl = declarations.find(d => d.startsWith(`const ${id} =`))
    if (!existingDecl) {
      declarations.push(`const ${id} = ${code.runtime}`)
    }
  }

  // Replace inline definitions with references in declarations
  const sortedEntries = Array.from(runtimeToId.entries())
    .filter(([runtime, id]) =>
      !isIdentifierExpression(runtime) &&
      !["String", "Number", "Boolean", "Void", "Never", "Any", "Unknown", "Undefined"].includes(id)
    )
    .sort((a, b) => b[0].length - a[0].length)

  for (let i = 0; i < declarations.length; i++) {
    let decl = declarations[i]!
    const match = decl.match(/const (\w+) = /)
    const declId = match ? match[1] : undefined
    const assignmentIndex = decl.indexOf(" = ")
    const prefix = assignmentIndex === -1 ? "" : decl.slice(0, assignmentIndex + 3)
    let rhs = assignmentIndex === -1 ? decl : decl.slice(assignmentIndex + 3)
    for (const [inlineRuntime, refId] of sortedEntries) {
      if (declId === refId) continue
      rhs = rhs.replaceAll(inlineRuntime, refId)
    }
    declarations[i] = prefix ? `${prefix}${rhs}` : rhs
  }

  // Replacing inline schemas with shared identifiers can introduce runtime
  // dependencies between `const` declarations (for example
  // `Schema.Array(Todo)`). Keep dependencies before dependents so the generated
  // module does not hit temporal-dead-zone errors.
  const emittedRuntimeNames = new Set([
    ...publicAliasToId.values(),
    ...privateSharedRuntimeNames,
  ])
  const orderedDeclarations = foldPrivateAnnotatedDeclarations(orderDeclarationsByDependencies(declarations), emittedRuntimeNames)
  const declarationRhsByName = getDeclarationRhsByName(orderedDeclarations)
  const publicDeclarations = orderedDeclarations
    .filter((declaration) => {
      const name = declaration.match(/^const (\w+) = /)?.[1]
      return name !== undefined && emittedRuntimeNames.has(name)
    })
    .map((declaration) => {
      const match = declaration.match(/^const (\w+) = (.*)$/)
      if (!match) return declaration
      const schema = schemaMap.get(match[1]!)?.schema
      const classDeclaration = schema ? generateSchemaClassDeclaration(match[1]!, schema) : undefined
      if (classDeclaration) return classDeclaration
      return `const ${match[1]!} = ${resolvePrivateRuntimeReferences(
        match[2]!,
        match[1]!,
        declarationRhsByName,
        emittedRuntimeNames
      )}`
    })
  const typeAliases = Array.from(publicAliasToId.entries())
    .map(([name, runtimeName]) => `export type ${name} = Schema.Schema.Type<typeof ${runtimeName}>`)

  return {
    schemas: schemaMap,
    declarations: publicDeclarations,
    typeAliases,
    getIdentifier: (schema: Schema.Top) => objectToId.get(schema),
    getExpression: (schema: Schema.Top) => {
      const id = objectToId.get(schema)
      if (!id) return undefined
      if (emittedRuntimeNames.has(id)) return id
      const rhs = declarationRhsByName.get(id)
      if (!rhs) return id
      return resolvePrivateRuntimeReferences(rhs, id, declarationRhsByName, emittedRuntimeNames)
    }
  }
}

export function getSchemaIdentifier(schema: Schema.Top, schemaNames?: Map<Schema.Top, string>): string {
  return getSchemaIdentifierWithCache(schema, schemaNames, buildSchemaJsonToName(schemaNames))
}

function getSchemaIdentifierWithCache(
  schema: Schema.Top,
  schemaNames: Map<Schema.Top, string> | undefined,
  schemaJsonToName: ReadonlyMap<string, string>
): string {
  const publicName = getPublicSchemaIdentifier(schema, schemaNames)
  if (publicName !== undefined) {
    return publicName
  }

  // Try to match by AST structure (for encoded schemas that are equivalent to original)
  if (schemaJsonToName.size > 0) {
    const schemaJson = JSON.stringify(SchemaAST.toType(schema.ast))
    const name = schemaJsonToName.get(schemaJson)
    if (name !== undefined) {
      return name
    }
  }

  // Generate a default identifier from the AST
  return generateIdentifierFromAst(schema.ast)
}

function getPublicSchemaIdentifier(schema: Schema.Top, schemaNames?: Map<Schema.Top, string>): string | undefined {
  const resolvedIdentifier = SchemaAST.resolveIdentifier(schema.ast)
  if (typeof resolvedIdentifier === "string" && resolvedIdentifier.length > 0) {
    return resolvedIdentifier
  }

  const resolvedTitle = SchemaAST.resolveTitle(schema.ast)
  if (typeof resolvedTitle === "string" && resolvedTitle.length > 0) {
    return resolvedTitle
  }

  const ast = schema.ast as any
  const identifier = ast.annotations?.identifier
  if (typeof identifier === "string" && identifier.length > 0) {
    return identifier
  }

  const title = ast.annotations?.title
  if (typeof title === "string" && title.length > 0) {
    return title
  }

  // Check schemaNames map for named schemas from source exports
  const name = schemaNames?.get(schema)
  if (typeof name === "string" && name.length > 0) {
    return name
  }

  return undefined
}

function buildSchemaJsonToName(schemaNames?: Map<Schema.Top, string>): ReadonlyMap<string, string> {
  const map = new Map<string, string>()
  if (!schemaNames) return map
  for (const [schema, name] of schemaNames.entries()) {
    const schemaJson = JSON.stringify(SchemaAST.toType(schema.ast))
    if (!map.has(schemaJson)) {
      map.set(schemaJson, name)
    }
  }
  return map
}

function getSchemaFingerprint(schema: Schema.Top): string {
  return JSON.stringify(SchemaAST.toType(schema.ast))
}

function countBy(values: ReadonlyArray<string>): ReadonlyMap<string, number> {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return counts
}

function generateSchemaClassDeclaration(name: string, schema: Schema.Top): string | undefined {
  if (!isSchemaClass(schema)) return undefined

  const identifier = SchemaAST.resolveIdentifier(schema.ast) ?? name
  const fields = (schema as any).fields as Record<string, Schema.Top> | undefined
  const isErrorClass = (schema as any).prototype instanceof Error
  const tag = getTaggedClassTag(fields)
  const annotations = getClassAnnotationsExpression(schema, isErrorClass ? [] : ["httpApiStatus"])

  if (isErrorClass && tag !== undefined) {
    const taggedFields = getClassFieldsExpression(fields, { omitTag: true })
    const taggedErrorClass = identifier === tag
      ? `Schema.TaggedErrorClass<${name}>()`
      : `Schema.TaggedErrorClass<${name}>(${JSON.stringify(identifier)})`
    return `const ${name} = class ${name} extends ${taggedErrorClass}(${JSON.stringify(tag)}, ${taggedFields}${annotations ? `, ${annotations}` : ""}) {}`
  }

  const baseExpression = getClassBaseExpression(schema)
  if (!baseExpression) return undefined

  if (isErrorClass) {
    return `const ${name} = class ${name} extends Schema.ErrorClass<${name}>(${JSON.stringify(identifier)})(${baseExpression}${annotations ? `, ${annotations}` : ""}) {}`
  }

  return `const ${name} = class ${name} extends Schema.Class<${name}>(${JSON.stringify(identifier)})(${baseExpression}${annotations ? `, ${annotations}` : ""}) {}`
}

function isSchemaClass(schema: Schema.Top): boolean {
  return (
    typeof schema === "function" &&
    (schema as any).ast?._tag === "Declaration" &&
    (schema as any).fields !== undefined
  )
}

function getTaggedClassTag(fields: Record<string, Schema.Top> | undefined): string | undefined {
  const tagSchema = fields?._tag
  const literal = (tagSchema as any)?.ast?.literal
  return typeof literal === "string" ? literal : undefined
}

function getClassBaseExpression(schema: Schema.Top): string | undefined {
  const typeParameter = (schema.ast as any).typeParameters?.[0]
  if (!typeParameter) return undefined
  return astToInlineRuntimeExpression(typeParameter)
}

function getClassFieldsExpression(
  fields: Record<string, Schema.Top> | undefined,
  options: { readonly omitTag: boolean }
): string {
  if (!fields) return "{}"
  const entries = Object.entries(fields)
    .filter(([key]) => !options.omitTag || key !== "_tag")
    .map(([key, value]) => `${JSON.stringify(key)}: ${schemaToInlineRuntimeExpression(value)}`)
  return `{ ${entries.join(", ")} }`
}

function schemaToInlineRuntimeExpression(schema: Schema.Top): string {
  const expression = astToInlineRuntimeExpression(schema.ast)
  return (schema.ast as any).context?.isOptional === true
    ? `Schema.optionalKey(${expression})`
    : expression
}

function astToInlineRuntimeExpression(ast: SchemaAST.AST): string {
  const codeDoc = SchemaRepresentation.toCodeDocument(
    SchemaRepresentation.toMultiDocument(SchemaRepresentation.fromAST(ast))
  )
  let runtime = codeDoc.codes[0]?.runtime ?? "Schema.Unknown"
  const references = [
    ...codeDoc.references.nonRecursives.map((reference) => [reference.$ref, reference.code.runtime] as const),
    ...Object.entries(codeDoc.references.recursives).map(([key, code]) => [key, code.runtime] as const),
  ].sort((a, b) => b[0].length - a[0].length)
  for (const [identifier, expression] of references) {
    runtime = runtime.replace(new RegExp(`\\b${escapeRegExp(identifier)}\\b`, "g"), expression)
  }
  return runtime
}

function getClassAnnotationsExpression(schema: Schema.Top, omitKeys: ReadonlyArray<string>): string | undefined {
  const annotations = SchemaAST.resolve(schema.ast)
  if (!annotations) return undefined

  const omitted = new Set(["identifier", "~sentinels", ...omitKeys])
  const entries = Object.entries(annotations)
    .filter(([key, value]) => !omitted.has(key) && isJsonSerializable(value))
  if (entries.length === 0) return undefined

  return `{ ${entries.map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(", ")} }`
}

function isJsonSerializable(value: unknown): boolean {
  if (value === undefined || typeof value === "function" || typeof value === "symbol") return false
  try {
    JSON.stringify(value)
    return true
  } catch {
    return false
  }
}

function orderDeclarationsByDependencies(declarations: ReadonlyArray<string>): ReadonlyArray<string> {
  const declarationByName = new Map<string, string>()
  const unnamed: Array<string> = []

  for (const declaration of declarations) {
    const name = declaration.match(/^const (\w+) = /)?.[1]
    if (name) {
      declarationByName.set(name, declaration)
    } else {
      unnamed.push(declaration)
    }
  }

  const names = Array.from(declarationByName.keys())
  const ordered: Array<string> = [...unnamed]
  const visiting = new Set<string>()
  const visited = new Set<string>()

  const visit = (name: string) => {
    if (visited.has(name)) return
    if (visiting.has(name)) return
    visiting.add(name)

    const declaration = declarationByName.get(name)!
    for (const dependency of findDeclarationDependencies(declaration, name, names)) {
      visit(dependency)
    }

    visiting.delete(name)
    visited.add(name)
    ordered.push(declaration)
  }

  for (const name of names) {
    visit(name)
  }

  return ordered
}

function foldPrivateAnnotatedDeclarations(
  declarations: ReadonlyArray<string>,
  publicTypeNames: ReadonlySet<string>
): ReadonlyArray<string> {
  const rhsByName = new Map<string, string>()
  for (const declaration of declarations) {
    const match = declaration.match(/^const (\w+) = (.*)$/)
    if (!match) continue
    rhsByName.set(match[1]!, match[2]!)
  }

  const folded = new Map<string, string>()
  const removed = new Set<string>()
  for (const [name, rhs] of rhsByName) {
    const annotate = rhs.match(/^(\w+)\.annotate\((.*)\)$/)
    if (!annotate) continue

    const privateName = annotate[1]!
    if (publicTypeNames.has(privateName) || !isInternalGeneratedTypeName(privateName, publicTypeNames)) {
      continue
    }

    const privateRhs = rhsByName.get(privateName)
    if (!privateRhs || countIdentifierReferences(declarations, privateName) !== 1) {
      continue
    }

    folded.set(name, `const ${name} = ${privateRhs}.annotate(${annotate[2]!})`)
    removed.add(privateName)
  }

  return declarations
    .filter((declaration) => {
      const name = declaration.match(/^const (\w+) = /)?.[1]
      return !name || !removed.has(name)
    })
    .map((declaration) => {
      const name = declaration.match(/^const (\w+) = /)?.[1]
      return name ? folded.get(name) ?? declaration : declaration
    })
}

function getDeclarationRhsByName(declarations: ReadonlyArray<string>): ReadonlyMap<string, string> {
  const map = new Map<string, string>()
  for (const declaration of declarations) {
    const match = declaration.match(/^const (\w+) = (.*)$/)
    if (match) {
      map.set(match[1]!, match[2]!)
    }
  }
  return map
}

function resolvePrivateRuntimeReferences(
  expression: string,
  currentName: string,
  declarationRhsByName: ReadonlyMap<string, string>,
  publicTypeNames: ReadonlySet<string>
): string {
  const resolving = new Set<string>([currentName])

  const resolveName = (name: string): string | undefined => {
    if (publicTypeNames.has(name) || resolving.has(name)) return undefined
    const target = declarationRhsByName.get(name)
    if (!target) return undefined
    resolving.add(name)
    const resolved = replacePrivateRuntimeReferences(target)
    resolving.delete(name)
    return resolved
  }

  const replacePrivateRuntimeReferences = (value: string): string =>
    value.replace(/\b[A-Za-z_$][\w$]*\b/g, (token, offset: number, source: string) => {
      if (isPropertyAccessToken(source, offset)) return token
      return resolveName(token) ?? token
    })

  return replacePrivateRuntimeReferences(expression)
}

function countIdentifierReferences(declarations: ReadonlyArray<string>, identifier: string): number {
  let count = 0
  const pattern = new RegExp(`\\b${escapeRegExp(identifier)}\\b`, "g")
  for (const declaration of declarations) {
    const rhs = declaration.slice(declaration.indexOf(" = ") + 3)
    count += stripStringLiterals(rhs).match(pattern)?.length ?? 0
  }
  return count
}

function findDeclarationDependencies(
  declaration: string,
  currentName: string,
  names: ReadonlyArray<string>
): ReadonlyArray<string> {
  const rhs = declaration.slice(declaration.indexOf(" = ") + 3)
  const withoutStrings = stripStringLiterals(rhs)
  const tokens = getFreeIdentifierTokens(withoutStrings)
  const dependencies: Array<string> = []

  for (const name of names) {
    if (name === currentName) continue
    if (isGeneratedVariantOf(currentName, name)) continue
    if (tokens.has(name)) {
      dependencies.push(name)
    }
  }

  return dependencies
}

function isIdentifierExpression(value: string): boolean {
  return /^[A-Za-z_$][\w$]*$/.test(value)
}

function isGeneratedVariantOf(value: string, base: string): boolean {
  return value.startsWith(base) && /^\d+$/.test(value.slice(base.length))
}

function isInternalGeneratedTypeName(name: string, publicTypeNames: ReadonlySet<string>): boolean {
  if (publicTypeNames.has(name)) return false
  for (const publicName of publicTypeNames) {
    if (isGeneratedVariantOf(name, publicName)) return true
  }
  if (/^[A-Za-z_$][\w$]*\d+$/.test(name)) return true
  return /^(?:Literal_.+|Symbol_.+|(String|Number|Boolean|Schema|Tuple|Struct|Union|Suspend|Enum|TemplateLiteral|Object|Undefined|Void|Never|Any|Unknown|BigInt|Null)\d*)$/.test(name)
}

function stripStringLiterals(value: string): string {
  return value.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, " ")
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function getFreeIdentifierTokens(value: string): ReadonlySet<string> {
  const tokens = new Set<string>()
  const pattern = /[A-Za-z_$][\w$]*/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(value)) !== null) {
    const index = match.index
    let previous = index - 1
    while (previous >= 0 && /\s/.test(value[previous]!)) {
      previous--
    }
    if (previous >= 0 && value[previous] === ".") {
      continue
    }
    tokens.add(match[0])
  }
  return tokens
}

function isPropertyAccessToken(source: string, index: number): boolean {
  let previous = index - 1
  while (previous >= 0 && /\s/.test(source[previous]!)) {
    previous--
  }
  return previous >= 0 && source[previous] === "."
}

function generateIdentifierFromAst(ast: SchemaAST.AST): string {
  switch (ast._tag) {
    case "String":
      return "String"
    case "Number":
      return "Number"
    case "Boolean":
      return "Boolean"
    case "Literal":
      return `Literal_${JSON.stringify((ast as any).literal).replace(/[^a-zA-Z0-9]/g, "_")}`
    case "UniqueSymbol":
      return `Symbol_${(ast as any).symbol.toString().replace(/[^a-zA-Z0-9]/g, "_")}`
    case "Declaration":
      return (ast as any).typeParameters?.[0]?.ast?._tag === "String"
        ? "String"
        : "Schema"
    case "Arrays":
      return "Tuple"
    case "Objects":
      return "Struct"
    case "Union":
      return "Union"
    case "Suspend":
      return "Suspend"
    case "Enum":
      return "Enum"
    case "TemplateLiteral":
      return "TemplateLiteral"
    case "ObjectKeyword":
      return "Object"
    case "Undefined":
      return "Undefined"
    case "Void":
      return "Void"
    case "Never":
      return "Never"
    case "Any":
      return "Any"
    case "Unknown":
      return "Unknown"
    case "BigInt":
      return "BigInt"
    case "Symbol":
      return "Symbol"
    case "Null":
      return "Null"
    default:
      return "Schema_"
  }
}
