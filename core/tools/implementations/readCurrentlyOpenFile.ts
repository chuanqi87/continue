import { getUriDescription } from "../../util/uri";

import { ToolImpl } from ".";

export const readCurrentlyOpenFileImpl: ToolImpl = async (args, extras) => {
  const result = await extras.ide.getCurrentFile();

  if (result) {
    // Try to check file size limit, but don't fail if token counting fails
    // try {
    //   await throwIfFileExceedsHalfOfContext(
    //     result.path,
    //     result.contents,
    //     extras.config.selectedModelByRole.chat,
    //   );
    //   console.log(
    //     "[hbuilderx] readCurrentlyOpenFileImpl: File size check passed",
    //   );
    // } catch (tokenError) {
    //   console.warn(
    //     "[hbuilderx] readCurrentlyOpenFileImpl: Token counting failed, skipping size check",
    //     {
    //       filepath: result.path,
    //       error:
    //         tokenError instanceof Error
    //           ? tokenError.message
    //           : String(tokenError),
    //     },
    //   );
    //   // Continue with the file read even if token counting fails
    // }

    const { relativePathOrBasename, last2Parts, baseName } = getUriDescription(
      result.path,
      await extras.ide.getWorkspaceDirs(),
    );

    return [
      {
        name: `Current file: ${baseName}`,
        description: last2Parts,
        content: `\`\`\`${relativePathOrBasename}\n${result.contents}\n\`\`\``,
        uri: {
          type: "file",
          value: result.path,
        },
      },
    ];
  } else {
    return [
      {
        name: `No Current File`,
        description: "",
        content: "There are no files currently open.",
      },
    ];
  }
};
