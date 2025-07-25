import React, { createContext, useContext, useEffect, useState } from "react";
import { getLocalStorage } from "../util/localStorage";

interface LocalStorageType {
  fontSize: number;
}

const DEFAULT_LOCAL_STORAGE: LocalStorageType = {
  fontSize: 14,
};

const LocalStorageContext = createContext<LocalStorageType>(
  DEFAULT_LOCAL_STORAGE,
);

export const LocalStorageProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [values, setValues] = useState<LocalStorageType>(DEFAULT_LOCAL_STORAGE);

  // TODO setvalue
  useEffect(() => {
    const ide = getLocalStorage("ide");
    let fontSize: number;

    switch (ide) {
      case "jetbrains":
        fontSize = getLocalStorage("fontSize") ?? 15;
        break;
      case "hbuilderx":
        fontSize = getLocalStorage("fontSize") ?? 15; // HBuilderX默认字体大小
        break;
      default: // vscode
        fontSize = getLocalStorage("fontSize") ?? 14;
        break;
    }

    setValues({ fontSize });
  }, []);

  return (
    <LocalStorageContext.Provider value={values}>
      {children}
    </LocalStorageContext.Provider>
  );
};

export const useLocalStorage = () => {
  const context = useContext(LocalStorageContext);
  return context;
};
