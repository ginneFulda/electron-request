import type { DefaultOptions } from './typings.d';

export const DEFAULT_OPTIONS: DefaultOptions = {
  method: 'GET',
  body: null,
  followRedirect: true,
  maxRedirectCount: 20,
  timeout: 0,
  size: 0,
  // redirect count
  redirectCount: 0,
};

export const SUPPORTED_COMPRESSIONS = ['gzip', 'deflate'];
