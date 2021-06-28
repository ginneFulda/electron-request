import Stream, { PassThrough } from 'stream';
import ElectronAdapter from './ElectronAdapter';
import RequestClient from './RequestClient';
import { inElectron } from '@/utils';
import { REQUEST_EVENT } from '@/enum';
import type { BindRequestEvent } from './RequestClient';
import type { ElectronClientRequest } from './ElectronAdapter';
import type { RequestOptions } from '@/typings.d';

const electronAdapter = inElectron ? new ElectronAdapter() : null;

class ElectronRequestClient extends RequestClient {
  private readonly decodeRequired: boolean = false;
  private clientRequest!: ElectronClientRequest;
  options: RequestOptions;

  constructor(options: RequestOptions) {
    super();
    this.options = options;
  }

  createRequest = async () => {
    if (electronAdapter === null) {
      throw new Error('Error in environmental judgment');
    }
    await electronAdapter.whenReady();
    const {
      requestURL,
      parsedURL: { protocol, host, hostname, port, pathname, origin, search },
      method,
      session,
      useSessionCookies,
      headers,
    } = this.options;

    const options = {
      method,
      url: requestURL,
      session: session || electronAdapter.getDefaultSession(),
      useSessionCookies,
      protocol,
      host,
      hostname,
      origin,
      port: Number(port),
      path: `${pathname}${search || ''}`,
    };
    // console.log('options: ', options);
    const clientRequest = electronAdapter.request(options);

    for (const [key, headerValues] of Object.entries(headers.raw())) {
      for (const headerValue of headerValues) {
        clientRequest.setHeader(key, headerValue);
      }
    }

    this.clientRequest = clientRequest;
  };

  cancelRequest = () => {
    // In electron, `request.destroy()` does not send abort to server
    this.clientRequest.abort();
  };

  bindRequestEvent: BindRequestEvent = (onFulfilled, onRejected) => {
    const { username, password } = this.options;

    this.clientRequest.on(REQUEST_EVENT.ERROR, onRejected);
    this.clientRequest.on(REQUEST_EVENT.ABORT, () => {
      onRejected(new Error('Electron request was aborted by the server'));
    });
    this.clientRequest.on(
      REQUEST_EVENT.RESPONSE,
      this.createHandleResponse(
        onFulfilled,
        onRejected,
      )({
        decodeRequired: this.decodeRequired,
      }),
    );
    this.clientRequest.on(REQUEST_EVENT.LOGIN, (authInfo, callback) => {
      if (username && password) {
        callback(username, password);
      } else {
        this.cancelRequest();
        onRejected(
          new Error(`Login event received from ${authInfo.host} but no credentials provided`),
        );
      }
    });
  };

  writeToRequest = () => {
    const { body: requestBody } = this.options;
    if (requestBody === null) {
      this.clientRequest.end();
    } else if (requestBody instanceof Stream) {
      requestBody.pipe(new PassThrough()).pipe(this.clientRequest);
    } else {
      this.clientRequest.write(requestBody);
      this.clientRequest.end();
    }
  };
}

export default ElectronRequestClient;
