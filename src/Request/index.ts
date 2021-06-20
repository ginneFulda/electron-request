import { URL } from 'url';
import { extractContentType, inElectron } from '../utils';
import Headers from '../Headers';
import ElectronRequest from './ElectronRequestClient';
import NativeRequest from './NativeRequestClient';
import { DEFAULT_OPTIONS, SUPPORTED_COMPRESSIONS } from '../constant';
import { HEADER_MAP, METHOD_MAP } from '../enum';
import type RequestClient from './RequestClient';
import type { RequestConstructorOptions, RequestOptions } from '../typings.d';

const getRequestOptions = (constructorOptions: RequestConstructorOptions): RequestOptions => {
  const options = { ...DEFAULT_OPTIONS, ...constructorOptions };

  const { method, body, requestURL, query, headers: headerOptions } = options;

  if (body !== null && (method === METHOD_MAP.GET || method === METHOD_MAP.HEAD)) {
    throw new TypeError('Request with GET/HEAD method cannot have body');
  }

  const parsedURL = new URL(requestURL);
  if (!parsedURL.protocol || !parsedURL.hostname) {
    throw new TypeError('Only absolute URLs are supported');
  }
  if (!/^https?:$/.test(parsedURL.protocol)) {
    throw new TypeError('Only HTTP(S) protocols are supported');
  }
  if (query) {
    for (const [queryKey, queryValue] of Object.entries(query)) {
      parsedURL.searchParams.append(queryKey, queryValue);
    }
  }

  const headers = new Headers(headerOptions);
  // User cannot set content-length themself as per fetch spec
  headers.delete(HEADER_MAP.CONTENT_LENGTH);
  // Add compression header
  headers.set(HEADER_MAP.ACCEPT_ENCODING, SUPPORTED_COMPRESSIONS.join(', '));
  // Add accept header
  if (!headers.has(HEADER_MAP.ACCEPT)) {
    headers.set(HEADER_MAP.ACCEPT, '*/*');
  }
  // Add connection header
  if (!headers.has(HEADER_MAP.CONNECTION)) {
    headers.set(HEADER_MAP.CONNECTION, 'close');
  }
  // Add content type header
  if (body && !headers.has(HEADER_MAP.CONTENT_TYPE)) {
    const contentType = extractContentType(body);
    if (contentType) {
      headers.append(HEADER_MAP.CONTENT_TYPE, contentType);
    }
  }

  return {
    ...options,
    parsedURL,
    headers,
  };
};

class Request {
  private client: RequestClient;

  constructor(constructorOptions: RequestConstructorOptions) {
    const options = getRequestOptions(constructorOptions);
    this.client = inElectron ? new ElectronRequest(options) : new NativeRequest(options);
  }

  public send = () => {
    return this.client.send();
  };
}

export default Request;
