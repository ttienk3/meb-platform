/**
 * In-Memory Keyed Mutex for Concurrency Control
 * Enforces INV-04: Prevents race condition during concurrent retail checkouts & auto-unpacking
 * Sorts keys alphabetically to guarantee deadlock-free execution
 */

const lockMap = new Map();

/**
 * Acquire lock for a single key
 * @param {string} key
 * @returns {Promise<Function>} release function
 */
function acquireLock(key) {
  let release;
  const currentPromise = new Promise((resolve) => {
    release = resolve;
  });

  const previousPromise = lockMap.get(key) || Promise.resolve();
  lockMap.set(key, previousPromise.then(() => currentPromise));

  return previousPromise.then(() => {
    return () => {
      release();
      if (lockMap.get(key) === currentPromise) {
        lockMap.delete(key);
      }
    };
  });
}

/**
 * Executes an async task while holding locks for specified product keys
 * @param {string} branchId - Branch UUID
 * @param {string|string[]} productIds - Single or multiple product UUIDs
 * @param {Function} task - Async function to execute
 */
async function withEntityLock(branchId, productIds, task) {
  const ids = Array.isArray(productIds) ? [...new Set(productIds)] : [productIds];
  // Sort keys alphabetically to prevent deadlocks across concurrent requests
  const keys = ids.filter(Boolean).map(id => `${branchId}:${id}`).sort();

  const releaseFns = [];
  try {
    for (const key of keys) {
      const release = await acquireLock(key);
      releaseFns.push(release);
    }
    return await task();
  } finally {
    // Release in reverse order
    while (releaseFns.length > 0) {
      const release = releaseFns.pop();
      try {
        release();
      } catch {
        // Ignore release errors
      }
    }
  }
}

module.exports = {
  withEntityLock,
  acquireLock,
  _activeLocksCount: () => lockMap.size
};
