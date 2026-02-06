import {
  CheckIcon,
  ChevronDownIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";
import { useCallback, useContext, useMemo } from "react";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setSelectedWorkspacePath } from "../../redux/slices/sessionSlice";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";

// 获取路径的最后一部分作为显示名称
function getDisplayName(path: string): string {
  if (!path) return "";
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function WorkspaceSelect() {
  const dispatch = useAppDispatch();
  const ideMessenger = useContext(IdeMessengerContext);
  const workspacePaths = useAppSelector(
    (store) => store.session.workspacePaths,
  );
  const selectedWorkspacePath = useAppSelector(
    (store) => store.session.selectedWorkspacePath,
  );

  const selectWorkspace = useCallback(
    (newPath: string) => {
      if (newPath === selectedWorkspacePath) {
        return;
      }
      dispatch(setSelectedWorkspacePath(newPath));
      // 通知IDE端切换了选中的工作区
      console.log("[hbuilderx] Switching workspace to:", newPath);
      ideMessenger.post("setSelectedWorkspace", { workspacePath: newPath });
    },
    [selectedWorkspacePath, dispatch, ideMessenger],
  );

  const displayName = useMemo(() => {
    return getDisplayName(selectedWorkspacePath);
  }, [selectedWorkspacePath]);

  // 如果只有一个项目或没有项目，不显示选择器
  if (workspacePaths.length <= 1) {
    return null;
  }

  return (
    <Listbox value={selectedWorkspacePath} onChange={selectWorkspace}>
      <div className="relative">
        <ListboxButton
          data-testid="workspace-select-button"
          className="xs:px-2 text-description bg-lightgray/20 gap-1 rounded-full border-none px-1.5 py-0.5 transition-colors duration-200 hover:brightness-110"
        >
          <FolderIcon
            className="h-2.5 w-2.5 flex-shrink-0"
            aria-hidden="true"
          />
          <span className="hidden max-w-24 truncate sm:block">
            {displayName}
          </span>
          <span className="max-w-16 truncate sm:hidden">{displayName}</span>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions className="min-w-40 max-w-64">
          {workspacePaths.map((path) => (
            <ListboxOption key={path} value={path}>
              <div className="flex flex-row items-center gap-1.5">
                <FolderIcon className="h-3 w-3 flex-shrink-0" />
                <span className="truncate" title={path}>
                  {getDisplayName(path)}
                </span>
              </div>
              {selectedWorkspacePath === path && (
                <CheckIcon className="ml-auto h-3 w-3 flex-shrink-0" />
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
