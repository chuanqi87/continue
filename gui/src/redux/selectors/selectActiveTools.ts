import { createSelector } from "@reduxjs/toolkit";
import { Tool } from "core";
import { BUILT_IN_GROUP_NAME, BuiltInToolNames } from "core/tools/builtIn";
import { RootState } from "../store";

// Plan模式下允许的非只读工具白名单
const PLAN_MODE_ALLOWED_NON_READONLY_TOOLS = [BuiltInToolNames.CreateNewFile];

export const selectActiveTools = createSelector(
  [
    (store: RootState) => store.session.mode,
    (store: RootState) => store.config.config.tools,
    (store: RootState) => store.ui.toolSettings,
    (store: RootState) => store.ui.toolGroupSettings,
  ],
  (mode, tools, policies, groupPolicies): Tool[] => {
    if (mode === "chat") {
      return [];
    } else {
      const enabledTools = tools.filter(
        (tool) =>
          policies[tool.function.name] !== "disabled" &&
          groupPolicies[tool.group] !== "exclude",
      );
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
