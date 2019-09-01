export class EventEmitter {
  emit(event: string | symbol, ...args: any[]): Promise<any>;
  on(event: string | symbol, handler: (...args: any[]) => Promise<any>): void;
}
