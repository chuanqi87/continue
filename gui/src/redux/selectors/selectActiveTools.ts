import { createSelector } from "@reduxjs/toolkit";
import { Tool } from "core";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "core/tools/builtIn";
import { DEFAULT_TOOL_SETTING } from "../slices/uiSlice";
import { RootState } from "../store";

// [HBuilderX] Plan模式下允许的非只读工具白名单
const PLAN_MODE_ALLOWED_NON_READONLY_TOOLS = [BuiltInToolNames.CreateNewFile];

export const selectActiveTools = createSelector(
  [
    (store: RootState) => store.session.mode,
    (store: RootState) => store.config.config.tools,
    (store: RootState) => store.ui.toolSettings,
    (store: RootState) => store.ui.toolGroupSettings,
    (store: RootState) => store.session.harmonyPlatform,
  ],
  (mode, tools, policies, groupPolicies, harmonyPlatform): Tool[] => {
    if (mode === "chat") {
      return [];
    } else {
      const enabledTools = tools.filter((tool) => {
        const toolPolicy =
          policies[tool.function.name] ??
          tool.defaultToolPolicy ??
          DEFAULT_TOOL_SETTING;

        // [HBuilderX] build_package 工具只在选择了应用或元服务平台时才启用
        if (
          tool.function.name === BuiltInToolNames.BuildPackage &&
          harmonyPlatform === "default"
        ) {
          return false;
        }

        return (
          toolPolicy !== "disabled" && groupPolicies[tool.group] !== "exclude"
        );
      });
      if (mode === "plan") {
        return enabledTools.filter(
          (t) =>
            t.group !== BUILT_IN_GROUP_NAME ||
            t.readonly ||
            PLAN_MODE_ALLOWED_NON_READONLY_TOOLS.includes(
              t.function.name as BuiltInToolNames,
            ),
        );
      }
      return enabledTools;
    }
  },
);
