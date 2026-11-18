import type { Clock } from "../../src/clock.ts";

// The default time for tests: before the festival season, so that test
// festivals in 2027 are still to come.
export const defaultTestTime = new Date("2027-01-15T12:00:00Z");

export class FakeClock implements Clock {
  #now: Date;
  // Each pause that the application asked for, in milliseconds.
  readonly sleeps: number[] = [];

  constructor(now: Date = defaultTestTime) {
    this.#now = new Date(now);
  }

  now(): Date {
    return new Date(this.#now);
  }

  // The pause completes immediately and moves the time forward.
  async sleep(milliseconds: number): Promise<void> {
    this.sleeps.push(milliseconds);
    this.advance(milliseconds);
  }

  set(now: Date): void {
    this.#now = new Date(now);
  }

  advance(milliseconds: number): void {
    this.#now = new Date(this.#now.getTime() + milliseconds);
  }
}
