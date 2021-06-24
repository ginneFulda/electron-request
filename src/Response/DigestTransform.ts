/* eslint-disable no-underscore-dangle */
import { Transform } from 'stream';
import { createHash } from 'crypto';
import type { BinaryToTextEncoding, Hash } from 'crypto';
import type { ValidateOptions } from '@/typings.d';

const newError = (message: string, code: string) => {
  const error = new Error(message);
  (error as NodeJS.ErrnoException).code = code;
  return error;
};

class DigestTransform extends Transform {
  private readonly digester: Hash;
  private _actual: string | null = null;
  readonly expected: string;
  private readonly algorithm: string;
  private readonly encoding: BinaryToTextEncoding;

  // noinspection JSUnusedGlobalSymbols
  get actual() {
    return this._actual;
  }

  isValidateOnEnd = true;

  constructor(options: ValidateOptions) {
    super();
    const { expected, algorithm = 'md5', encoding = 'base64' } = options;
    this.expected = expected;
    this.algorithm = algorithm;
    this.encoding = encoding;
    this.digester = createHash(algorithm);
  }

  // noinspection JSUnusedGlobalSymbols
  _transform(chunk: Buffer, encoding: string, callback: any) {
    this.digester.update(chunk);
    callback(null, chunk);
  }

  // noinspection JSUnusedGlobalSymbols
  _flush(callback: any): void {
    this._actual = this.digester.digest(this.encoding);

    if (this.isValidateOnEnd) {
      try {
        this.validate();
      } catch (e) {
        callback(e);
        return;
      }
    }

    callback(null);
  }

  validate() {
    if (this._actual == null) {
      throw newError('Not finished yet', 'ERR_STREAM_NOT_FINISHED');
    }

    if (this._actual !== this.expected) {
      throw newError(
        `${this.algorithm} checksum mismatch, expected ${this.expected}, got ${this._actual}`,
        'ERR_CHECKSUM_MISMATCH',
      );
    }

    return null;
  }
}

export default DigestTransform;
