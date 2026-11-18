// The application gets the current time only from the injected Clock, so tests
// can replace it with a fake.
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};
