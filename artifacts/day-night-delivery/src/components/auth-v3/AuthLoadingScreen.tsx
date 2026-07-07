import LoadingCard, { type AuthLanguage } from "./LoadingCard";
export interface AuthLoadingScreenProps { language?: AuthLanguage; percent?: number; }
export default function AuthLoadingScreen({ language = "ar", percent = 75 }: AuthLoadingScreenProps) { return <LoadingCard language={language} percent={percent} />; }
