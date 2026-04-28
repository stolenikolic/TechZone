import { use } from "react";
import { SettingsContext } from "contexts/SettingContext";

export default function useSettings() {
  const context = use(SettingsContext);

  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }

  return context;
}
