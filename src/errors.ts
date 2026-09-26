import type { LayaError } from './LayaError';

export type LayaErrorCode = LayaError['code'];

/**
 * Shape-based, not `instanceof`-based: `code` (plus the LayaError name) survives
 * serialization, bundling, and cross-boundary transport; class identity does not.
 */
export const isLayaError = (e: unknown): e is LayaError =>
    e instanceof Error && e.name === 'LayaError' && typeof (e as LayaError).code === 'string';

const withCode =
    <C extends LayaErrorCode>(code: C) =>
    (e: unknown): e is LayaError & { code: C } =>
        isLayaError(e) && e.code === code;

// one guard per code — narrowing on `code`, not instanceof
export const isLayaConnectionError = withCode('connection');
export const isLayaAuthError = withCode('auth');
export const isLayaValidationError = withCode('validation');
export const isLayaTimeoutError = withCode('timeout');
