import { createAsyncThunk, unwrapResult } from "@reduxjs/toolkit";
import { ChatMessage } from "core";
import { renderContextItems } from "core/util/messageContent";
import {
  ChatHistoryItemWithMessageId,
  resetNextCodeBlockToApplyIndex,
  streamUpdate,
} from "../slices/sessionSlice";
import { ThunkApiType } from "../store";
import { findToolCallById } from "../util";
import { streamNormalInput } from "./streamNormalInput";
import { streamThunkWrapper } from "./streamThunkWrapper";

/**
 * Determines if we should continue streaming based on tool call completion status.
 */
function areAllToolsDoneStreaming(
  assistantMessage: ChatHistoryItemWithMessageId | undefined,
): boolean {
  // This might occur because of race conditions, if so, the tools are completed
  if (!assistantMessage?.toolCallStates) {
    return true;
  }

  // Only continue if all tool calls are complete
  const completedToolCalls = assistantMessage.toolCallStates.filter(
    (tc) => tc.status === "done",
  );

  return completedToolCalls.length === assistantMessage.toolCallStates.length;
}

export const streamResponseAfterToolCall = createAsyncThunk<
  void,
  { toolCallId: string },
  ThunkApiType
>(
  "chat/streamAfterToolCall",
  async ({ toolCallId }, { dispatch, getState }) => {
    console.log(
      "[hbuilderx] streamResponseAfterToolCall: Starting stream response after tool call",
      { toolCallId },
    );

    await dispatch(
      streamThunkWrapper(async () => {
        const state = getState();

        const toolCallState = findToolCallById(
          state.session.history,
          toolCallId,
        );

        if (!toolCallState) {
          console.log(
            "[hbuilderx] streamResponseAfterToolCall: Tool call state not found, skipping",
            { toolCallId },
          );
          return; // in cases where edit tool is cancelled mid apply, this will be triggered
        }

        const toolOutput = toolCallState.output ?? [];
        console.log(
          "[hbuilderx] streamResponseAfterToolCall: Found tool call state",
          {
            toolCallId,
            toolName: toolCallState.toolCall.function.name,
            outputCount: toolOutput.length,
            status: toolCallState.status,
            outputDetails: toolOutput.map((item) => ({
              name: item.name,
              description: item.description,
              contentLength: item.content?.length || 0,
            })),
          },
        );

        dispatch(resetNextCodeBlockToApplyIndex());
        await new Promise((resolve) => setTimeout(resolve, 0));

        // Create and dispatch the tool message
        const newMessage: ChatMessage = {
          role: "tool",
          content: renderContextItems(toolOutput),
          toolCallId,
        };

        console.log(
          "[hbuilderx] streamResponseAfterToolCall: Creating tool message",
          {
            toolCallId,
            contentLength: newMessage.content.length,
            contentPreview: newMessage.content.substring(0, 200) + "...",
            messageRole: newMessage.role,
          },
        );

        dispatch(streamUpdate([newMessage]));

        // Check if we should continue streaming based on tool call completion
        const history = getState().session.history;
        const assistantMessage = history.find(
          (item) =>
            item.message.role === "assistant" &&
            item.toolCallStates?.some((tc) => tc.toolCallId === toolCallId),
        );

        console.log(
          "[hbuilderx] streamResponseAfterToolCall: Checking if all tools are done streaming",
          {
            toolCallId,
            assistantMessageFound: !!assistantMessage,
            toolCallStatesCount: assistantMessage?.toolCallStates?.length || 0,
            allToolCallStates:
              assistantMessage?.toolCallStates?.map((tc) => ({
                toolCallId: tc.toolCallId,
                status: tc.status,
                functionName: tc.toolCall.function.name,
              })) || [],
          },
        );

        if (areAllToolsDoneStreaming(assistantMessage)) {
          console.log(
            "[hbuilderx] streamResponseAfterToolCall: All tools done, continuing with normal input stream",
            { toolCallId },
          );
          unwrapResult(await dispatch(streamNormalInput({})));
        } else {
          console.log(
            "[hbuilderx] streamResponseAfterToolCall: Not all tools done, waiting for completion",
            {
              toolCallId,
              completedCount:
                assistantMessage?.toolCallStates?.filter(
                  (tc) => tc.status === "done",
                ).length || 0,
              totalCount: assistantMessage?.toolCallStates?.length || 0,
            },
          );
        }
      }),
    );
  },
);
