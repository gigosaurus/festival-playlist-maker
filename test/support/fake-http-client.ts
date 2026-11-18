import type { HttpClient } from "../../src/http-client.ts";

export interface RecordedResponse {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface SentRequest {
  method: string;
  url: string;
}

// Gives recorded responses and never sends a request to the network.
// A request with no recorded response fails, so that a test cannot depend on a
// real service by accident.
export class FakeHttpClient implements HttpClient {
  readonly requests: SentRequest[] = [];
  #responses = new Map<string, RecordedResponse>();

  respondTo(method: string, url: string, response: RecordedResponse): void {
    this.#responses.set(key(method, url), response);
  }

  async send(request: Request): Promise<Response> {
    this.requests.push({ method: request.method, url: request.url });
    const recorded = this.#responses.get(key(request.method, request.url));
    if (recorded === undefined) {
      throw new Error(`The fake HTTP client has no recorded response for ${request.method} ${request.url}`);
    }
    return new Response(recorded.body ?? "", {
      status: recorded.status ?? 200,
      headers: recorded.headers,
    });
  }

  reset(): void {
    this.requests.length = 0;
    this.#responses.clear();
  }
}

function key(method: string, url: string): string {
  return `${method.toUpperCase()} ${new URL(url).href}`;
}
