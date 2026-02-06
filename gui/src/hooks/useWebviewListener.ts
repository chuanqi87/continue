import type { ToWebviewProtocol } from "core/protocol/index.js";
import { Message } from "core/protocol/messenger";
import { useContext, useEffect } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { isHBuilderX } from "../util";

declare const hbuilderx: any;

// 添加全局监听器管理
const hbuilderxListeners = new Map<string, Function>();

export function useWebviewListener<T extends keyof ToWebviewProtocol>(
  messageType: T,
  handler: (data: ToWebviewProtocol[T][0]) => Promise<ToWebviewProtocol[T][1]>,
  dependencies?: any[],
  skip?: boolean,
) {
  const ideMessenger = useContext(IdeMessengerContext);

  useEffect(
    () => {
      let listener: (event: {
        data: Message<ToWebviewProtocol[T][0]>;
      }) => Promise<void>;
      if (!skip) {
        if (isHBuilderX()) {
          // 移除旧的监听器
          if (hbuilderxListeners.has(messageType)) {
            console.log(`[前端] 移除旧的 ${messageType} 监听器`);
            hbuilderxListeners.delete(messageType);
          }

          const hbuilderxListener = async (
            msg: Message<ToWebviewProtocol[T][0]>,
          ) => {
            if (msg.messageType === messageType) {
              const result = await handler(msg.data);
              ideMessenger.respond(messageType, result, msg.messageId);
            }
          };

          // 存储监听器引用
          hbuilderxListeners.set(messageType, hbuilderxListener);

          if (
            typeof hbuilderx !== "undefined" &&
            hbuilderx.onDidReceiveMessage
          ) {
            hbuilderx.onDidReceiveMessage(hbuilderxListener);
          }
        } else {
          // VSCode和IntelliJ使用window.addEventListener
          listener = async (event) => {
            if (event.data.messageType === messageType) {
              const result = await handler(event.data.data);
              ideMessenger.respond(messageType, result, event.data.messageId);
            }
          };
          window.addEventListener("message", listener);
        }
      }

      return () => {
        if (isHBuilderX()) {
          hbuilderxListeners.delete(messageType);
        }
        if (listener) {
          window.removeEventListener("message", listener);
        }
        // 注意：HBuilderX的onDidReceiveMessage可能没有移除监听器的方法
        // 这可能会导致内存泄漏，但这是HBuilderX API的限制
      };
    },
    dependencies ? [...dependencies, skip, ideMessenger] : [skip, ideMessenger],
  );
}
