/**
 * Retries a function with incremental backoff until validator returns true
 * @param {Function} fn - The function to execute
 * @param {object} [options] - Options for retry behavior
 * @param {Function} [options.validator] - Function to validate the result of fn. If not provided, the result is considered valid if it is truthy.
 * @param {number} [options.maxRetries=5] - Maximum number of retries
 * @param {number} [options.initialDelay=10] - Initial delay in ms
 * @param {number} [options.factor=2] - Multiplication factor for backoff
 * @return {Promise<any>} The successful result from fn
 * @throws {Error} If maximum retries are reached or if fn throws an error on final retry
 */
export type WaitForOptions<T> = {
  validator?: (result: T) => boolean;
  maxRetries?: number;
  initialDelay?: number;
  factor?: number;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export async function waitFor<T>(fn: () => Promise<T> | T, options: WaitForOptions<T> = {}): Promise<T> {
  const { validator = (i: T) => Boolean(i), maxRetries = 5, initialDelay = 10, factor = 2 } = options;

  let retries = 0;
  let delay: number = initialDelay;
  let lastError: unknown = null;

  while (retries <= maxRetries) {
    try {
      const result = await fn();

      if (validator(result)) {
        return result;
      }

      lastError = new Error(`Validator returned false for result`);
    } catch (error) {
      lastError = error;
    }

    retries += 1;

    if (retries > maxRetries) {
      break;
    }

    // Wait with exponential backoff
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= factor;
  }

  const lastErrorMessage = getErrorMessage(lastError);
  throw new Error(`Max retries reached (${maxRetries}): ${lastErrorMessage}`);
}
