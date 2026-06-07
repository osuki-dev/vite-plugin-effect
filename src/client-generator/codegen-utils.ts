export const lt = String.fromCharCode(60)
export const gt = String.fromCharCode(62)

export const typeApplication = (name: string, parameter: string): string =>
  name + lt + parameter + gt

export interface SchemaExport {
  readonly name: string
  readonly specifier: string
}

export const entryValueName = (index: number): string => `__effectEntry${index}`
export const entryConstName = (index: number): string => `__effectClient${index}`
export const entryTypeName = (index: number): string => `Entry${index}`

export const toPascalIdentifier = (name: string): string => {
  const normalized = name
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("")
    .replace(/^[0-9]+/, "")
  if (!normalized || normalized === "Effect" || normalized === "Promise") return ""
  return normalized
}

export const typeAlias = (name: string, parameters: string, value: string): string =>
  "export type " + name + lt + parameters + gt + " = " + value
