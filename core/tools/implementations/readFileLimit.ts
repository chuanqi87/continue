import { ILLM } from "../..";
import { countTokensAsync } from "../../llm/countTokens";

export async function throwIfFileExceedsHalfOfContext(
  filepath: string,
  content: string,
  model: ILLM | null,
) {
  if (model) {
    try {
      console.log(
        "[hbuilderx] throwIfFileExceedsHalfOfContext: Starting token count check",
        {
          filepath,
          contentLength: content.length,
          modelTitle: model.title,
        },
      );

      const tokens = await countTokensAsync(content, model.title);
      const tokenLimit = model.contextLength / 2;

      console.log(
        "[hbuilderx] throwIfFileExceedsHalfOfContext: Token count completed",
        {
          filepath,
          tokens,
          tokenLimit,
          isExceeded: tokens > tokenLimit,
        },
      );

      if (tokens > tokenLimit) {
        throw new Error(
          `File ${filepath} is too large (${tokens} tokens vs ${tokenLimit} token limit). Try another approach`,
        );
      }
    } catch (tokenError) {
      // Log the error but don't fail the tool execution
      console.warn(
        "[hbuilderx] throwIfFileExceedsHalfOfContext: Token counting failed, skipping file size check",
        {
          filepath,
          contentLength: content.length,
          modelTitle: model.title,
          error:
            tokenError instanceof Error
              ? tokenError.message
              : String(tokenError),
          errorStack:
            tokenError instanceof Error ? tokenError.stack : undefined,
        },
      );
      // Continue with the file read even if token counting fails
      // This prevents the entire tool execution from failing due to token counting issues
    }
  }
}
