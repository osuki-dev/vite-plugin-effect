import * as Schema from "effect/Schema"
import * as RpcGroup from "effect/unstable/rpc/RpcGroup"

export interface RpcInfo {
  readonly tag: string
  readonly payload: Schema.Top | undefined
  readonly success: Schema.Top | undefined
  readonly error: Schema.Top | undefined
}

export interface RpcGroupInfo {
  readonly rpcs: ReadonlyArray<RpcInfo>
  readonly schemas: ReadonlyArray<Schema.Top>
  readonly schemaNames?: Map<Schema.Top, string>
}

export function reflectRpcGroup(group: RpcGroup.Any, schemaNames?: Map<Schema.Top, string>): RpcGroupInfo {
  const rpcs: Array<RpcInfo> = []
  const schemas: Array<Schema.Top> = []

  const rpcGroup = group as RpcGroup.RpcGroup<any>
  for (const [tag, rpc] of rpcGroup.requests) {
    const rpcAny = rpc as any
    const payload = rpcAny.payloadSchema as Schema.Top | undefined
    const success = rpcAny.successSchema as Schema.Top | undefined
    const error = rpcAny.errorSchema as Schema.Top | undefined

    rpcs.push({
      tag,
      payload,
      success,
      error
    })

    if (payload) schemas.push(payload)
    if (success) schemas.push(success)
    if (error) schemas.push(error)
  }

  return {
    rpcs,
    schemas,
    schemaNames
  }
}
