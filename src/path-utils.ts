import * as path from "node:path"
import type { ResolvedConfig } from "vite"

export const resolveProjectPath = (config: ResolvedConfig, filePath: string): string =>
  path.resolve(config.root, filePath).replace(/\\/g, "/")

export const toRelativeTypeImport = (
  config: ResolvedConfig,
  fromFile: string,
  toFile: string
): string => {
  const relativePath = path.relative(path.dirname(fromFile), path.resolve(config.root, toFile))
    .replace(/\\/g, "/")
  return relativePath.startsWith(".") ? relativePath : `./${relativePath}`
}
