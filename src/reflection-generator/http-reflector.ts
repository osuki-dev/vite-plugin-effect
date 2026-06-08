import * as Schema from "effect/Schema"
import * as HttpApi from "effect/unstable/httpapi/HttpApi"
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint"

const HttpApiEndpointReflection = HttpApiEndpoint as typeof HttpApiEndpoint & {
  readonly getPayloadSchemas: (endpoint: HttpApiEndpoint.AnyWithProps) => Array<Schema.Top>
  readonly getSuccessSchemas: (endpoint: HttpApiEndpoint.AnyWithProps) => [Schema.Top, ...Array<Schema.Top>]
  readonly getErrorSchemas: (endpoint: HttpApiEndpoint.AnyWithProps) => Array<Schema.Top>
}

export interface HttpEndpointInfo {
  readonly name: string
  readonly path: string
  readonly method: string
  readonly params: Schema.Top | undefined
  readonly query: Schema.Top | undefined
  readonly payload: Schema.Top | undefined
  readonly headers: Schema.Top | undefined
  readonly success: Schema.Top | undefined
  readonly error: Schema.Top | undefined
  readonly groupIdentifier: string
  readonly groupTopLevel: boolean
}

export interface HttpApiInfo {
  readonly identifier: string
  readonly endpoints: ReadonlyArray<HttpEndpointInfo>
  readonly schemas: ReadonlyArray<Schema.Top>
  readonly schemaNames?: Map<Schema.Top, string>
}

export function reflectHttpApi(api: HttpApi.AnyWithProps, identifier?: string, schemaNames?: Map<Schema.Top, string>): HttpApiInfo {
  const endpoints: Array<HttpEndpointInfo> = []
  const schemas: Array<Schema.Top> = []

  const apiId = identifier || (api as any).identifier || "Api"

  HttpApi.reflect(api, {
    onGroup({ group }) {
      // group level
    },
    onEndpoint({ group, endpoint }) {
      const successSchemas = HttpApiEndpointReflection.getSuccessSchemas(endpoint)
      const errorSchemas = HttpApiEndpointReflection.getErrorSchemas(endpoint)
      const payloadSchemas = HttpApiEndpointReflection.getPayloadSchemas(endpoint)
      const payloadSchema = payloadSchemas.length > 0
        ? payloadSchemas.length === 1
          ? payloadSchemas[0]
          : Schema.Union(payloadSchemas as [Schema.Top, ...Array<Schema.Top>])
        : undefined

      const successSchema = successSchemas.length > 0
        ? successSchemas.length === 1
          ? successSchemas[0]
          : Schema.Union(successSchemas as [Schema.Top, ...Array<Schema.Top>])
        : undefined

      const errorSchema = errorSchemas.length > 0
        ? errorSchemas.length === 1
          ? errorSchemas[0]
          : Schema.Union(errorSchemas as [Schema.Top, ...Array<Schema.Top>])
        : undefined

      endpoints.push({
        name: endpoint.name,
        path: endpoint.path,
        method: endpoint.method,
        params: endpoint.params,
        query: endpoint.query,
        payload: payloadSchema,
        headers: endpoint.headers,
        success: successSchema,
        error: errorSchema,
        groupIdentifier: group.identifier,
        groupTopLevel: group.topLevel
      })

      // Collect all schemas for code generation
      if (endpoint.params) schemas.push(endpoint.params)
      if (endpoint.query) schemas.push(endpoint.query)
      if (payloadSchema) schemas.push(payloadSchema)
      if (endpoint.headers) schemas.push(endpoint.headers)
      if (successSchema) schemas.push(successSchema)
      if (errorSchema) schemas.push(errorSchema)
    }
  })

  return {
    identifier: apiId,
    endpoints,
    schemas,
    schemaNames
  }
}
