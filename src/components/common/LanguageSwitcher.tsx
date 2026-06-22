import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();

  return (
    <div className="flex items-center gap-2">
      <button aria-label="language-switcher" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-xs font-bold flex items-center gap-2">
        <Globe className="w-4 h-4" />
        <span>{lang === 'ar' ? 'العربية' : 'English'}</span>
      </button>
    </div>
  );
}
