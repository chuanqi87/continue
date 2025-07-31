import { createAsyncThunk } from "@reduxjs/toolkit";
import posthog from "posthog-js";
import StreamErrorDialog from "../../pages/gui/StreamError";
import { analyzeError } from "../../util/errorAnalysis";
import { selectSelectedChatModel } from "../slices/configSlice";
import { setDialogMessage, setShowDialog } from "../slices/uiSlice";
import { ThunkApiType } from "../store";
import { cancelStream } from "./cancelStream";
import { saveCurrentSession } from "./session";

export const streamThunkWrapper = createAsyncThunk<
  void,
  () => Promise<void>,
  ThunkApiType
>("chat/streamWrapper", async (runStream, { dispatch, extra, getState }) => {
  const initialState = getState();
  console.log("[hbuilderx] streamThunkWrapper: Starting stream wrapper");

  try {
    await runStream();
    const state = getState();
    if (!state.session.isInEdit) {
      console.log("[hbuilderx] streamThunkWrapper: Saving current session");
      await dispatch(
        saveCurrentSession({
          openNewSession: false,
          generateTitle: true,
        }),
      );
    }
    console.log(
      "[hbuilderx] streamThunkWrapper: Stream completed successfully",
    );
  } catch (e: unknown) {
    console.error("[hbuilderx] streamThunkWrapper: Stream failed with error", {
      error: e instanceof Error ? e.message : String(e),
      stack: e instanceof Error ? e.stack : undefined,
    });

    await dispatch(cancelStream());
    dispatch(setDialogMessage(<StreamErrorDialog error={e} />));
    dispatch(setShowDialog(true));

    // Get the selected model from the state for error analysis
    const state = getState();
    const selectedModel = selectSelectedChatModel(state);

    const { parsedError, statusCode, modelTitle, providerName } = analyzeError(
      e,
      selectedModel,
    );

    console.log("[hbuilderx] streamThunkWrapper: Error analysis completed", {
      parsedError,
      statusCode,
      modelTitle,
      providerName,
    });

    const errorData = {
      error_type: statusCode ? `HTTP ${statusCode}` : "Unknown",
      error_message: parsedError,
      model_provider: providerName,
      model_title: modelTitle,
    };

    posthog.capture("gui_stream_error", errorData);
  }
});
