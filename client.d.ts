declare module "vite-plugin-effect/client" {
  export interface EffectClientConfig {}

  export type EffectClient = EffectClientConfig extends {
    readonly client: infer Client
  } ? Client : unknown

  export type PromiseClient = AwaitableClient<EffectClient>

  export type Client = EffectClientConfig extends {
    readonly defaultClient: infer DefaultClient
  } ? DefaultClient : PromiseClient

  export type AwaitableClient<T> =
    T extends (...args: infer Args) => infer Return
      ? (...args: AwaitableClientArgs<Args>) => AwaitableClientReturn<Return>
      : T extends object
        ? { readonly [Key in keyof T]: AwaitableClient<T[Key]> }
        : T

  export type AwaitableClientArgs<Args extends ReadonlyArray<unknown>> =
    Args extends [request: infer Request]
      ? [request: AwaitableClientRequest<Request>]
      : Args extends [request?: infer Request]
        ? [request?: AwaitableClientRequest<Request>]
        : Args

  export type AwaitableClientRequest<Request> =
    Request extends object
      ? Exclude<keyof Request, "responseMode"> extends "payload"
        ? Request | Request extends { readonly payload: infer Payload } ? Payload : never
        : Request
      : Request

  export type AwaitableClientReturn<T> =
    T extends import("effect").Effect.Effect<infer Success, infer _Error, infer _Services>
      ? Promise<Success>
      : T extends import("effect").Stream.Stream<infer _Success, infer _Error, infer _Services>
        ? T
        : T

  export type ClientMethod = (...args: ReadonlyArray<any>) => any

  export type MethodInput<Method> =
    Method extends (...args: infer Args) => any
      ? Args extends []
        ? void
        : Args[0]
      : never

  export type MethodPayload<Input> =
    Input extends { readonly payload: infer Payload } ? Payload : Input

  export type MethodResult<Method> =
    Method extends (...args: ReadonlyArray<any>) => infer Return ? Awaited<Return> : never
}

declare module "virtual:effect/client" {
  export const effectClient: import("vite-plugin-effect/client").EffectClient
  export const promiseClient: import("vite-plugin-effect/client").PromiseClient
  export const client: import("vite-plugin-effect/client").Client
  export type EffectClient = import("vite-plugin-effect/client").EffectClient
  export type PromiseClient = import("vite-plugin-effect/client").PromiseClient
  export type Client = import("vite-plugin-effect/client").Client
}
