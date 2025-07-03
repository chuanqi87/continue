import { Editor } from "@tiptap/react";
import { KeyboardEvent } from "react";
import {
  isHBuilderX,
  isJetBrains,
  isMetaEquivalentKeyPressed,
} from "../../../../util";
import {
  handleHBuilderXKeyIssues,
  handleJetBrainsOSRMetaKeyIssues,
  handleVSCMetaKeyIssues,
} from "../../util/handleMetaKeyIssues";

export function useEditorEventHandlers(options: {
  editor: Editor | null;
  isOSREnabled: boolean;
  editorFocusedRef: React.MutableRefObject<boolean | undefined>;
  setActiveKey: (key: string | null) => void;
}) {
  const { editor, isOSREnabled, editorFocusedRef, setActiveKey } = options;

  /**
   * This handles various issues with meta key actions
   * - In JetBrains, when using OSR in JCEF, there is a bug where using the meta key to
   *   highlight code using arrow keys is not working
   * - In VS Code, while working with .ipynb files there is a problem where copy/paste/cut will affect
   *   the actual notebook cells, even when performing them in our GUI
   * - In HBuilderX, we need to handle ctrl key combinations for proper functioning
   *
   *  Currently keydown events for a number of keys are not registering if the
   *  meta/shift key is pressed, for example "x", "c", "v", "z", etc.
   *  Until this is resolved we can't turn on OSR for non-Mac users due to issues
   *  with those key actions.
   */
  const handleKeyDown = async (e: KeyboardEvent<HTMLDivElement>) => {
    if (!editor) {
      return;
    }

    setActiveKey(e.key);

    if (!editorFocusedRef?.current || !isMetaEquivalentKeyPressed(e)) return;

    if (isOSREnabled) {
      handleJetBrainsOSRMetaKeyIssues(e, editor);
    } else if (isHBuilderX()) {
      // HBuilderX特定的按键处理
      await handleHBuilderXKeyIssues(e, editor);
    } else if (!isJetBrains()) {
      await handleVSCMetaKeyIssues(e, editor);
    }
  };

  const handleKeyUp = () => setActiveKey(null);

  return { handleKeyDown, handleKeyUp };
}
