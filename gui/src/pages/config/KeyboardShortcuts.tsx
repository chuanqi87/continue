import { useMemo } from "react";
import Shortcut from "../../components/gui/Shortcut";
import { isHBuilderX, isJetBrains } from "../../util";

interface KeyboardShortcutProps {
  shortcut: string;
  description: string;
  isEven: boolean;
}

function KeyboardShortcut(props: KeyboardShortcutProps) {
  return (
    <div
      className={`flex flex-col items-start p-2 sm:flex-row sm:items-center ${props.isEven ? "" : "bg-table-oddRow"}`}
    >
      <div className="w-full flex-grow pb-1 pr-4 sm:w-auto sm:pb-0">
        <span className="block break-words text-xs">{props.description}:</span>
      </div>
      <div className="flex-shrink-0 whitespace-nowrap">
        <Shortcut>{props.shortcut}</Shortcut>
      </div>
    </div>
  );
}

// Shortcut strings will be rendered correctly based on the platform by the Shortcut component
const vscodeShortcuts: Omit<KeyboardShortcutProps, "isEven">[] = [
  {
    shortcut: "cmd '",
    description: "Toggle Selected Model",
  },
  {
    shortcut: "cmd I",
    description: "Edit highlighted code",
  },
  {
    shortcut: "cmd L",
    description:
      "New Chat / New Chat With Selected Code / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd backspace",
    description: "Cancel response",
  },
  {
    shortcut: "cmd shift I",
    description: "Toggle inline edit focus",
  },
  {
    shortcut: "cmd shift L",
    description:
      "Focus Current Chat / Add Selected Code To Current Chat / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd shift R",
    description: "Debug Terminal",
  },
  {
    shortcut: "cmd shift backspace",
    description: "Reject Diff",
  },
  {
    shortcut: "cmd shift enter",
    description: "Accept Diff",
  },
  {
    shortcut: "alt cmd N",
    description: "Reject Top Change in Diff",
  },
  {
    shortcut: "alt cmd Y",
    description: "Accept Top Change in Diff",
  },
  {
    shortcut: "cmd K cmd A",
    description: "Toggle Autocomplete Enabled",
  },
  {
    shortcut: "cmd alt space",
    description: "Force an Autocomplete Trigger",
  },
  {
    shortcut: "cmd K cmd M",
    description: "Toggle Full Screen",
  },
];

const jetbrainsShortcuts: Omit<KeyboardShortcutProps, "isEven">[] = [
  {
    shortcut: "cmd '",
    description: "Toggle Selected Model",
  },
  {
    shortcut: "cmd I",
    description: "Edit highlighted code",
  },
  {
    shortcut: "cmd J",
    description:
      "New Chat / New Chat With Selected Code / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd backspace",
    description: "Cancel response",
  },
  {
    shortcut: "cmd shift I",
    description: "Toggle inline edit focus",
  },
  {
    shortcut: "cmd shift J",
    description:
      "Focus Current Chat / Add Selected Code To Current Chat / Close Continue Sidebar If Chat Already In Focus",
  },
  {
    shortcut: "cmd shift backspace",
    description: "Reject Diff",
  },
  {
    shortcut: "cmd shift enter",
    description: "Accept Diff",
  },
  {
    shortcut: "alt shift J",
    description: "Quick Input",
  },
  {
    shortcut: "alt cmd J",
    description: "Toggle Sidebar",
  },
];

const hbuilderxShortcuts: Omit<KeyboardShortcutProps, "isEven">[] = [
  {
    shortcut: "ctrl '",
    description: "切换选中模型",
  },
  {
    shortcut: "ctrl I",
    description: "编辑高亮代码",
  },
  {
    shortcut: "ctrl L",
    description: "新建聊天 / 新建聊天并带选中代码 / 关闭Continue侧边栏",
  },
  {
    shortcut: "ctrl backspace",
    description: "取消响应",
  },
  {
    shortcut: "ctrl shift I",
    description: "切换行内编辑焦点",
  },
  {
    shortcut: "ctrl shift L",
    description: "聚焦当前聊天 / 添加选中代码到当前聊天 / 关闭Continue侧边栏",
  },
  {
    shortcut: "ctrl shift R",
    description: "调试终端",
  },
  {
    shortcut: "ctrl shift backspace",
    description: "拒绝差异",
  },
  {
    shortcut: "ctrl shift enter",
    description: "接受差异",
  },
  {
    shortcut: "alt ctrl N",
    description: "拒绝差异中的顶部变更",
  },
  {
    shortcut: "alt ctrl Y",
    description: "接受差异中的顶部变更",
  },
  {
    shortcut: "ctrl K ctrl A",
    description: "切换自动补全启用状态",
  },
  {
    shortcut: "ctrl K ctrl M",
    description: "切换全屏模式",
  },
];

function KeyboardShortcuts() {
  const shortcuts = useMemo(() => {
    if (isJetBrains()) return jetbrainsShortcuts;
    if (isHBuilderX()) return hbuilderxShortcuts;
    return vscodeShortcuts;
  }, []);

  return (
    <div className="h-full overflow-auto">
      <h3 className="mb-3 text-xl">Keyboard shortcuts</h3>
      <div>
        {shortcuts.map((shortcut, i) => {
          return (
            <KeyboardShortcut
              key={i}
              shortcut={shortcut.shortcut}
              description={shortcut.description}
              isEven={i % 2 === 0}
            />
          );
        })}
      </div>
    </div>
  );
}

export default KeyboardShortcuts;
