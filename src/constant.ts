import type { DefaultOptions } from './typings.d';
import { COMPRESSION_TYPE } from './enum';

export const DEFAULT_OPTIONS: DefaultOptions = {
  method: 'GET',
  body: null,
  followRedirect: true,
  maxRedirectCount: 20,
  timeout: 0,
  size: 0,
  useSessionCookies: true,
  useNative: false,
};

export const SUPPORTED_COMPRESSIONS = [
  COMPRESSION_TYPE.GZIP,
  COMPRESSION_TYPE.DEFLATE,
  COMPRESSION_TYPE.BR,
];
