[English](./README.md) | 简体中文

# electron-request

> 在 Electron 或 Node.js 环境下使用的轻量的零依赖的 http 请求库

## 为什么

electron-request 在 Electron 环境下使用其内置的 net 模块，在 Node.js 环境下使用其内置的 HTTP 模块。

在 Electron 中使用 net 模块，更好的支持代理、身份验证、流量监控等功能。详细可查看[net 文档](https://www.electronjs.org/docs/api/net)。

## 特性

- 零依赖，足够轻量
- 快速上手，类似 window.fetch 的使用方式
- 不需要引入额外库，支持文件下载进度功能和文件校验功能
- 支持在 Electron 或 Node.js 上运行，优先使用 Electron 的 net 模块
- 统一的错误处理

## 安装

```bash
npm install electron-request --save
# or
yarn add electron-request
```

## 使用

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

- url：请求地址

- options：配置项

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
    headers?: Record<string, string>;
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
