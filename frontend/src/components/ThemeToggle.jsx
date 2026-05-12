import { useEffect, useState } from 'react';
import { getTheme, toggleTheme } from '../theme.js';
import { Icon } from './Icon.jsx';

export default function ThemeToggle({ className = '' }) {
  const [theme, setT] = useState('dark');
  useEffect(() => { setT(getTheme()); }, []);
  function onClick() {
    setT(toggleTheme());
  }
  const isDark = theme === 'dark';
  return (
    <button
      onClick={onClick}
      aria-label={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      className={`btn btn-ghost !p-2 relative overflow-hidden ${className}`}
    >
      <span key={theme} className="block animate-fade-in-scale">
        {isDark ? <Icon.Sun /> : <Icon.Moon />}
      </span>
    </button>
  );
}
