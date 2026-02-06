import {
  getAltKeyLabel,
  getMetaKeyLabel,
  isHBuilderX,
  isJetBrains,
} from "../../../../util";
import { GeneratingIndicator } from "./GeneratingIndicator";

interface StreamingToolbarProps {
  onStop: () => void;
  displayText?: string;
}

export function StreamingToolbar({
  onStop,
  displayText = "Stop",
}: StreamingToolbarProps) {
  const getKeyLabel = () => {
    if (isJetBrains()) return getAltKeyLabel();
    if (isHBuilderX()) return "Ctrl";
    return getMetaKeyLabel();
  };

  return (
    <div className="flex w-full items-center justify-between">
      <GeneratingIndicator />
      <div
        onClick={onStop}
        className="text-2xs cursor-pointer px-1.5 py-0.5 hover:brightness-125"
      >
        <span className="text-description">{displayText}</span>
        {/* JetBrains overrides cmd+backspace, so we have to use another shortcut */}
        <span className="text-description-muted ml-1 opacity-75">
          {getKeyLabel()}⌫
        </span>
      </div>
    </div>
  );
}
