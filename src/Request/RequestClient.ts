import zlib from 'zlib';
import { URL } from 'url';
import { PassThrough } from 'stream';
import { isRedirect } from '@/utils';
import ResponseImpl from '@/Response';
import Headers from '@/Headers';
import { HEADER_MAP, METHOD_MAP, COMPRESSION_TYPE, RESPONSE_EVENT } from '@/enum';
import type { IncomingMessage } from 'http';
import type { RequestOptions, Response } from '@/typings.d';

export type BindRequestEvent = (
  onFulfilled: (value: Response | PromiseLike<Response>) => void,
  onRejected: (reason: Error) => void,
) => void;

type CreateHandleResponse = (
  ...args: Parameters<BindRequestEvent>
) => (options: { decodeRequired: boolean }) => (response: IncomingMessage) => void;

abstract class RequestClient {
  protected abstract createRequest(): Promise<void>;
  protected abstract bindRequestEvent: BindRequestEvent;
  protected abstract writeToRequest(): void;
  protected abstract cancelRequest(): void;
  protected abstract options: RequestOptions;
  private timeoutId: NodeJS.Timeout | null = null;

  private clearRequestTimeout = () => {
    if (this.timeoutId === null) return;
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  };

  protected createHandleResponse: CreateHandleResponse = (onFulfilled, onRejected) => (options) => {
    const { decodeRequired } = options;
    return (res) => {
      const {
        method,
        followRedirect,
        redirectCount,
        maxRedirectCount,
        requestURL,
        parsedURL,
        size,
      } = this.options;

      this.clearRequestTimeout();
      const headers = new Headers(res.headers);
      const { statusCode = 200 } = res;

      if (isRedirect(statusCode) && followRedirect) {
        if (maxRedirectCount && redirectCount >= maxRedirectCount) {
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

        this.options.redirectCount += 1;
        this.options.parsedURL = new URL(
          String(headers.get(HEADER_MAP.LOCATION)),
          parsedURL.toString(),
        );
        onFulfilled(this.send());
      }

      let responseBody = new PassThrough();
      res.on(RESPONSE_EVENT.ERROR, (error) => responseBody.emit(RESPONSE_EVENT.ERROR, error));
      responseBody.on(RESPONSE_EVENT.ERROR, this.cancelRequest);
      responseBody.on(RESPONSE_EVENT.CANCEL_REQUEST, this.cancelRequest);
      res.pipe(responseBody);

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

      if (decodeRequired) {
        const codings = headers.get(HEADER_MAP.CONTENT_ENCODING);
        if (
          method !== METHOD_MAP.HEAD &&
          codings !== null &&
          statusCode !== 204 &&
          statusCode !== 304
        ) {
          switch (codings) {
            case COMPRESSION_TYPE.BR:
              responseBody = responseBody.pipe(zlib.createBrotliDecompress());
              break;

            case COMPRESSION_TYPE.GZIP:
            case `x-${COMPRESSION_TYPE.GZIP}`:
              responseBody = responseBody.pipe(zlib.createGunzip());
              break;

            case COMPRESSION_TYPE.DEFLATE:
            case `x-${COMPRESSION_TYPE.DEFLATE}`:
              res.pipe(new PassThrough()).once('data', (chunk) => {
                // see http://stackoverflow.com/questions/37519828
                // eslint-disable-next-line no-bitwise
                if ((chunk[0] & 0x0f) === 0x08) {
                  responseBody = responseBody.pipe(zlib.createInflate());
                } else {
                  responseBody = responseBody.pipe(zlib.createInflateRaw());
                }
                resolveResponse();
              });
              return;

            default:
              break;
          }
        }
      }
      resolveResponse();
    };
  };

  public send = async () => {
    await this.createRequest();
    return new Promise<Response>((resolve, reject) => {
      const { timeout } = this.options;

      if (timeout) {
        this.timeoutId = setTimeout(() => {
          this.cancelRequest();
          reject(new Error(`Network timeout in ${timeout}s`));
        }, timeout);
      }

      const onRejected = (reason: Error) => {
        this.clearRequestTimeout();
        reject(reason);
      };

      this.bindRequestEvent(resolve, onRejected);
      this.writeToRequest();
    });
  };
}

export default RequestClient;
