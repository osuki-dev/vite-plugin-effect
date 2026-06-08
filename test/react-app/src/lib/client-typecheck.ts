import type { Api, Rpc } from "virtual:effect/client"

type IsAny<T> = 0 extends (1 & T) ? true : false
type ExpectFalse<T extends false> = T

// Included by tsconfig.app.json so virtual client editor regressions fail tsc.
export type ClientIsTyped = ExpectFalse<IsAny<typeof import("virtual:effect/client").client>>
export type PromiseClientIsTyped = ExpectFalse<IsAny<typeof import("virtual:effect/client").promiseClient>>
export type EffectClientIsTyped = ExpectFalse<IsAny<typeof import("virtual:effect/client").effectClient>>
export type HttpPayloadIsTyped = ExpectFalse<IsAny<Api.todos.createTodo.Payload>>
export type RpcPayloadIsTyped = ExpectFalse<IsAny<Rpc.toggleTodo.Payload>>
