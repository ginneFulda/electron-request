// Inspired by https://github.com/tmpvar/jsdom/blob/aa85b2abf07766ff7bf5c1f6daafb3726f2f2db5/lib/jsdom/living/blob.js

import type { Blob } from '../typings.d';

class BlobImpl implements Blob {
  private buffer: Buffer;
  private closed: boolean;
  private privateType: string = '';

  constructor(blobParts?: BlobPart[], options?: BlobPropertyBag) {
    const buffers: Buffer[] = [];

    if (blobParts) {
      if (
        !blobParts ||
        typeof blobParts !== 'object' ||
        blobParts instanceof Date ||
        blobParts instanceof RegExp
      ) {
        throw new TypeError('Blob parts must be objects that are not Dates or RegExps');
      }

      for (let i = 0, l = Number(blobParts.length); i < l; i += 1) {
        const part = blobParts[i];
        let buf: Buffer;

        if (part instanceof Buffer) {
          buf = part;
        } else if (part instanceof ArrayBuffer) {
          buf = Buffer.from(new Uint8Array(part));
        } else if (part instanceof BlobImpl) {
          buf = part.buffer;
        } else if (ArrayBuffer.isView(part)) {
          buf = Buffer.from(new Uint8Array(part.buffer, part.byteOffset, part.byteLength));
        } else {
          buf = Buffer.from(typeof part === 'string' ? part : String(part));
        }
        buffers.push(buf);
      }
    }

    this.buffer = Buffer.concat(buffers);
    this.closed = false;
    const type = options && options.type !== undefined && String(options.type).toLowerCase();

    if (type && !/[^\u0020-\u007E]/.test(type)) {
      this.privateType = type;
    }
  }

  public get size() {
    return this.buffer.length;
  }

  public get type() {
    return this.privateType;
  }

  public get content() {
    return this.buffer;
  }

  public get isClosed() {
    return this.closed;
  }

  public slice(start?: number, end?: number, type?: string) {
    const { size, buffer } = this;

    let relativeStart: number;
    let relativeEnd: number;
    if (start === void 0) {
      relativeStart = 0;
    } else if (start < 0) {
      relativeStart = Math.max(size + start, 0);
    } else {
      relativeStart = Math.min(start, size);
    }
    if (end === void 0) {
      relativeEnd = size;
    } else if (end < 0) {
      relativeEnd = Math.max(size + end, 0);
    } else {
      relativeEnd = Math.min(end, size);
    }
    const span = Math.max(relativeEnd - relativeStart, 0);
    const slicedBuffer = buffer.slice(relativeStart, relativeStart + span);
    const blob = new BlobImpl([], { type: type || this.type });
    blob.buffer = slicedBuffer;
    blob.closed = this.closed;
    return blob;
  }

  public close() {
    this.closed = true;
  }

  public toString() {
    return '[object Blob]';
  }
}

export default BlobImpl;
