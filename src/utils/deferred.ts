export default class Deferred<R> {
  protected resolveFn!: (value?: R | PromiseLike<R> | undefined) => void;

  protected rejectFn!: (reason?: any) => void;

  promise: Promise<R>;

  constructor() {
    this.promise = new Promise((res, rej): void => {
      this.resolveFn = res;
      this.rejectFn = rej;
    });
  }

  resolve(value?: R | PromiseLike<R> | undefined): void {
    this.resolveFn(value);
  }

  reject(value?: R | PromiseLike<R> | undefined): void {
    this.resolveFn(value);
  }
}
