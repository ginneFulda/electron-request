import http from 'http';
import https from 'https';
import RequestClient from './RequestClient';
import type { RequestOptions } from '../typings.d';

const adapterForHttp = (protocol: string) => {
  if (protocol === 'http:') {
    return http;
  }
  if (protocol === 'https:') {
    return https;
  }
  throw new TypeError('Only HTTP(S) protocols are supported');
};

class NativeRequestClient extends RequestClient {
  public clientRequest: http.ClientRequest | null = null;
  public options: RequestOptions;
  public requiredDecode: boolean = true;

  constructor(options: RequestOptions) {
    super();
    this.options = options;
  }

  public createClientRequest = async () => {
    const {
      parsedURL: { protocol, host, hostname, port, pathname, search },
      headers,
      method,
    } = this.options;
    const clientRequest = adapterForHttp(protocol).request({
      protocol,
      host,
      hostname,
      port,
      path: `${pathname}${search || ''}`,
      headers: headers.raw(),
      method,
    });
    this.clientRequest = clientRequest;
  };

  public cancelClientRequest = () => {
    if (!this.clientRequest) return;
    // In node.js, `request.abort()` is deprecated since v14.1.0
    // Use `request.destroy()` instead.
    this.clientRequest.destroy();
  };

  public bindPrivateEvent = () => {};
}

export default NativeRequestClient;
