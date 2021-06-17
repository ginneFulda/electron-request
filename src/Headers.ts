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

class Headers {
  private map: Map<string, string[]>;

  constructor(init: Record<string, string | string[] | undefined> = {}) {
    this.map = new Map();
    for (const [key, value] of Object.entries(init)) {
      if (value) {
        this.set(key, value);
      }
    }
  }

  public raw = () => {
    const result: Record<string, string[]> = {};
    for (const [key, value] of this.map.entries()) {
      result[key] = value;
    }
    return result;
  };

  public append = (key: string, value: string) => {
    const prev = this.map.get(key);
    if (!prev) {
      this.set(key, value);
    } else {
      prev.push(sanitizeValue(value));
    }
  };

  public get = (key: string) => {
    const value = this.map.get(sanitizeKey(key));
    if (value?.length === 1) {
      return value[0];
    }
    return null;
  };

  public has = (key: string) => this.map.has(sanitizeKey(key));

  public set = (key: string, value: string | string[]) => {
    const data = Array.isArray(value) ? value.map(sanitizeValue) : [sanitizeValue(value)];
    this.map.set(sanitizeKey(key), data);
  };

  public delete = (key: string) => {
    this.map.delete(sanitizeKey(key));
  };
}

export default Headers;
