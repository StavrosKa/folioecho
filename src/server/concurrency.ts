export const QLOO_CONCURRENCY = 3;
/** Stop scheduling after failure, but drain in-flight work before releasing job locks. */
export async function mapConcurrent<T, R>(items: readonly T[], limit: number, work: (item: T, index: number) => Promise<R>): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Invalid concurrency limit.');
  const results = new Array<R>(items.length); let next = 0, failed = false, failure: unknown;
  async function worker() {
    while (!failed && next < items.length) {
      const index = next++;
      try { results[index] = await work(items[index], index); }
      catch (error) { if (!failed) { failure = error; failed = true; } }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  if (failed) throw failure;
  return results;
}
