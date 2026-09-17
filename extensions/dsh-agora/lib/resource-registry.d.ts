import type { RuntimeDispatch } from './contracts.js';
export interface RuntimeResourceBinding {
    readonly id: string;
    readonly kind: string;
    readonly aliases: readonly string[];
    readonly location: string;
    readonly allowedOperations: readonly string[];
    readonly secretPolicy: 'handle_only' | 'never';
}
export declare function resolveResourceBindings(dispatch: RuntimeDispatch): readonly RuntimeResourceBinding[];
export declare function formatResourceBindingContext(dispatch: RuntimeDispatch): readonly string[];
//# sourceMappingURL=resource-registry.d.ts.map