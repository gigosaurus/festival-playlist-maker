// Loaded before the tests with "node --import". The global fetch function fails,
// so that no test sends a request to an external service. Use FakeHttpClient.
globalThis.fetch = async (input) => {
  const url = input instanceof Request ? input.url : String(input);
  throw new Error(`A test tried to send a network request to ${url}. Use FakeHttpClient.`);
};
