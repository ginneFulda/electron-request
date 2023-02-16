import { checkIsHttpToken, checkInvalidHeaderChar } from './utils';

const sanitizeKey = (name: string) => {
  if (!checkIsHttpToken(name)) {
    throw new TypeError(`${name} is not a legal HTTP header name`);
  }
  return name.toLowerCase();
};

const sanitizeValue = (value: string) => {
  if (checkInvalidHeaderChar(value)) {
    throw new TypeError(`${value} is not a legal HTTP header value`);
  }
  return value;
};

type HeaderValue = string | string[];

class Headers {
  private map: Map<string, string | string[]> = new Map();

  constructor(init: Record<string, HeaderValue | undefined> = {}) {
    for (const [key, value] of Object.entries(init)) {
      if (value) {
        this.set(key, value);
      }
    }
  }

  public raw = () => {
    const result: Record<string, HeaderValue> = {};
    for (const [key, value] of this.map.entries()) {
      result[key] = value;
    }
    return result;
  };

  public append = (key: string, value: string) => {
    const prev = this.get(key);
    if (!prev) {
      this.set(key, value);
    } else {
      this.set(key, Array.isArray(prev) ? [...prev, value] : [prev, value]);
    }
  };

  public get = (key: string) => {
    const value = this.map.get(sanitizeKey(key));
    if (typeof value === 'string') {
      return value;
    }
    if (Array.isArray(value)) {
      return value.join(',');
    }
    return null;
  };

  public has = (key: string) => this.map.has(sanitizeKey(key));

  public set = (key: string, value: HeaderValue) => {
    const data = Array.isArray(value)
      ? value.map(sanitizeValue)
      : sanitizeValue(value);
    this.map.set(sanitizeKey(key), data);
  };

  public delete = (key: string) => {
    this.map.delete(sanitizeKey(key));
  };
}

export default Headers;
