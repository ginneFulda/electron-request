import Request from './Request';
import type { Options, Response } from './typings.d';

const main = (requestURL: string, options: Options = {}): Promise<Response> => {
  const request = new Request({ requestURL, ...options });
  return request.send();
};

export type { ProgressInfo } from './typings.d';

export default main;
