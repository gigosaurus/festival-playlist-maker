import type { Clock } from "./clock.ts";

export interface QueueState {
  // True while the queue does work.
  running: boolean;
  // The cause of the failure that stopped the last run.
  problem?: { cause: string; at: Date };
}

export interface BackgroundQueue<Item> {
  // Adds the items and starts a run when no run is active. It does not wait for the work.
  // An item with the key of a waiting item replaces it. A call removes the problem of the last run.
  add(items: Iterable<[key: string, item: Item]>): void;
  state(): QueueState;
  // Resolves when the queue has no more work. For tests.
  idle(): Promise<void>;
}

// Does the work for one item at a time, in the background. `work` gives the cause
// of a failure, or undefined. The first failure stops the run, because the next
// items probably fail for the same cause. The admin starts a new run.
export function createBackgroundQueue<Item>(
  clock: Clock,
  name: string,
  work: (item: Item) => Promise<string | undefined>,
): BackgroundQueue<Item> {
  const waiting = new Map<string, Item>();
  let run: Promise<void> | undefined;
  let problem: QueueState["problem"];

  async function doWork(): Promise<void> {
    for (const [key, item] of waiting) {
      waiting.delete(key);
      const cause = await work(item);
      if (cause !== undefined) {
        problem = { cause, at: clock.now() };
        waiting.clear();
        return;
      }
    }
  }

  return {
    add(items) {
      problem = undefined;
      for (const [key, item] of items) waiting.set(key, item);
      if (run !== undefined || waiting.size === 0) return;
      run = doWork()
        .catch((error: unknown) => {
          problem = { cause: `The work stopped because of an error in the application: ${String(error)}`, at: clock.now() };
          waiting.clear();
          console.error(`The ${name} queue stopped.`, error);
        })
        .finally(() => {
          run = undefined;
        });
    },

    state() {
      return problem === undefined ? { running: run !== undefined } : { running: run !== undefined, problem };
    },

    async idle() {
      while (run !== undefined) await run;
    },
  };
}
