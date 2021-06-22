import zlib from 'zlib';
import { URL } from 'url';
import { PassThrough } from 'stream';
import { isRedirect } from '../utils';
import ResponseImpl from '../Response';
import Headers from '../Headers';
import { HEADER_MAP, METHOD_MAP, COMPRESSION_TYPE } from '../enum';
import type { IncomingMessage } from 'http';
import type { RequestOptions, Response } from '../typings.d';

interface CreateHandleResponseOptions {
  decodeRequired: boolean;
}
type CreateHandleResponse = (
  options: CreateHandleResponseOptions,
) => (response: IncomingMessage) => void;

abstract class RequestClient {
  protected abstract createRequest(): Promise<void>;
  protected abstract bindRequestEvent(): void;
  protected abstract writeToRequest(): void;
  protected abstract cancelRequest(): void;
  protected abstract options: RequestOptions;

  protected resolve!: (value: Response | PromiseLike<Response>) => void;
  protected reject!: (reason?: unknown) => void;
  private timeoutId: NodeJS.Timeout | null = null;

  private clearRequestTimeout = () => {
    if (this.timeoutId === null) return;
    clearTimeout(this.timeoutId);
    this.timeoutId = null;
  };

  protected handleRequestError = (error: Error) => {
    this.clearRequestTimeout();
    this.reject(error);
  };

  protected handleRequestAbort = () => {
    this.clearRequestTimeout();
    this.reject(new Error('Request was aborted by the server'));
  };

  protected createHandleResponse: CreateHandleResponse = (options) => {
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
        timeout,
      } = this.options;

      this.clearRequestTimeout();
      const headers = new Headers(res.headers);
      const { statusCode = 200 } = res;

      if (isRedirect(statusCode) && followRedirect) {
        if (maxRedirectCount && redirectCount >= maxRedirectCount) {
          this.reject(new Error(`Maximum redirect reached at: ${requestURL}`));
        }

        if (!headers.get(HEADER_MAP.LOCATION)) {
          this.reject(new Error(`Redirect location header missing at: ${requestURL}`));
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
        this.resolve(this.send());
      }

      let responseBody = new PassThrough();
      res.on('error', (error) => responseBody.emit('error', error));
      responseBody.on('error', this.cancelRequest);
      responseBody.on('cancel-request', this.cancelRequest);
      res.pipe(responseBody);

      const responseOptions = {
        requestURL,
        statusCode,
        headers,
        size,
        timeout,
      };

      const resolveResponse = () => {
        this.resolve(new ResponseImpl(responseBody, responseOptions));
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
      this.resolve = resolve;
      this.reject = reject;

      if (timeout) {
        this.timeoutId = setTimeout(() => {
          reject(new Error(`Network timeout in ${timeout}s`));
          this.cancelRequest();
        }, timeout);
      }

      this.bindRequestEvent();
      this.writeToRequest();
    });
  };
}

export default RequestClient;
