import http from 'http';
import https from 'https';
import Stream from 'stream';
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
  private readonly decodeRequired: boolean = true;
  private clientRequest!: http.ClientRequest;
  options: RequestOptions;

  constructor(options: RequestOptions) {
    super();
    this.options = options;
  }

  createRequest = async () => {
    const {
      parsedURL: { protocol, host, hostname, port, pathname, search },
      headers,
      method,
    } = this.options;

    const options = {
      protocol,
      host,
      hostname,
      port,
      path: `${pathname}${search || ''}`,
      headers: headers.raw(),
      method,
    };
    // console.log('options: ', options);
    this.clientRequest = adapterForHttp(protocol).request(options);
  };

  cancelRequest = () => {
    // In node.js, `request.abort()` is deprecated since v14.1.0
    // Use `request.destroy()` instead.
    this.clientRequest.destroy();
  };

  bindRequestEvent = () => {
    this.clientRequest.on('error', this.handleRequestError);
    this.clientRequest.on('abort', this.handleRequestAbort);
    this.clientRequest.on(
      'response',
      this.createHandleResponse({
        decodeRequired: this.decodeRequired,
      }),
    );
  };

  writeToRequest = () => {
    const { body: requestBody } = this.options;

    if (requestBody === null) {
      this.clientRequest.end();
    } else if (requestBody instanceof Stream) {
      requestBody.pipe(this.clientRequest);
    } else {
      this.clientRequest.write(requestBody);
      this.clientRequest.end();
    }
  };
}

export default NativeRequestClient;
