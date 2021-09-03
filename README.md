English | [简体中文](./README.zh-CN.md)

# electron-request

> Zero-dependency, Lightweight HTTP request client for Electron or Node.js

## Why electron-request ?

Electron-request uses its built-in net module in Electron environment and uses its built-in HTTP module in Node.js environment.

Net module is used in electron to better support proxy, authentication, traffic monitoring proxies and other features. Please refer to [net](https://www.electronjs.org/docs/api/net) for details.

## Features

- Zero-dependency, Lightweight
- Quick start, similar window.fetch
- No need to import other libraries, support file download progress and file verification
- Support to run on Electron or Node.js, use Electron's net module first
- Unified error handling

## Install

```bash
npm install electron-request --save
# or
yarn add electron-request
```

## Usage

```ts
import request from 'electron-request';

void (async () => {
  const url = 'https://github.com/';
  const defaultOptions = {
    method: 'GET',
    body: null,
    followRedirect: true,
    maxRedirectCount: 20,
    timeout: 0,
    size: 0,
  };
  const response = await request(url, defaultOptions);
  const text = await response.text();
})();
```

## API

### request(url[, options])

- url: Request URL

- options: Options

  ```ts
  interface Options {
    /**
     * Request method
     * @default 'GET'
     */
    method?: string;
    /**
     * Request body
     * @default null
     */
    body?: string | null | Buffer | Stream;
    /**
     * Request headers
     */
    headers?: Record<string, string | string[]>;
    /**
     * Request query
     */
    query?: Record<string, string>;
    /**
     * Allow redirect
     * @default true
     */
    followRedirect?: boolean;
    /**
     * Maximum redirect count. 0 to not follow redirect
     * @default 20
     */
    maxRedirectCount?: number;
    /**
     * Request/Response timeout in ms. 0 to disable
     * @default 0
     */
    timeout?: number;
    /**
     * Maximum response body size in bytes. 0 to disable
     * @default 0
     */
    size?: number;
    /**
     * Whether to use nodejs native request
     * @default false
     */
    useNative?: boolean;

    // Docs: https://www.electronjs.org/docs/api/client-request#new-clientrequestoptions

    /**
     * Only in Electron. When use authenticated HTTP proxy, username to use to authenticate
     */
    username?: string;
    /**
     * Only in Electron. When use authenticated HTTP proxy, password to use to authenticate
     */
    password?: string;
    /**
     * Only in Electron. Whether to send cookies with this request from the provided session
     * @default true
     */
    useSessionCookies?: boolean;
    /**
     * Only in Electron. The Session instance with which the request is associated
     * @default electron.session.defaultSession
     */
    session?: Session;
  }
  ```

### Response

```ts
interface Response {
  /** Whether the response was successful (status in the range 200-299) */
  ok: boolean;
  /** Response headers */
  headers: Record<string, string | string[]>;
  /** Return origin stream */
  stream: Stream;
  /** Decode response as ArrayBuffer */
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Decode response as Blob */
  blob(): Promise<Blob>;
  /** Decode response as text */
  text(): Promise<string>;
  /** Decode response as json */
  json<T>(): Promise<T>;
  /** Decode response as buffer */
  buffer(): Promise<Buffer>;
  /**
   * Download file to destination
   * @param {Writable} destination Writable destination stream
   * @param {ProgressCallback=} onProgress Download progress callback
   * @param {ValidateOptions=} validateOptions Validate options
   */
  download: (
    destination: Writable,
    onProgress?: ProgressCallback,
    validateOptions?: ValidateOptions,
  ) => Promise<void>;
}

/** Download progress information */
interface ProgressInfo {
  /** Total file bytes */
  total: number;
  /** Delta file bytes */
  delta: number;
  /** Transferred file bytes */
  transferred: number;
  /** Transferred percentage */
  percent: number;
  /** Bytes transferred per second */
  bytesPerSecond: number;
}
```

## License

[MIT License](./LICENSE)

## electron-request vs. the Competition

| Package | Size |
| --- | --- |
| request | [![request package size](https://packagephobia.now.sh/badge?p=request)](https://packagephobia.now.sh/result?p=request) |
| axios | [![axios package size](https://packagephobia.now.sh/badge?p=axios)](https://packagephobia.now.sh/result?p=axios) |
| node-fetch | [![node-fetch package size](https://packagephobia.now.sh/badge?p=node-fetch)](https://packagephobia.now.sh/result?p=node-fetch) |
| request-pure | [![request-pure package size](https://packagephobia.now.sh/badge?p=request-pure)](https://packagephobia.now.sh/result?p=request-pure) |
| electron-request | [![electron-request package size](https://packagephobia.now.sh/badge?p=electron-request)](https://packagephobia.now.sh/result?p=electron-request) |
