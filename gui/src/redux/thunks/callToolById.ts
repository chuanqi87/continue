import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ContextItem } from "core";
import { CLIENT_TOOLS_IMPLS } from "core/tools/builtIn";
import posthog from "posthog-js";
import { callClientTool } from "../../util/clientTools/callClientTool";
import { selectSelectedChatModel } from "../slices/configSlice";
import {
  acceptToolCall,
  errorToolCall,
  setInactive,
  setToolCallCalling,
  updateToolCallOutput,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { findToolCallById, logToolUsage } from "../util";
import { streamResponseAfterToolCall } from "./streamResponseAfterToolCall";

export const callToolById = createAsyncThunk<
  void,
  { toolCallId: string },
  ThunkApiType
>("chat/callTool", async ({ toolCallId }, { dispatch, extra, getState }) => {
  console.log("[hbuilderx] callToolById: Starting tool call by ID", {
    toolCallId,
  });

  const state = getState();
  const toolCallState = findToolCallById(state.session.history, toolCallId);
  if (!toolCallState) {
    console.warn("[hbuilderx] callToolById: Tool call with ID not found", {
      toolCallId,
    });
    return;
  }

  if (toolCallState.status !== "generated") {
    console.log(
      "[hbuilderx] callToolById: Tool call not in generated status, skipping",
      {
        toolCallId,
        status: toolCallState.status,
      },
    );
    return;
  }

  const selectedChatModel = selectSelectedChatModel(state);

  if (!selectedChatModel) {
    console.error("[hbuilderx] callToolById: No model selected");
    throw new Error("No model selected");
  }

  console.log("[hbuilderx] callToolById: Setting tool call to calling status", {
    toolCallId,
  });
  dispatch(
    setToolCallCalling({
      toolCallId,
    }),
  );

  let output: ContextItem[] | undefined = undefined;
  let errorMessage: string | undefined = undefined;
  let streamResponse: boolean;

  // Check if telemetry is enabled
  const allowAnonymousTelemetry = state.config.config.allowAnonymousTelemetry;

  // IMPORTANT:
  // Errors that occur while calling tool call implementations
  // Are caught and passed in output as context items
  // Errors that occur outside specifically calling the tool
  // Should not be caught here - should be handled as normal stream errors
  if (
    CLIENT_TOOLS_IMPLS.find(
      (toolName) => toolName === toolCallState.toolCall.function.name,
    )
  ) {
    // Tool is called on client side
    console.log("[hbuilderx] callToolById: Calling client-side tool", {
      toolName: toolCallState.toolCall.function.name,
    });

    try {
      const {
        output: clientToolOutput,
        respondImmediately,
        errorMessage: clientToolError,
      } = await callClientTool(toolCallState, {
        dispatch,
        ideMessenger: extra.ideMessenger,
        getState,
      });
      output = clientToolOutput;
      errorMessage = clientToolError;
      streamResponse = respondImmediately;

      console.log("[hbuilderx] callToolById: Client-side tool call completed", {
        toolName: toolCallState.toolCall.function.name,
        hasError: !!errorMessage,
        respondImmediately,
      });
    } catch (error: unknown) {
      console.error("[hbuilderx] callToolById: Client-side tool call failed", {
        toolName: toolCallState.toolCall.function.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  } else {
    // Tool is called on core side
    console.log("[hbuilderx] callToolById: Calling core-side tool", {
      toolName: toolCallState.toolCall.function.name,
    });

    try {
      const result = await extra.ideMessenger.request("tools/call", {
        toolCall: toolCallState.toolCall,
      });

      if (result.status === "error") {
        console.error(
          "[hbuilderx] callToolById: Core-side tool call returned error",
          {
            toolName: toolCallState.toolCall.function.name,
            error: result.error,
          },
        );
        throw new Error(result.error);
      } else {
        output = result.content.contextItems;
        errorMessage = result.content.errorMessage;
        streamResponse = true;

        console.log("[hbuilderx] callToolById: Core-side tool call completed", {
          toolName: toolCallState.toolCall.function.name,
          hasError: !!errorMessage,
          contextItemsCount: output?.length || 0,
        });
      }
    } catch (error: unknown) {
      console.error("[hbuilderx] callToolById: Core-side tool call failed", {
        toolName: toolCallState.toolCall.function.name,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  if (errorMessage) {
    console.log(
      "[hbuilderx] callToolById: Updating tool call output with error",
      {
        toolCallId,
        errorMessage,
      },
    );
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: [
          {
            icon: "problems",
            name: "Tool Call Error",
            description: "Tool Call Failed",
            content: `${toolCallState.toolCall.function.name} failed with the message: ${errorMessage}\n\nPlease try something else or request further instructions.`,
            hidden: false,
          },
        ],
      }),
    );
  } else if (output?.length) {
    console.log(
      "[hbuilderx] callToolById: Updating tool call output with success",
      {
        toolCallId,
        contextItemsCount: output.length,
        outputDetails: output.map((item) => ({
          name: item.name,
          description: item.description,
          contentLength: item.content?.length || 0,
          hasIcon: !!item.icon,
        })),
      },
    );
    dispatch(
      updateToolCallOutput({
        toolCallId,
        contextItems: output,
      }),
    );
  } else {
    console.log("[hbuilderx] callToolById: No output to update", {
      toolCallId,
      hasError: !!errorMessage,
      outputLength: output?.length || 0,
    });
  }

  // Because we don't have access to use hooks, we check `allowAnonymousTelemetry`
  // directly rather than using `CustomPostHogProvider`
  if (allowAnonymousTelemetry) {
    // Capture telemetry for tool calls
    posthog.capture("gui_tool_call_outcome", {
      succeeded: errorMessage === undefined,
      toolName: toolCallState.toolCall.function.name,
      errorMessage: errorMessage,
    });
  }

  console.log(
    "[hbuilderx] callToolById: Preparing to handle tool call completion",
    {
      toolCallId,
      streamResponse,
      hasError: !!errorMessage,
      hasOutput: !!output?.length,
    },
  );

  if (streamResponse) {
    if (errorMessage) {
      console.log(
        "[hbuilderx] callToolById: Logging failed tool usage and setting error status",
        { toolCallId },
      );
      logToolUsage(toolCallState, false, false, extra.ideMessenger, output);
      dispatch(
        errorToolCall({
          toolCallId,
        }),
      );
    } else {
      console.log(
        "[hbuilderx] callToolById: Logging successful tool usage and setting done status",
        { toolCallId },
      );
      logToolUsage(toolCallState, true, true, extra.ideMessenger, output);
      dispatch(
        acceptToolCall({
          toolCallId,
        }),
      );
    }

    // Send to the LLM to continue the conversation
    console.log(
      "[hbuilderx] callToolById: Streaming response after tool call",
      { toolCallId },
    );
    const wrapped = await dispatch(
      streamResponseAfterToolCall({
        toolCallId,
      }),
    );
    unwrapResult(wrapped);
  } else {
    console.log(
      "[hbuilderx] callToolById: Setting inactive status (no stream response)",
      { toolCallId },
    );
    dispatch(setInactive());
  }
});
