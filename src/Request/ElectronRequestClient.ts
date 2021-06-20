import ElectronAdapter from './ElectronAdapter';
import RequestClient from './RequestClient';
import type { PromiseReject } from './RequestClient';
import type { ElectronClientRequest } from './ElectronAdapter';
import type { RequestOptions } from '../typings.d';

class ElectronRequestClient extends RequestClient {
  private readonly electronAdapter = new ElectronAdapter();
  public clientRequest: ElectronClientRequest | null = null;
  public options: RequestOptions;
  public requiredDecode: boolean = false;

  constructor(options: RequestOptions) {
    super();
    this.options = options;
  }

  public createClientRequest = async () => {
    await this.electronAdapter.whenReady();
    const {
      requestURL,
      parsedURL: { protocol, host, hostname, port, pathname, origin, search },
      method,
      session,
      useSessionCookies,
      headers,
    } = this.options;

    const clientRequest = this.electronAdapter.request({
      method,
      url: requestURL,
      session: session || this.electronAdapter.getDefaultSession(),
      useSessionCookies,
      protocol,
      host,
      hostname,
      origin,
      port: Number(port),
      path: `${pathname}${search || ''}`,
    });

    for (const [key, headerValues] of Object.entries(headers.raw())) {
      for (const headerValue of headerValues) {
        clientRequest.setHeader(key, headerValue);
      }
    }

    this.clientRequest = clientRequest;
  };

  public cancelClientRequest = () => {
    if (!this.clientRequest) return;
    // In electron, `request.destroy()` does not send abort to server
    this.clientRequest.abort();
  };

  public bindPrivateEvent = (reject: PromiseReject) => {
    if (!this.clientRequest) return;
    const { username, password } = this.options;
    this.clientRequest.on('login', (authInfo, callback) => {
      if (username && password) {
        callback(username, password);
      } else {
        this.cancelClientRequest();
        reject(new Error(`login event received from ${authInfo.host} but no credentials provided`));
      }
    });
  };
}

export default ElectronRequestClient;
