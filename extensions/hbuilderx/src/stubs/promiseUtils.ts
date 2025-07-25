import { EventEmitter } from "events";

export interface PromiseAdapter<T, U> {
  (
    value: T,
    resolve: (value: U | PromiseLike<U>) => void,
    reject: (reason: any) => void,
  ): any;
}

const passthrough = (value: any, resolve: (value?: any) => void) =>
  resolve(value);

/**
 * Return a promise that resolves with the next emitted event, or with some future
 * event as decided by an adapter.
 *
 * If specified, the adapter is a function that will be called with
 * `(event, resolve, reject)`. It will be called once per event until it resolves or
 * rejects.
 *
 * The default adapter is the passthrough function `(value, resolve) => resolve(value)`.
 *
 * @param eventEmitter the event emitter
 * @param eventName the event name to listen for
 * @param adapter controls resolution of the returned promise
 * @returns a promise that resolves or rejects as specified by the adapter
 */
export function promiseFromEvent<T, U>(
  eventEmitter: EventEmitter,
  eventName: string,
  adapter: PromiseAdapter<T, U> = passthrough,
): { promise: Promise<U>; cancel: EventEmitter } {
  const cancel = new EventEmitter();

  return {
    promise: new Promise<U>((resolve, reject) => {
      const cancelHandler = () => reject(new Error("Cancelled"));
      cancel.once("cancel", cancelHandler);

      const eventHandler = (value: T) => {
        try {
          // 清理监听器
          cancel.removeListener("cancel", cancelHandler);
          eventEmitter.removeListener(eventName, eventHandler);

          Promise.resolve(adapter(value, resolve, reject)).catch(reject);
        } catch (error) {
          // 清理监听器
          cancel.removeListener("cancel", cancelHandler);
          eventEmitter.removeListener(eventName, eventHandler);
          reject(error);
        }
      };

      eventEmitter.once(eventName, eventHandler);
    }),
    cancel,
  };
}
