import { useAppContext } from "../lib/AppContext";

export function useLanguage() {
  const { language, setLanguage } = useAppContext();
  return {
    language,
    lang: language,
    setLanguage
  };
}
