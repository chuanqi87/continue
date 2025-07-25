import { ChatMessage, IDE, PromptLog } from "core";
import type {
  FromWebviewProtocol,
  ToCoreProtocol,
  ToWebviewProtocol,
} from "core/protocol";
import { Message } from "core/protocol/messenger";
import { MessageIde } from "core/protocol/messenger/messageIde";
import {
  GeneratorReturnType,
  GeneratorYieldType,
  WebviewProtocolGeneratorMessage,
  WebviewSingleMessage,
  WebviewSingleProtocolMessage,
} from "core/protocol/util";
import { createContext } from "react";
import { v4 as uuidv4 } from "uuid";
import { isHBuilderX, isJetBrains } from "../util";

interface vscode {
  postMessage(message: any): vscode;
}

declare const vscode: any;
declare const hbuilderx: any;

export interface IIdeMessenger {
  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
    attempt?: number,
  ): void;

  respond<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][1],
    messageId: string,
  ): void;

  request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewSingleProtocolMessage<T>>;

  streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<
    GeneratorYieldType<FromWebviewProtocol[T][1]>[],
    GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined
  >;

  llmStreamChat(
    msg: ToCoreProtocol["llm/streamChat"][0],
    cancelToken: AbortSignal,
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined>;

  ide: IDE;
}

export class IdeMessenger implements IIdeMessenger {
  ide: IDE;

  constructor() {
    this.ide = new MessageIde(
      async (messageType, data) => {
        const result = await this.request(messageType, data);
        if (result.status === "error") {
          throw new Error(result.error);
        }
        return result.content;
      },
      () => {},
    );
  }

  private _postToIde(
    messageType: string,
    data: any,
    messageId: string = uuidv4(),
  ) {
    if (typeof vscode === "undefined") {
      if (isJetBrains()) {
        if (window.postIntellijMessage === undefined) {
          console.log(
            "Unable to send message: postIntellijMessage is undefined. ",
            messageType,
            data,
          );
          throw new Error("postIntellijMessage is undefined");
        }
        window.postIntellijMessage?.(messageType, data, messageId);
        return;
      } else if (isHBuilderX()) {
        // HBuilderX消息发送机制
        if (hbuilderx.postMessage === undefined) {
          console.log(
            "[hbuilderx] 无法发送消息: hbuilderx.postMessage",
            messageType,
            data,
          );
          throw new Error("hbuilderx.postMessage is undefined");
        }
        const msg: Message = {
          messageId,
          messageType,
          data,
        };
        hbuilderx.postMessage(msg);
        return;
      } else {
        console.log(
          "Unable to send message: vscode is undefined",
          messageType,
          data,
        );
        return;
      }
    }

    const msg: Message = {
      messageId,
      messageType,
      data,
    };

    vscode.postMessage(msg);
  }

  post<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    messageId?: string,
    attempt: number = 0,
  ) {
    try {
      this._postToIde(messageType, data, messageId);
    } catch (error) {
      if (attempt < 5) {
        console.log(`Attempt ${attempt} failed. Retrying...`);
        setTimeout(
          () => this.post(messageType, data, messageId, attempt + 1),
          Math.pow(2, attempt) * 1000,
        );
      } else {
        console.error(
          "Max attempts reached. Message could not be sent.",
          error,
        );
      }
    }
  }

  respond<T extends keyof ToWebviewProtocol>(
    messageType: T,
    data: ToWebviewProtocol[T][1],
    messageId: string,
  ) {
    this._postToIde(messageType, data, messageId);
  }

  request<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
  ): Promise<WebviewSingleMessage<T>> {
    const messageId = uuidv4();

    return new Promise((resolve) => {
      if (isHBuilderX()) {
        // HBuilderX使用onDidReceiveMessage监听
        const handler = (msg: any) => {
          console.log("[前端] HBuilderX收到消息:", msg);
          if (msg.messageId === messageId) {
            console.log("[前端] 找到匹配的messageId:", messageId);
            // HBuilderX的onDidReceiveMessage需要手动移除监听器
            // 但HBuilderX API可能不支持移除，所以我们用一个标志位
            resolve(msg.data as WebviewSingleMessage<T>);
          }
        };

        if (typeof hbuilderx !== "undefined" && hbuilderx.onDidReceiveMessage) {
          console.log("[前端] 使用hbuilderx.onDidReceiveMessage监听");
          hbuilderx.onDidReceiveMessage(handler);
        } else {
          console.log("[前端] hbuilderx.onDidReceiveMessage不可用");
        }
      } else {
        // VSCode和IntelliJ使用window.addEventListener
        const handler = (event: any) => {
          if (event.data.messageId === messageId) {
            window.removeEventListener("message", handler);
            resolve(event.data.data as WebviewSingleMessage<T>);
          }
        };
        window.addEventListener("message", handler);
      }

      this.post(messageType, data, messageId);
    });
  }

  /**
   * Because of weird type stuff, we're actually yielding an array of the things
   * that are streamed. For example, if the return type here says
   * AsyncGenerator<ChatMessage>, then it's actually AsyncGenerator<ChatMessage[]>.
   * This needs to be handled by the caller.
   *
   * Using unknown for now to make this more explicit
   */
  async *streamRequest<T extends keyof FromWebviewProtocol>(
    messageType: T,
    data: FromWebviewProtocol[T][0],
    cancelToken?: AbortSignal,
  ): AsyncGenerator<
    GeneratorYieldType<FromWebviewProtocol[T][1]>[],
    GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined
  > {
    const messageId = uuidv4();

    this.post(messageType, data, messageId);

    const buffer: GeneratorYieldType<FromWebviewProtocol[T][1]>[] = [];
    let index = 0;
    let done = false;
    let returnVal: GeneratorReturnType<FromWebviewProtocol[T][1]> | undefined =
      undefined;
    let error: string | null = null;

    // This handler receieves individual WebviewMessengerResults
    // And pushes them to buffer
    if (isHBuilderX()) {
      // HBuilderX使用onDidReceiveMessage监听流式响应
      const handler = (msg: Message<WebviewProtocolGeneratorMessage<T>>) => {
        console.log("[前端] HBuilderX流式消息:", msg);
        if (msg.messageId === messageId) {
          const responseData = msg.data;
          if ("error" in responseData) {
            error = responseData.error;
            return;
          }
          if (responseData.done) {
            done = true;
            returnVal = responseData.content;
          } else {
            buffer.push(responseData.content);
          }
        }
      };

      if (typeof hbuilderx !== "undefined" && hbuilderx.onDidReceiveMessage) {
        console.log("[前端] 使用hbuilderx.onDidReceiveMessage监听流式消息");
        hbuilderx.onDidReceiveMessage(handler);
      } else {
        console.log("[前端] hbuilderx.onDidReceiveMessage不可用");
      }
    } else {
      // VSCode和IntelliJ使用window.addEventListener
      const handler = (event: {
        data: Message<WebviewProtocolGeneratorMessage<T>>;
      }) => {
        if (event.data.messageId === messageId) {
          const responseData = event.data.data;
          if ("error" in responseData) {
            error = responseData.error;
            return;
            // throw new Error(responseData.error);
          }
          if (responseData.done) {
            window.removeEventListener("message", handler);
            done = true;
            returnVal = responseData.content;
          } else {
            buffer.push(responseData.content);
          }
        }
      };
      window.addEventListener("message", handler);
    }

    const handleAbort = () => {
      this.post("abort", undefined, messageId);
    };
    cancelToken?.addEventListener("abort", handleAbort);

    try {
      while (!done) {
        if (error) {
          throw error;
        }
        if (buffer.length > index) {
          const chunks = buffer.slice(index);
          index = buffer.length;
          yield chunks;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }

      if (buffer.length > index) {
        const chunks = buffer.slice(index);
        yield chunks;
      }

      if (!returnVal) {
        return undefined;
      }
      return returnVal;
    } catch (e) {
      throw e;
    } finally {
      cancelToken?.removeEventListener("abort", handleAbort);
    }
  }

  async *llmStreamChat(
    msg: ToCoreProtocol["llm/streamChat"][0],
    cancelToken: AbortSignal,
  ): AsyncGenerator<ChatMessage[], PromptLog | undefined> {
    const gen = this.streamRequest("llm/streamChat", msg, cancelToken);

    let next = await gen.next();
    while (!next.done) {
      yield next.value;
      next = await gen.next();
    }
    return next.value;
  }
}

export const IdeMessengerContext = createContext<IIdeMessenger>(
  new IdeMessenger(),
);

export const IdeMessengerProvider: React.FC<{
  children: React.ReactNode;
  messenger?: IIdeMessenger;
}> = ({ children, messenger = new IdeMessenger() }) => {
  return (
    <IdeMessengerContext.Provider value={messenger}>
      {children}
    </IdeMessengerContext.Provider>
  );
};
