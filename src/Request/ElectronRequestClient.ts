import { URL } from 'url';
import Stream, { PassThrough } from 'stream';
import ElectronAdapter from './ElectronAdapter';
import { REQUEST_EVENT } from '@/enum';
import { isRedirect, inElectron } from '@/utils';
import ResponseImpl from '@/Response';
import Headers from '@/Headers';
import { HEADER_MAP, METHOD_MAP, RESPONSE_EVENT } from '@/enum';
import type { RequestOptions, RequestClient, Response } from '@/typings.d';

const electronAdapter = inElectron ? new ElectronAdapter() : null;

class ElectronRequestClient implements RequestClient {
  private options: RequestOptions;
  private redirectCount: number = 0;
  private timeoutId: NodeJS.Timeout | null = null;

  constructor(options: RequestOptions) {
    this.options = options;
  }

  private clearRequestTimeout = () => {
    if (this.timeoutId === null) return;
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  };

  private createRequest = async () => {
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

    return clientRequest;
  };

  public send = async () => {
    const {
      method,
      followRedirect,
      maxRedirectCount,
      requestURL,
      parsedURL,
      size,
      username,
      password,
      timeout,
      body: requestBody,
    } = this.options;

    /** Create electron request */
    const clientRequest = await this.createRequest();
    /** Cancel electron request */
    const cancelRequest = () => {
      // In electron, `request.destroy()` does not send abort to server
      clientRequest.abort();
    };
    /** Write body to electron request */
    const writeToRequest = () => {
      if (requestBody === null) {
        clientRequest.end();
      } else if (requestBody instanceof Stream) {
        requestBody.pipe(new PassThrough()).pipe(clientRequest);
      } else {
        clientRequest.write(requestBody);
        clientRequest.end();
      }
    };
    /** Bind electron request event */
    const bindRequestEvent = (
      onFulfilled: (value: Response | PromiseLike<Response>) => void,
      onRejected: (reason: Error) => void,
    ) => {
      /** Set electron request timeout */
      if (timeout) {
        this.timeoutId = setTimeout(() => {
          cancelRequest();
          onRejected(new Error(`Electron request timeout in ${timeout}s`));
        }, timeout);
      }

      /** Bind electron request error event */
      clientRequest.on(REQUEST_EVENT.ERROR, onRejected);

      /** Bind electron request abort event */
      clientRequest.on(REQUEST_EVENT.ABORT, () => {
        onRejected(new Error('Electron request was aborted by the server'));
      });

      /** Bind electron request login event */
      clientRequest.on(REQUEST_EVENT.LOGIN, (authInfo, callback) => {
        if (username && password) {
          callback(username, password);
        } else {
          cancelRequest();
          onRejected(
            new Error(`Login event received from ${authInfo.host} but no credentials provided`),
          );
        }
      });

      /** Bind electron request response event */
      clientRequest.on(REQUEST_EVENT.RESPONSE, (res) => {
        this.clearRequestTimeout();

        const { statusCode = 200, headers: responseHeaders } = res;
        const headers = new Headers(responseHeaders);

        if (isRedirect(statusCode) && followRedirect) {
          if (maxRedirectCount && this.redirectCount >= maxRedirectCount) {
            onRejected(new Error(`Maximum redirect reached at: ${requestURL}`));
          }

          if (!headers.get(HEADER_MAP.LOCATION)) {
            onRejected(new Error(`Redirect location header missing at: ${requestURL}`));
          }

          if (
            statusCode === 303 ||
            ((statusCode === 301 || statusCode === 302) && method === METHOD_MAP.POST)
          ) {
            this.options.method = METHOD_MAP.GET;
            this.options.body = null;
            this.options.headers.delete(HEADER_MAP.CONTENT_LENGTH);
          }

          this.redirectCount += 1;
          this.options.parsedURL = new URL(
            String(headers.get(HEADER_MAP.LOCATION)),
            parsedURL.toString(),
          );
          onFulfilled(this.send());
        }

        const responseBody = new PassThrough();
        res.on(RESPONSE_EVENT.ERROR, (error) => responseBody.emit(RESPONSE_EVENT.ERROR, error));
        responseBody.on(RESPONSE_EVENT.ERROR, cancelRequest);
        responseBody.on(RESPONSE_EVENT.CANCEL_REQUEST, cancelRequest);
        res.pipe(responseBody);

        onFulfilled(
          new ResponseImpl(responseBody, {
            requestURL,
            statusCode,
            headers,
            size,
          }),
        );
      });
    };

    return new Promise<Response>((resolve, reject) => {
      const onRejected = (reason: Error) => {
        this.clearRequestTimeout();
        reject(reason);
      };
      bindRequestEvent(resolve, onRejected);
      writeToRequest();
    });
  };
}

export default ElectronRequestClient;
