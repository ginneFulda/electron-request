import Stream from 'stream';
import Blob from './Blob';
import ProgressCallbackTransform from './ProgressCallbackTransform';
import { HEADER_MAP } from '../enum';
import type Headers from '../Headers';
import type { Writable } from 'stream';
import type { WriteStream } from 'fs';
import type { Response, ProgressCallback } from '../typings.d';

interface ResponseOptions {
  requestURL: string;
  statusCode: number;
  headers: Headers;
  size: number;
  timeout: number;
}

export default class implements Response {
  private consumed: boolean;
  private statusCode: number;
  private body: Stream;
  private requestURL: string;
  private headers: Headers;
  private timeout: number;
  private size: number;

  constructor(body: Stream, options: ResponseOptions) {
    const { statusCode = 200, requestURL, headers, timeout, size } = options;
    this.statusCode = statusCode;
    this.body = body;
    this.requestURL = requestURL;
    this.headers = headers;
    this.timeout = timeout;
    this.size = size;
    this.consumed = false;
  }

  private consumeResponse = (): Promise<Buffer> => {
    if (this.consumed) {
      return Promise.reject(new Error(`Response used already for: ${this.requestURL}`));
    }

    this.consumed = true;

    // body is null
    if (this.body === null) {
      return Promise.resolve(Buffer.alloc(0));
    }

    // body is string
    if (typeof this.body === 'string') {
      return Promise.resolve(Buffer.from(this.body));
    }

    // body is blob
    if (this.body instanceof Blob) {
      return Promise.resolve(this.body.content);
    }

    // body is buffer
    if (Buffer.isBuffer(this.body)) {
      return Promise.resolve(this.body);
    }

    if (!(this.body instanceof Stream)) {
      return Promise.resolve(Buffer.alloc(0));
    }

    // body is stream
    // get ready to actually consume the body
    const accum: Buffer[] = [];
    let accumBytes = 0;
    let abort = false;

    return new Promise((resolve, reject) => {
      let resTimeout: NodeJS.Timeout;
      // allow timeout on slow response body
      if (this.timeout) {
        resTimeout = setTimeout(() => {
          abort = true;
          reject(
            new Error(
              `Response timeout while trying to fetch ${this.requestURL} (over ${this.timeout}ms)`,
            ),
          );
          this.body.emit('cancel-request');
        }, this.timeout);
      }

      // handle stream error, such as incorrect content-encoding
      this.body.on('error', (err) => {
        reject(
          new Error(
            `Invalid response body while trying to fetch ${this.requestURL}: ${err.message}`,
          ),
        );
      });

      this.body.on('data', (chunk: Buffer) => {
        if (abort || chunk === null) {
          return;
        }

        if (this.size && accumBytes + chunk.length > this.size) {
          abort = true;
          reject(new Error(`content size at ${this.requestURL} over limit: ${this.size}`));
          this.body.emit('cancel-request');
          return;
        }

        accumBytes += chunk.length;
        accum.push(chunk);
      });

      this.body.on('end', () => {
        if (abort) {
          return;
        }

        clearTimeout(resTimeout);
        resolve(Buffer.concat(accum));
      });
    });
  };

  /**
   * Convenience property representing if the request ended normally
   */
  get ok(): boolean {
    return this.statusCode >= 200 && this.statusCode < 300;
  }

  /**
   * Download file to destination
   * @param {WriteStream} dest  Download write stream
   * @param {ProgressCallback=} onProgress Download progress callback
   */
  public download = (dest: WriteStream, onProgress?: ProgressCallback): Promise<void> => {
    return new Promise((resolve, reject) => {
      const feedStreams: Writable[] = [dest];
      if (typeof onProgress === 'function') {
        const contentLength = Number(this.headers.get(HEADER_MAP.CONTENT_LENGTH));
        const progressStream = new ProgressCallbackTransform(contentLength, onProgress);
        feedStreams.unshift(progressStream);
      }
      dest.once('finish', () => {
        dest.close();
        resolve();
      });
      dest.on('error', (error) => {
        reject(error);
      });
      let lastStream = this.stream;
      for (const stream of feedStreams) {
        lastStream = lastStream.pipe(stream);
      }
    });
  };

  /**
   * Return origin stream
   */
  get stream(): Stream {
    if (this.consumed) {
      throw new Error(`Response used already for: ${this.requestURL}`);
    }
    this.consumed = true;
    return this.body;
  }

  /**
   * Decode response as ArrayBuffer
   */
  arrayBuffer = async (): Promise<ArrayBuffer> => {
    const buf = await this.consumeResponse();
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  };

  /**
   * Decode response as Blob
   */
  blob = async (): Promise<Blob> => {
    const contentType = (this.headers && this.headers.get(HEADER_MAP.CONTENT_TYPE)) || '';
    const buffer = await this.consumeResponse();
    const blob = new Blob([buffer], {
      type: contentType.toLowerCase(),
    });
    return blob;
  };

  /**
   * Decode response as text
   */
  text = async (): Promise<string> => {
    const buffer = await this.consumeResponse();
    return buffer.toString();
  };

  /**
   * Decode response as json
   */
  json = async <T>(): Promise<T> => {
    const buffer = await this.consumeResponse();
    let result: T;
    try {
      result = JSON.parse(buffer.toString());
    } catch {
      result = buffer.toString() as unknown as T;
    }
    return result;
  };

  /**
   * Decode response as buffer
   */
  buffer = (): Promise<Buffer> => {
    return this.consumeResponse();
  };
}
