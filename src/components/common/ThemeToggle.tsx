import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();

  return (
    <div className="flex items-center gap-2">
      <button onClick={toggle} aria-label="theme-toggle" className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 text-xs font-bold flex items-center gap-2">
        {theme === 'day' ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
        <span>{theme === 'day' ? 'Day' : 'Night'}</span>
      </button>
    </div>
  );
}
