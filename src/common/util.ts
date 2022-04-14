export async function presult<T>(promise: Promise<T>): Promise<[undefined, T] | [Error, undefined]> {
  try {
    const value = await promise;
    return [undefined, value];
  } catch (error) {
    return [error as Error, undefined];
  }
}
