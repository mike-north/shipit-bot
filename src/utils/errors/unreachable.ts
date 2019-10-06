class UnreachableError extends Error {
  constructor(nvr: never, message: string) {
    super(message);
  }
}

export default UnreachableError;
