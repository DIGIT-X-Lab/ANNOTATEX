import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "annotatex.theme";

const persistTheme = (value: "light" | "dark") => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, value);
  } catch (error) {
    console.warn("Unable to persist theme", error);
  }
};

const readStoredTheme = (): "light" | "dark" | null => {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      return stored;
    }
  } catch (error) {
    console.warn("Unable to read stored theme", error);
  }
  return null;
};

export const useTheme = () => {
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const root = window.document.documentElement;
    const stored = readStoredTheme();
    const initialTheme = stored ?? (root.classList.contains("dark") ? "dark" : "light");
    root.classList.remove("light", "dark");
    root.classList.add(initialTheme);
    setTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const root = window.document.documentElement;
    const newTheme = theme === "light" ? "dark" : "light";

    root.classList.remove("light", "dark");
    root.classList.add(newTheme);
    setTheme(newTheme);
    persistTheme(newTheme);
  };

  return { theme, toggleTheme };
};
