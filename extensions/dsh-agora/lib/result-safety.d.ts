/** Redact secret material before a runtime result enters durable state or IM. */
export declare function redactSensitiveText(value: string): string;
/** Recursively redact strings in result envelopes and adapter metadata. */
export declare function redactSensitiveValue<T>(value: T): T;
//# sourceMappingURL=result-safety.d.ts.map