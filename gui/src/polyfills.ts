/**
 * Polyfills for HBuilderX compatibility
 * 为 HBuilderX 兼容性提供的 polyfills
 */

// Object.hasOwn polyfill (ES2022 -> ES2015+)
if (!Object.hasOwn) {
  console.log("[hbuilderx] 添加 Object.hasOwn polyfill");
  Object.defineProperty(Object, "hasOwn", {
    value: function (object: any, key: string | number | symbol): boolean {
      return Object.prototype.hasOwnProperty.call(object, key);
    },
    configurable: true,
    enumerable: false,
    writable: true,
  });
}

// Array.prototype.at polyfill (ES2022 -> ES2015+)
if (!Array.prototype.at) {
  console.log("[hbuilderx] 添加 Array.prototype.at polyfill");
  Array.prototype.at = function (index: number) {
    const len = this.length;
    if (index < 0) {
      index = len + index;
    }
    return this[index];
  };
}

// String.prototype.at polyfill (ES2022 -> ES2015+)
if (!String.prototype.at) {
  console.log("[hbuilderx] 添加 String.prototype.at polyfill");
  String.prototype.at = function (index: number) {
    const len = this.length;
    if (index < 0) {
      index = len + index;
    }
    return this[index];
  };
}

// Promise.allSettled polyfill (ES2020 -> ES2015+)
if (!Promise.allSettled) {
  console.log("[hbuilderx] 添加 Promise.allSettled polyfill");
  Promise.allSettled = function (promises: readonly unknown[]) {
    return Promise.all(
      promises.map((promise) =>
        Promise.resolve(promise)
          .then((value) => ({ status: "fulfilled" as const, value }))
          .catch((reason) => ({ status: "rejected" as const, reason })),
      ),
    );
  };
}

// globalThis polyfill
if (typeof globalThis === "undefined") {
  console.log("[hbuilderx] 添加 globalThis polyfill");
  (function () {
    if (typeof self !== "undefined") {
      (self as any).globalThis = self;
    } else if (typeof window !== "undefined") {
      (window as any).globalThis = window;
    } else if (typeof global !== "undefined") {
      (global as any).globalThis = global;
    } else {
      throw new Error("Unable to locate global object");
    }
  })();
}

// structuredClone polyfill (用于深拷贝对象)
if (typeof structuredClone === "undefined") {
  console.log("[hbuilderx] 添加 structuredClone polyfill");
  (globalThis as any).structuredClone = function structuredClone<T>(
    obj: T,
    options?: { transfer?: any[] },
  ): T {
    // 处理基本类型
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    // 处理 Date
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }

    // 处理 RegExp
    if (obj instanceof RegExp) {
      return new RegExp(obj.source, obj.flags) as any;
    }

    // 处理 Array
    if (Array.isArray(obj)) {
      return obj.map((item) => structuredClone(item)) as any;
    }

    // 处理 Map
    if (obj instanceof Map) {
      const clonedMap = new Map();
      obj.forEach((value, key) => {
        clonedMap.set(structuredClone(key), structuredClone(value));
      });
      return clonedMap as any;
    }

    // 处理 Set
    if (obj instanceof Set) {
      const clonedSet = new Set();
      obj.forEach((value) => {
        clonedSet.add(structuredClone(value));
      });
      return clonedSet as any;
    }

    // 处理普通对象
    if (obj.constructor === Object || obj.constructor === undefined) {
      const clonedObj: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          clonedObj[key] = structuredClone((obj as any)[key]);
        }
      }
      return clonedObj;
    }

    // 对于其他类型（如 ArrayBuffer、TypedArray 等），尝试使用 JSON
    // 这不是完美的解决方案，但对大多数情况足够了
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      console.warn(
        "[hbuilderx] structuredClone polyfill: 无法克隆对象，返回原对象",
        e,
      );
      return obj;
    }
  };
}

console.log("[hbuilderx] Polyfills 加载完成");
