// The application gets the current time only from the injected Clock, so tests
// can replace it with a fake. A pause between requests also uses the Clock, so
// that tests do not wait.
export interface Clock {
  now(): Date;
  sleep(milliseconds: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => new Date(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};
