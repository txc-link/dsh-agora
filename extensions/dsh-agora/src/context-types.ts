import type { IncomingMessage, ServerResponse } from 'node:http'
import type {} from 'cordis'
import type { AgoraCommandResult, DshAgoraServiceApi } from './contracts.js'
import type { DshToolRegistry } from './tool.js'
import type { DshAgoraExtensionRegistryApi } from './extension-sdk.js'

export interface DshAgentLike {
  readonly id?: string
  readonly session?: { readonly id?: string }
}

export interface DshCommandInvocation {
  readonly rawInput: string
  readonly agent: DshAgentLike
  readonly signal: AbortSignal
}

export interface DshCommandDefinition {
  readonly name: string
  readonly description: string
  readonly input?: { readonly hint: string; readonly images?: boolean }
  handler(invocation: DshCommandInvocation): AgoraCommandResult | Promise<AgoraCommandResult>
}

export interface DshCommands {
  register(definition: DshCommandDefinition): () => void
}

export interface DshWebServer {
  readonly port?: number
  register(route: {
    readonly kind: 'exact' | 'prefix'
    readonly path: string
    handler(req: IncomingMessage, res: ServerResponse): void | Promise<void>
  }): () => void
}

export interface DshAgoraContext {
  readonly commands: DshCommands
  readonly tools: DshToolRegistry
  get?(name: string): unknown
  inject?(
    services: readonly string[],
    callback: (ctx: DshAgoraContext) => void | (() => void),
  ): unknown
  accessor?(name: string, descriptor: { get(): unknown }): unknown
  effect?(effect: () => void | (() => void), label?: string): void
}

declare module 'cordis' {
  interface Context {
    dshAgora: DshAgoraServiceApi & DshAgoraExtensionRegistryApi
  }
}
