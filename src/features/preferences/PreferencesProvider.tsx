import type { ReactNode } from "react";
import { PreferencesContext, usePreferencesController } from "./usePreferences";

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const value = usePreferencesController();
  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}
