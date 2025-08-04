export async function measureExecutionTime<T>(
  fn: () => Promise<T>,
  operationName: string
): Promise<T> {
  const startTime = performance.now();
  try {
    const result = await fn();
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`⏱️  ${operationName} completed in ${duration.toFixed(2)}ms`);
    return result;
  } catch (error) {
    const endTime = performance.now();
    const duration = endTime - startTime;
    console.log(`❌ ${operationName} failed after ${duration.toFixed(2)}ms`);
    throw error;
  }
}
