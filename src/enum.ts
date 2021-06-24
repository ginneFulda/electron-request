export const enum HEADER_MAP {
  CONTENT_LENGTH = 'content-length',
  ACCEPT_ENCODING = 'accept-encoding',
  ACCEPT = 'accept',
  CONNECTION = 'connection',
  CONTENT_TYPE = 'content-Type',
  LOCATION = 'location',
  CONTENT_ENCODING = 'content-encoding',
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
