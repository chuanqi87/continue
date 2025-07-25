import { ChatHistoryItem } from "core";
import { useEffect, useState } from "react";
import { useAppSelector } from "../../redux/hooks";
import { selectSelectedChatModel } from "../../redux/slices/configSlice";

interface ThinkingIndicatorProps {
  historyItem: ChatHistoryItem;
}
/*
    Thinking animation
    Only for reasoning (long load time) models for now
*/
const ThinkingIndicator = ({ historyItem }: ThinkingIndicatorProps) => {
  // Animation for thinking ellipses
  const [animation, setAnimation] = useState(2);
  useEffect(() => {
    const interval = setInterval(() => {
      setAnimation((prevState) => (prevState === 2 ? 0 : prevState + 1));
    }, 600);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const selectedModel = useAppSelector(selectSelectedChatModel);
  const isStreaming = useAppSelector((state) => state.session.isStreaming);

  const hasContent = Array.isArray(historyItem.message.content)
    ? !!historyItem.message.content.length
    : !!historyItem.message.content;

  // Check if model supports reasoning/thinking
  const isReasoningModel =
    selectedModel?.model.startsWith("o1") ||
    selectedModel?.model.startsWith("deepseek-reasoner");

  const isThinking =
    isStreaming && !historyItem.isGatheringContext && !hasContent;
  if (!isThinking || !isReasoningModel) {
    return null;
  }

  return (
    <div className="px-2 py-2">
      <span className="text-lightgray">{`Thinking.${".".repeat(animation)}`}</span>
    </div>
  );
};

export default ThinkingIndicator;
