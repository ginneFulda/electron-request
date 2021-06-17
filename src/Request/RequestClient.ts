import zlib from 'zlib';
import { URL } from 'url';
import { PassThrough } from 'stream';
import { isRedirect } from '../utils';
import ResponseImpl from '../Response';
import Headers from '../Headers';
import { HEADER_MAP, METHOD_MAP } from '../enum';
import type { RequestOptions, Response } from '../typings.d';
import type { ClientRequest } from 'http';
import type { ElectronClientRequest } from './ElectronAdapter';

export type PromiseReject = (reason?: Error) => void;

abstract class RequestClient {
  timeoutId: NodeJS.Timeout | null = null;

  abstract clientRequest: ClientRequest | ElectronClientRequest | null;
  abstract options: RequestOptions;
  abstract requiredDecode: boolean;
  abstract bindPrivateEvent(reject: PromiseReject): void;
  abstract createClientRequest(): Promise<void>;
  abstract cancelClientRequest(): void;

  private clearRequestTimeout = () => {
    if (this.timeoutId === null) return;
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  };

  public send = (): Promise<Response> => {
    return new Promise((resolve, reject) => {
      if (this.clientRequest) {
        const {
          method,
          body: requestBody,
          followRedirect,
          redirectCount,
          maxRedirectCount,
          requestURL,
          parsedURL,
          size,
          timeout,
        } = this.options;

        this.bindPrivateEvent(reject);

        this.clientRequest.on('error', (error) => {
          this.clearRequestTimeout();
          reject(error);
        });

        this.clientRequest.on('abort', () => {
          this.clearRequestTimeout();
          reject(new Error('request was aborted by the server'));
        });

        this.clientRequest.on('response', (res) => {
          this.clearRequestTimeout();
          const headers = new Headers(res.headers);
          const { statusCode = 200 } = res;

          if (isRedirect(statusCode) && followRedirect) {
            if (maxRedirectCount && redirectCount >= maxRedirectCount) {
              reject(new Error(`maximum redirect reached at: ${requestURL}`));
            }

            if (!headers.get(HEADER_MAP.LOCATION)) {
              reject(new Error(`redirect location header missing at: ${requestURL}`));
            }

            if (
              statusCode === 303 ||
              ((statusCode === 301 || statusCode === 302) && method === METHOD_MAP.POST)
            ) {
              this.options.method = METHOD_MAP.GET;
              this.options.body = null;
              this.options.headers.delete(HEADER_MAP.CONTENT_LENGTH);
            }

            this.options.redirectCount += 1;
            this.options.parsedURL = new URL(
              String(headers.get(HEADER_MAP.LOCATION)),
              parsedURL.toString(),
            );
            resolve(this.createClientRequest().then(this.send));
          }

          let responseBody = new PassThrough();
          res.on('error', (error) => responseBody.emit('error', error));
          responseBody.on('error', this.cancelClientRequest);
          responseBody.on('cancel-request', this.cancelClientRequest);
          res.pipe(responseBody);

          const responseOptions = {
            requestURL,
            statusCode,
            headers,
            size,
            timeout,
          };

          const resolveResponse = (body: PassThrough) => {
            const response = new ResponseImpl(body, responseOptions);
            resolve(response);
          };

          if (this.requiredDecode) {
            const codings = headers.get(HEADER_MAP.CONTENT_ENCODING);
            if (
              method !== METHOD_MAP.HEAD &&
              codings !== null &&
              statusCode !== 204 &&
              statusCode !== 304
            ) {
              if (codings === 'gzip' || codings === 'x-gzip') {
                responseBody = responseBody.pipe(zlib.createGunzip());
              } else if (codings === 'deflate' || codings === 'x-deflate') {
                const raw = res.pipe(new PassThrough());
                raw.once('data', (chunk) => {
                  // see http://stackoverflow.com/questions/37519828
                  // eslint-disable-next-line no-bitwise
                  if ((chunk[0] & 0x0f) === 0x08) {
                    responseBody = responseBody.pipe(zlib.createInflate());
                  } else {
                    responseBody = responseBody.pipe(zlib.createInflateRaw());
                  }
                  resolveResponse(responseBody);
                });
                return;
              }
            }
          }
          resolveResponse(responseBody);
        });

        if (requestBody) {
          this.clientRequest.write(requestBody);
        }

        this.clientRequest.end();
      } else {
        reject(new Error('Please create client request first'));
      }
    });
  };
}

export default RequestClient;
