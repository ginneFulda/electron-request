import Request from './Request';
import type { Options, Response, ProgressInfo } from './typings.d';

const main = (requestURL: string, options: Options = {}): Promise<Response> => {
  const request = new Request({ requestURL, ...options });
  return request.send();
};

export type { Response, ProgressInfo };

export default main;
