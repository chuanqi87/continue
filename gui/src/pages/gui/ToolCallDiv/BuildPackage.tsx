import { ToolCallState } from "core";
import { UnifiedTerminalCommand } from "../../../components/UnifiedTerminal/UnifiedTerminal";

interface BuildPackageToolCallProps {
  type: string;
  projectName: string;
  toolCallState: ToolCallState;
  toolCallId: string | undefined;
}

export function BuildPackage(props: BuildPackageToolCallProps) {
  // 构建显示的命令
  const displayCommand = `打包 ${props.type === "mp-harmony" ? "元服务" : "应用"}: ${props.projectName}`;

  // For errored status, show any output (error messages)
  // Otherwise look for build output specifically
  const isErrored = props.toolCallState.status === "errored";
  const outputItem = isErrored
    ? props.toolCallState.output?.[0] // Get first output item for errors
    : props.toolCallState.output?.find((item) => item.name === "打包构建");

  const buildContent = outputItem?.content || "";
  const statusMessage = outputItem?.status || "";
  const isRunning = props.toolCallState.status === "calling";

  // Determine status type
  let statusType: "running" | "completed" | "failed" | "background" =
    "completed";
  if (isRunning) {
    statusType = "running";
  } else if (isErrored || statusMessage?.includes("失败")) {
    statusType = "failed";
  }

  return (
    <UnifiedTerminalCommand
      command={displayCommand}
      output={buildContent}
      status={statusType}
      statusMessage={statusMessage}
      toolCallState={props.toolCallState}
      toolCallId={props.toolCallId}
    />
  );
}
