import { ToolPolicy } from "@continuedev/terminal-security";
import os from "os";
import { Tool } from "../..";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "../builtIn";

const PLATFORM_INFO = `此工具用于在 ${os.platform()} 和 ${os.arch()} 平台上打包构建 HBuilderX 项目。`;

const BUILD_PACKAGE_NOTES = `该工具会调用 HBuilderX CLI 执行打包命令。\
      确保在 HBuilderX 环境中使用此工具。\
      ${PLATFORM_INFO}`;

export const buildPackageTool: Tool = {
  type: "function",
  displayTitle: "打包构建",
  wouldLikeTo: "打包构建以下项目：",
  isCurrently: "正在打包构建项目：",
  hasAlready: "已完成打包构建项目：",
  readonly: false,
  group: BUILT_IN_GROUP_NAME,
  function: {
    name: BuiltInToolNames.BuildPackage,
    description: `打包构建 HBuilderX 项目，支持鸿蒙应用或鸿蒙元服务。\n${BUILD_PACKAGE_NOTES}`,
    parameters: {
      type: "object",
      required: ["type", "projectRoot"],
      properties: {
        type: {
          type: "string",
          enum: ["mp-harmony", "app-harmony"],
          description:
            "打包类型：mp-harmony 表示元服务，app-harmony 表示应用。此参数应根据用户当前选择的平台类型自动确定。",
        },
        projectRoot: {
          type: "string",
          description: "项目的根目录路径，通常是当前工作区的根目录。",
        },
      },
    },
  },
  defaultToolPolicy: "allowedWithPermission",
  evaluateToolCallPolicy: (
    basePolicy: ToolPolicy,
    parsedArgs: Record<string, unknown>,
  ): ToolPolicy => {
    // 打包命令总是需要用户确认
    return "allowedWithPermission";
  },
  systemMessageDescription: {
    prefix: `要打包构建 HBuilderX 项目，请使用 ${BuiltInToolNames.BuildPackage} 工具
${BUILD_PACKAGE_NOTES}
例如，要打包项目，您可以这样调用：`,
    exampleArgs: [
      ["type", "根据当前选择的平台类型填写"],
      ["projectRoot", "当前工作区根目录路径"],
    ],
  },
};
