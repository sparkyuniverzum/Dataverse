import { createContext, createElement, useContext } from "react";

const StageZeroSetupPanelContext = createContext(null);

export function StageZeroSetupPanelProvider({ value, children }) {
  return createElement(StageZeroSetupPanelContext.Provider, { value }, children);
}

export function useStageZeroSetupPanelContext() {
  const value = useContext(StageZeroSetupPanelContext);
  if (!value) {
    throw new Error("StageZeroSetupPanelContext is missing.");
  }
  return value;
}
