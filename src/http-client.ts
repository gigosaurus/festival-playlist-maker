// All outbound requests go through one HttpClient. The application gets the
// client by injection, so tests can replace it with a fake.
// Later changes add the rules of each service (rate limits, keys, Retry-After).
export interface HttpClient {
  send(request: Request): Promise<Response>;
}

export function createFetchHttpClient(): HttpClient {
  return {
    send: (request) => fetch(request),
  };
}
