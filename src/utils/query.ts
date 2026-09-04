import { Request } from 'express';
import { ParamsDictionary } from 'express-serve-static-core';

/**
 * Typed request with route params — ensures req.params.id is always string.
 */
export type TypedRequest<
  P extends ParamsDictionary = ParamsDictionary,
  B = any,
  Q extends Record<string, string | undefined> = Record<string, string | undefined>
> = Request<P, any, B, any>;

/**
 * Extract a single string from req.query (handles string | string[] | ParsedQs).
 */
export const qs = (value: unknown): string | undefined => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
};

/**
 * Safely get req.params value as string.
 */
export const param = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
};
