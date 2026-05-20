import type { ReactNode } from "react";
import { usePublicLightTheme } from "@/state/ThemeContext";

/** Wraps marketing/auth routes so they render in light mode until the user chooses dark in the app. */
export function PublicLightTheme({ children }: { children: ReactNode }) {
  usePublicLightTheme();
  return <>{children}</>;
}
