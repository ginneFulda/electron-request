import { Stream } from 'stream';
import { WriteStream } from 'fs';
import Blob from './Blob';
import DigestTransform from './DigestTransform';
import ProgressCallbackTransform from './ProgressCallbackTransform';
import { HEADER_MAP, RESPONSE_EVENT } from '@/enum';
import type { Writable } from 'stream';
import type Headers from '@/Headers';
import type { Response, ProgressCallback, ValidateOptions } from '@/typings.d';

interface ResponseOptions {
  requestURL: string;
  statusCode: number;
  headers: Headers;
  size: number;
}

export default class implements Response {
  private disturbed: boolean;
  private body: Stream;
  private config: ResponseOptions;

  constructor(body: Stream, options: ResponseOptions) {
    this.body = body;
    this.config = options;
    this.disturbed = false;
  }

  private consumeResponse = (): Promise<Buffer> => {
    const { requestURL, size } = this.config;

    if (this.disturbed) {
      return Promise.reject(
        new Error(`Response used already for: ${requestURL}`),
      );
    }

    this.disturbed = true;

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
      // handle stream error, such as incorrect content-encoding
      this.body.on(RESPONSE_EVENT.ERROR, (err) => {
        reject(
          new Error(
            `Invalid response body while trying to fetch ${requestURL}: ${err.message}`,
          ),
        );
      });

      this.body.on(RESPONSE_EVENT.DATA, (chunk: Buffer) => {
        if (abort || chunk === null) {
          return;
        }

        if (size && accumBytes + chunk.length > size) {
          abort = true;
          reject(
            new Error(`Content size at ${requestURL} over limit: ${size}`),
          );
          this.body.emit(RESPONSE_EVENT.CANCEL_REQUEST);
          return;
        }

        accumBytes += chunk.length;
        accum.push(chunk);
      });

      this.body.on(RESPONSE_EVENT.END, () => {
        if (abort) {
          return;
        }
        resolve(Buffer.concat(accum, accumBytes));
      });
    });
  };

  /**
   * Whether the response was successful (status in the range 200-299)
   */
  get ok(): boolean {
    const { statusCode } = this.config;
    return statusCode >= 200 && statusCode < 300;
  }

  get headers() {
    return this.config.headers.raw();
  }

  /**
   * Download file to destination
   * @param {WriteStream} fileOut  Download write stream
   * @param {ProgressCallback=} onProgress Download progress callback
   */
  public download = async (
    fileOut: Writable,
    onProgress?: ProgressCallback,
    validateOptions?: ValidateOptions,
  ): Promise<void> => {
    const feedStreams: Writable[] = [];

    if (typeof onProgress === 'function') {
      const contentLength = Number(
        this.config.headers.get(HEADER_MAP.CONTENT_LENGTH),
      );
      feedStreams.push(
        new ProgressCallbackTransform(contentLength, onProgress),
      );
    }

    if (validateOptions) {
      feedStreams.push(new DigestTransform(validateOptions));
    }

    feedStreams.push(fileOut);

    return new Promise((resolve, reject) => {
      let lastStream = this.stream;
      for (const stream of feedStreams) {
        stream.on('error', (error: Error) => {
          reject(error);
        });
        lastStream = lastStream.pipe(stream);
      }

      fileOut.once('finish', () => {
        if (
          fileOut instanceof WriteStream &&
          typeof fileOut.close === 'function'
        ) {
          fileOut.close();
        }
        resolve();
      });
    });
  };

  /**
   * Return origin stream
   */
  get stream(): Stream {
    if (this.disturbed) {
      throw new Error(`Response used already for: ${this.config.requestURL}`);
    }
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
    const contentType = this.config.headers.get(HEADER_MAP.CONTENT_TYPE) || '';
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
    const text = buffer.toString();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(text);
    }
  };

  /**
   * Decode response as buffer
   */
  buffer = (): Promise<Buffer> => {
    return this.consumeResponse();
  };
}
