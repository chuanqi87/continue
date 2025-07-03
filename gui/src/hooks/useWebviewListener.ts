import type { ToWebviewProtocol } from "core/protocol/index.js";
import { Message } from "core/protocol/messenger";
import { useContext, useEffect } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { isHBuilderX } from "../util";

declare const hbuilderx: any;

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
      let hbuilderxListener: (
        msg: Message<ToWebviewProtocol[T][0]>,
      ) => Promise<void>;

      if (!skip) {
        if (isHBuilderX()) {
          // HBuilderX使用onDidReceiveMessage监听
          hbuilderxListener = async (msg) => {
            console.log("[前端] useWebviewListener HBuilderX收到消息:", msg);
            if (msg.messageType === messageType) {
              console.log(
                "[前端] useWebviewListener 处理消息类型:",
                messageType,
              );
              const result = await handler(msg.data);
              ideMessenger.respond(messageType, result, msg.messageId);
            }
          };

          if (
            typeof hbuilderx !== "undefined" &&
            hbuilderx.onDidReceiveMessage
          ) {
            console.log(
              "[前端] useWebviewListener 使用hbuilderx.onDidReceiveMessage监听:",
              messageType,
            );
            hbuilderx.onDidReceiveMessage(hbuilderxListener);
          } else {
            console.log(
              "[前端] useWebviewListener hbuilderx.onDidReceiveMessage不可用",
            );
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
