import { useAppDispatch } from "../../../../redux/hooks";
import { cancelStream } from "../../../../redux/thunks/cancelStream";
import {
  getAltKeyLabel,
  getMetaKeyLabel,
  isHBuilderX,
  isJetBrains,
} from "../../../../util";
import { Container, StopButton } from "./components";
import { GeneratingIndicator } from "./GeneratingIndicator";

export function StreamingToolbar() {
  const dispatch = useAppDispatch();

  const getKeyLabel = () => {
    if (isJetBrains()) return getAltKeyLabel();
    if (isHBuilderX()) return "Ctrl";
    return getMetaKeyLabel();
  };

  return (
    <Container>
      <GeneratingIndicator />
      <StopButton
        className="text-description"
        onClick={() => {
          void dispatch(cancelStream());
        }}
      >
        {getKeyLabel()} ⌫ Cancel
      </StopButton>
    </Container>
  );
}
