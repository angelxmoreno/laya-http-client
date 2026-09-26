/**
 * The only error this client throws. Narrow by `code`, never by `instanceof` —
 * the code survives serialization, bundling, and cross-boundary transport;
 * class identity does not.
 */
export class LayaError extends Error {
    readonly code: 'connection' | 'auth' | 'validation' | 'timeout';

    constructor(code: LayaError['code'], message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = 'LayaError';
        this.code = code;
    }
}
