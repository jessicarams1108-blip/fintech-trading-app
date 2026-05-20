import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggle: () => void;
  setTheme: (next: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "theme";
const THEME_USER_SELECTED_KEY = "theme-user-selected";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  if (localStorage.getItem(THEME_USER_SELECTED_KEY) !== "1") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light";
}

function markThemeChosen() {
  localStorage.setItem(THEME_USER_SELECTED_KEY, "1");
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (localStorage.getItem(THEME_USER_SELECTED_KEY) === "1") {
      localStorage.setItem(THEME_KEY, theme);
    }
  }, [theme]);

  const toggle = useCallback(() => {
    markThemeChosen();
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const setThemeExplicit = useCallback((next: Theme) => {
    markThemeChosen();
    setTheme(next);
  }, []);

  const value = useMemo(
    () => ({ theme, toggle, setTheme: setThemeExplicit }),
    [theme, toggle, setThemeExplicit],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Marketing / auth pages stay light until the user picks dark in the app. */
export function usePublicLightTheme() {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    return () => {
      if (theme === "dark" && localStorage.getItem(THEME_USER_SELECTED_KEY) === "1") {
        document.documentElement.classList.add("dark");
      }
    };
  }, [theme]);
}
