import { useAppContext } from "../lib/AppContext";

export function useTheme() {
  const ctx = useAppContext() as any;
  return {
    theme: ctx.theme ?? "dark",
    setTheme: ctx.setTheme ?? (() => {}),
    toggleTheme: ctx.toggleTheme ?? (() => {})
  };
}
