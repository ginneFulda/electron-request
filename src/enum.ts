export const enum HEADER_MAP {
  CONTENT_LENGTH = 'Content-Length',
  ACCEPT_ENCODING = 'Accept-Encoding',
  ACCEPT = 'Accept',
  CONNECTION = 'Connection',
  CONTENT_TYPE = 'Content-Type',
  LOCATION = 'Location',
  CONTENT_ENCODING = 'Content-Encoding',
}

export const enum REQUEST_EVENT {
  ERROR = 'error',
  ABORT = 'abort',
  RESPONSE = 'response',
  LOGIN = 'login',
}

export const enum RESPONSE_EVENT {
  ERROR = 'error',
  CANCEL_REQUEST = 'cancel-request',
  DATA = 'data',
  END = 'end',
}

export const enum COMPRESSION_TYPE {
  GZIP = 'gzip',
  DEFLATE = 'deflate',
  BR = 'br',
}

export const enum METHOD_MAP {
  GET = 'GET',
  POST = 'POST',
  HEAD = 'HEAD',
}
