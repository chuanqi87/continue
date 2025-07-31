import { resolveRelativePathInDir } from "../../util/ideUtils";
import { getUriPathBasename } from "../../util/uri";

import { ToolImpl } from ".";
import { getStringArg } from "../parseArgs";

export const readFileImpl: ToolImpl = async (args, extras) => {
  console.log("[hbuilderx] readFileImpl: Starting read file implementation", {
    args,
    toolCallId: extras.toolCallId,
  });

  try {
    const filepath = getStringArg(args, "filepath");
    console.log("[hbuilderx] readFileImpl: Parsed filepath", { filepath });

    const firstUriMatch = await resolveRelativePathInDir(filepath, extras.ide);
    if (!firstUriMatch) {
      console.error("[hbuilderx] readFileImpl: Could not find file", {
        filepath,
      });
      throw new Error(`Could not find file ${filepath}`);
    }

    console.log("[hbuilderx] readFileImpl: Found file URI", {
      filepath,
      uri: firstUriMatch,
    });

    const content = await extras.ide.readFile(firstUriMatch);
    console.log("[hbuilderx] readFileImpl: Successfully read file content", {
      filepath,
      contentLength: content.length,
      contentPreview: content.substring(0, 100) + "...",
    });

    // // Try to check file size limit, but don't fail if token counting fails
    // try {
    //   await throwIfFileExceedsHalfOfContext(
    //     filepath,
    //     content,
    //     extras.config.selectedModelByRole.chat,
    //   );
    //   console.log("[hbuilderx] readFileImpl: File size check passed");
    // } catch (tokenError) {
    //   console.warn(
    //     "[hbuilderx] readFileImpl: Token counting failed, skipping size check",
    //     {
    //       filepath,
    //       error:
    //         tokenError instanceof Error
    //           ? tokenError.message
    //           : String(tokenError),
    //     },
    //   );
    //   // Continue with the file read even if token counting fails
    // }

    const result = [
      {
        name: getUriPathBasename(firstUriMatch),
        description: filepath,
        content,
        uri: {
          type: "file" as const,
          value: firstUriMatch,
        },
      },
    ];

    console.log(
      "[hbuilderx] readFileImpl: Read file implementation completed successfully",
      {
        filepath,
        resultCount: result.length,
        resultDetails: result.map((r) => ({
          name: r.name,
          description: r.description,
          contentLength: r.content.length,
          uri: r.uri,
        })),
      },
    );

    return result;
  } catch (error: unknown) {
    console.error("[hbuilderx] readFileImpl: Read file implementation failed", {
      args,
      toolCallId: extras.toolCallId,
      error: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
};
