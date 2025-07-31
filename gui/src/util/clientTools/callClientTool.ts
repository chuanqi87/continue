import { ContextItem, ToolCallState } from "core";
import { BuiltInToolNames } from "core/tools/builtIn";
import { IIdeMessenger } from "../../context/IdeMessenger";
import { AppThunkDispatch, RootState } from "../../redux/store";
import { editToolImpl } from "./editImpl";
import { searchReplaceToolImpl } from "./searchReplaceImpl";

export interface ClientToolExtras {
  getState: () => RootState;
  dispatch: AppThunkDispatch;
  ideMessenger: IIdeMessenger;
}

export interface ClientToolOutput {
  output: ContextItem[] | undefined;
  respondImmediately: boolean;
}

export interface ClientToolResult extends ClientToolOutput {
  errorMessage: string | undefined;
}

export type ClientToolImpl = (
  args: any,
  toolCallId: string,
  extras: ClientToolExtras,
) => Promise<ClientToolOutput>;

export async function callClientTool(
  toolCallState: ToolCallState,
  extras: ClientToolExtras,
): Promise<ClientToolResult> {
  const { toolCall, parsedArgs } = toolCallState;

  console.log("[hbuilderx] callClientTool: Starting client tool call", {
    toolName: toolCall.function.name,
    toolCallId: toolCall.id,
    parsedArgs,
  });

  try {
    let output: ClientToolOutput;
    switch (toolCall.function.name) {
      case BuiltInToolNames.EditExistingFile:
        console.log(
          "[hbuilderx] callClientTool: Calling edit tool implementation",
          { toolCallId: toolCall.id },
        );
        output = await editToolImpl(parsedArgs, toolCall.id, extras);
        break;
      case BuiltInToolNames.SearchAndReplaceInFile:
        console.log(
          "[hbuilderx] callClientTool: Calling search and replace tool implementation",
          { toolCallId: toolCall.id },
        );
        output = await searchReplaceToolImpl(parsedArgs, toolCall.id, extras);
        break;
      default:
        console.error("[hbuilderx] callClientTool: Invalid client tool name", {
          toolName: toolCall.function.name,
        });
        throw new Error(`Invalid client tool name ${toolCall.function.name}`);
    }

    console.log(
      "[hbuilderx] callClientTool: Client tool call completed successfully",
      {
        toolName: toolCall.function.name,
        respondImmediately: output.respondImmediately,
        hasOutput: !!output.output,
      },
    );

    return {
      ...output,
      errorMessage: undefined,
    };
  } catch (e: unknown) {
    let errorMessage = `${e}`;
    if (e instanceof Error) {
      errorMessage = e.message;
    }

    console.error("[hbuilderx] callClientTool: Client tool call failed", {
      toolName: toolCall.function.name,
      toolCallId: toolCall.id,
      errorMessage,
    });

    return {
      respondImmediately: true,
      errorMessage,
      output: undefined,
    };
  }
}
