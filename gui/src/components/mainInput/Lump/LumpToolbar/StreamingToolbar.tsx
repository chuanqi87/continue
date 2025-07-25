import { useAppDispatch } from "../../../../redux/hooks";
import { cancelStream } from "../../../../redux/thunks/cancelStream";
import {
  getAltKeyLabel,
  getMetaKeyLabel,
  isHBuilderX,
  isJetBrains,
} from "../../../../util";
import { GeneratingIndicator } from "./GeneratingIndicator";

export function StreamingToolbar() {
  const dispatch = useAppDispatch();

  const getKeyLabel = () => {
    if (isJetBrains()) return getAltKeyLabel();
    if (isHBuilderX()) return "Ctrl";
    return getMetaKeyLabel();
  };

  return (
    <div className="flex w-full items-center justify-between">
      <GeneratingIndicator />
      <div
        onClick={() => void dispatch(cancelStream())}
        className="text-2xs cursor-pointer px-1.5 py-0.5 hover:brightness-125"
      >
        <span className="text-description">Stop</span>
        {/* JetBrains overrides cmd+backspace, so we have to use another shortcut */}
        <span className="text-description-muted ml-1 opacity-75">
          {getKeyLabel()}⌫
        </span>
      </div>
    </div>
  );
}
