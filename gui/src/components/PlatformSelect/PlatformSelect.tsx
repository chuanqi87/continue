import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { setHarmonyPlatform } from "../../redux/slices/sessionSlice";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "../ui";

export function PlatformSelect() {
  const dispatch = useAppDispatch();
  const harmonyPlatform = useAppSelector(
    (store) => store.session.harmonyPlatform,
  );

  const selectPlatform = useCallback(
    (newPlatform: "default" | "app" | "service") => {
      if (newPlatform === harmonyPlatform) {
        return;
      }
      dispatch(setHarmonyPlatform(newPlatform));
    },
    [harmonyPlatform, dispatch],
  );

  return (
    <Listbox value={harmonyPlatform} onChange={selectPlatform}>
      <div className="relative">
        <ListboxButton
          data-testid="platform-select-button"
          className="xs:px-2 text-description bg-lightgray/20 gap-1 rounded-full border-none px-1.5 py-0.5 transition-colors duration-200 hover:brightness-110"
        >
          <span className="hidden sm:block">
            {harmonyPlatform === "default"
              ? "默认"
              : harmonyPlatform === "app"
                ? "鸿蒙应用"
                : "鸿蒙元服务"}
          </span>
          <span className="sm:hidden">
            {harmonyPlatform === "default"
              ? "默认"
              : harmonyPlatform === "app"
                ? "应用"
                : "元服务"}
          </span>
          <ChevronDownIcon
            className="h-2 w-2 flex-shrink-0"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions className="min-w-32">
          <ListboxOption value="default">
            <div className="flex flex-row items-center gap-1.5">
              <span>默认</span>
            </div>
            {harmonyPlatform === "default" && (
              <CheckIcon className="ml-auto h-3 w-3" />
            )}
          </ListboxOption>
          <ListboxOption value="app">
            <div className="flex flex-row items-center gap-1.5">
              <span>鸿蒙应用</span>
            </div>
            {harmonyPlatform === "app" && (
              <CheckIcon className="ml-auto h-3 w-3" />
            )}
          </ListboxOption>
          <ListboxOption value="service">
            <div className="flex flex-row items-center gap-1.5">
              <span>鸿蒙元服务</span>
            </div>
            {harmonyPlatform === "service" && (
              <CheckIcon className="ml-auto h-3 w-3" />
            )}
          </ListboxOption>
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
