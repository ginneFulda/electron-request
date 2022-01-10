import http from 'http';
import zlib from 'zlib';
import https from 'https';
import { URL } from 'url';
import { Stream, PassThrough, pipeline as pump } from 'stream';
import ResponseImpl from '@/Response';
import Headers from '@/Headers';
import { REQUEST_EVENT } from '@/enum';
import { isRedirect } from '@/utils';
import { HEADER_MAP, METHOD_MAP, COMPRESSION_TYPE, RESPONSE_EVENT } from '@/enum';
import type { RequestClient, RequestOptions, Response } from '@/typings.d';

const adapterForHttp = (protocol: string) => {
  if (protocol === 'http:') {
    return http;
  }
  if (protocol === 'https:') {
    return https;
  }
  throw new TypeError('Only HTTP(S) protocols are supported');
};

class NativeRequestClient implements RequestClient {
  private options: RequestOptions;
  private redirectCount: number = 0;

  constructor(options: RequestOptions) {
    this.options = options;
  }

  private createRequest = () => {
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
    return adapterForHttp(protocol).request(options);
  };

  public send = () => {
    const {
      method,
      followRedirect,
      maxRedirectCount,
      requestURL,
      parsedURL,
      size,
      timeout,
      body: requestBody,
    } = this.options;

    /** Create NodeJS request */
    const clientRequest = this.createRequest();
    /** Cancel NodeJS request */
    const cancelRequest = () => {
      // In NodeJS, `request.abort()` is deprecated since v14.1.0. Use `request.destroy()` instead.
      clientRequest.destroy();
    };
    /** Write body to NodeJS request */
    const writeToRequest = () => {
      if (requestBody === null) {
        clientRequest.end();
      } else if (requestBody instanceof Stream) {
        requestBody.pipe(clientRequest);
      } else {
        clientRequest.write(requestBody);
        clientRequest.end();
      }
    };
    /** Bind request event */
    const bindRequestEvent = (
      onFulfilled: (value: Response | PromiseLike<Response>) => void,
      onRejected: (reason: Error) => void,
    ) => {
      /** Set NodeJS request timeout */
      if (timeout) {
        clientRequest.setTimeout(timeout, () => {
          onRejected(new Error(`NodeJS request timeout in ${timeout} ms`));
        });
      }

      /** Bind NodeJS request error event */
      clientRequest.on(REQUEST_EVENT.ERROR, onRejected);

      /** Bind NodeJS request abort event */
      clientRequest.on(REQUEST_EVENT.ABORT, () => {
        onRejected(new Error('NodeJS request was aborted by the server'));
      });

      /** Bind NodeJS request response event */
      clientRequest.on(REQUEST_EVENT.RESPONSE, (res) => {
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

        const pumpCallback = (error: NodeJS.ErrnoException | null) => {
          if (error !== null) {
            onRejected(error);
          }
        };

        let responseBody = pump(res, new PassThrough(), pumpCallback);
        responseBody.on(RESPONSE_EVENT.CANCEL_REQUEST, cancelRequest);

        const resolveResponse = () => {
          onFulfilled(
            new ResponseImpl(responseBody, {
              requestURL,
              statusCode,
              headers,
              size,
            }),
          );
        };
        const codings = headers.get(HEADER_MAP.CONTENT_ENCODING);
        if (
          method !== METHOD_MAP.HEAD &&
          codings !== null &&
          statusCode !== 204 &&
          statusCode !== 304
        ) {
          switch (codings) {
            case COMPRESSION_TYPE.BR:
              responseBody = pump(responseBody, zlib.createBrotliDecompress(), pumpCallback);
              break;

            case COMPRESSION_TYPE.GZIP:
            case `x-${COMPRESSION_TYPE.GZIP}`:
              responseBody = pump(responseBody, zlib.createGunzip(), pumpCallback);
              break;

            case COMPRESSION_TYPE.DEFLATE:
            case `x-${COMPRESSION_TYPE.DEFLATE}`:
              pump(res, new PassThrough(), pumpCallback).once('data', (chunk) => {
                // see http://stackoverflow.com/questions/37519828
                // eslint-disable-next-line no-bitwise
                if ((chunk[0] & 0x0f) === 0x08) {
                  responseBody = pump(responseBody, zlib.createInflate(), pumpCallback);
                } else {
                  responseBody = pump(responseBody, zlib.createInflateRaw(), pumpCallback);
                }
                resolveResponse();
              });
              return;
            default:
              break;
          }
        }
        resolveResponse();
      });
    };

    return new Promise<Response>((resolve, reject) => {
      const onRejected = (reason: Error) => {
        cancelRequest();
        reject(reason);
      };
      bindRequestEvent(resolve, onRejected);
      writeToRequest();
    });
  };
}

export default NativeRequestClient;
