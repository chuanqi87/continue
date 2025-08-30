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

console.log("[hbuilderx] Polyfills 加载完成");
