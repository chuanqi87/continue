import { useCallback, useContext, useState } from "react";
import { IdeMessengerContext } from "../context/IdeMessenger";
import { isHBuilderX, isJetBrains } from "../util";

export default function useCopy(text: string | (() => string)) {
  const [copied, setCopied] = useState<boolean>(false);
  const ideMessenger = useContext(IdeMessengerContext);

  const copyText = useCallback(() => {
    const textVal = typeof text === "string" ? text : text();

    // JetBrains 和 HBuilderX 都使用 ideMessenger 发送消息
    if (isJetBrains() || isHBuilderX()) {
      ideMessenger.post("copyText", { text: textVal });
    } else {
      // VSCode 使用 navigator.clipboard
      navigator.clipboard.writeText(textVal);
    }

    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text, ideMessenger]);

  return { copied, copyText };
}
