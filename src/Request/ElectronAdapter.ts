import type { EventEmitter } from 'events';
import type { IncomingMessage } from 'http';
import type { Session } from '@/typings.d';

interface AuthInfo {
  isProxy: boolean;
  scheme: string;
  host: string;
  port: number;
  realm: string;
}

export interface ElectronClientRequest extends EventEmitter {
  writable: boolean;
  write(buffer: Uint8Array | string, cb?: (err?: Error | null) => void): boolean;
  write(str: string, encoding?: BufferEncoding, cb?: (err?: Error | null) => void): boolean;
  end(cb?: () => void): void;
  end(data: string | Uint8Array, cb?: () => void): void;
  end(str: string, encoding?: BufferEncoding, cb?: () => void): void;
  /**
   * `callback` is essentially a dummy function introduced in the purpose of keeping
   * similarity with the Node.js API. It is called asynchronously in the next tick
   * after `chunk` content have been delivered to the Chromium networking layer.
   * Contrary to the Node.js implementation, it is not guaranteed that `chunk`
   * content have been flushed on the wire before `callback` is called.
   *
   * Adds a chunk of data to the request body. The first write operation may cause
   * the request headers to be issued on the wire. After the first write operation,
   * it is not allowed to add or remove a custom header.
   */
  write(chunk: string | Buffer, encoding?: string, callback?: () => void): void;
  /**
   * Sends the last chunk of the request data. Subsequent write or end operations
   * will not be allowed. The `finish` event is emitted just after the end operation.
   */
  end(chunk?: string | Buffer, encoding?: string, callback?: () => void): void;
  on(
    event: 'response',
    listener: (
      /**
       * An object representing the HTTP response message.
       */
      response: IncomingMessage,
    ) => void,
  ): this;
  /**
   * Emitted when the `request` is aborted. The `abort` event will not be fired if
   * the `request` is already closed.
   */
  on(event: 'abort', listener: Function): this;
  /**
   * Emitted when the `net` module fails to issue a network request. Typically when
   * the `request` object emits an `error` event, a `close` event will subsequently
   * follow and no response object will be provided.
   */
  on(
    event: 'error',
    listener: (
      /**
       * an error object providing some information about the failure.
       */
      error: Error,
    ) => void,
  ): this;
  /**
   * Emitted when an authenticating proxy is asking for user credentials.
   *
   * The `callback` function is expected to be called back with user credentials:
   *
   * * `username` String
   * * `password` String
   *
   * Providing empty credentials will cancel the request and report an authentication
   * error on the response object:
   */
  on(
    event: 'login',
    listener: (
      authInfo: AuthInfo,
      callback: (username?: string, password?: string) => void,
    ) => void,
  ): this;
  /**
   * Cancels an ongoing HTTP transaction. If the request has already emitted the
   * `close` event, the abort operation will have no effect. Otherwise an ongoing
   * event will emit `abort` and `close` events. Additionally, if there is an ongoing
   * response object,it will emit the `aborted` event.
   */
  abort: () => void;
  /**
   * The value of a previously set extra header name.
   */
  getHeader: (name: string) => string;
  /**
   * Adds an extra HTTP header. The header name will be issued as-is without
   * lowercasing. It can be called only before first write. Calling this method after
   * the first write will throw an error. If the passed value is not a `String`, its
   * `toString()` method will be called to obtain the final value.
   *
   * Certain headers are restricted from being set by apps. These headers are listed
   * below. More information on restricted headers can be found in Chromium's header
   * utils.
   *
   * * `Content-Length`
   * * `Host`
   * * `Trailer` or `Te`
   * * `Upgrade`
   * * `Cookie2`
   * * `Keep-Alive`
   * * `Transfer-Encoding`
   *
   * Additionally, setting the `Connection` header to the value `upgrade` is also
   * disallowed.
   */
  setHeader: (name: string, value: string) => void;
}

interface ClientRequestConstructorOptions {
  /**
   * The HTTP request method. Defaults to the GET method.
   */
  method?: string;
  /**
   * The request URL. Must be provided in the absolute form with the protocol scheme
   * specified as http or https.
   */
  url?: string;
  /**
   * The `Session` instance with which the request is associated.
   */
  session?: Session;
  /**
   * The name of the `partition` with which the request is associated. Defaults to
   * the empty string. The `session` option supersedes `partition`. Thus if a
   * `session` is explicitly specified, `partition` is ignored.
   */
  partition?: string;
  /**
   * Can be `include` or `omit`. Whether to send credentials with this request. If
   * set to `include`, credentials from the session associated with the request will
   * be used. If set to `omit`, credentials will not be sent with the request (and
   * the `'login'` event will not be triggered in the event of a 401). This matches
   * the behavior of the fetch option of the same name. If this option is not
   * specified, authentication data from the session will be sent, and cookies will
   * not be sent (unless `useSessionCookies` is set).
   */
  credentials?: 'include' | 'omit';
  /**
   * Whether to send cookies with this request from the provided session. If
   * `credentials` is specified, this option has no effect. Default is `false`.
   */
  useSessionCookies?: boolean;
  /**
   * Can be `http:` or `https:`. The protocol scheme in the form 'scheme:'. Defaults
   * to 'http:'.
   */
  protocol?: string;
  /**
   * The server host provided as a concatenation of the hostname and the port number
   * 'hostname:port'.
   */
  host?: string;
  /**
   * The server host name.
   */
  hostname?: string;
  /**
   * The server's listening port number.
   */
  port?: number;
  /**
   * The path part of the request URL.
   */
  path?: string;
  /**
   * Can be `follow`, `error` or `manual`. The redirect mode for this request. When
   * mode is `error`, any redirection will be aborted. When mode is `manual` the
   * redirection will be cancelled unless `request.followRedirect` is invoked
   * synchronously during the `redirect` event.  Defaults to `follow`.
   */
  redirect?: 'follow' | 'error' | 'manual';
  /**
   * The origin URL of the request.
   */
  origin?: string;
}

export default class ElectronAdapter {
  // eslint-disable-next-line global-require
  private readonly electron = require('electron');

  whenReady(): Promise<void> {
    return this.electron.app.whenReady();
  }

  request(options: ClientRequestConstructorOptions): ElectronClientRequest {
    return this.electron.net.request(options);
  }

  getDefaultSession(): Session {
    return this.electron.session.defaultSession;
  }
}
