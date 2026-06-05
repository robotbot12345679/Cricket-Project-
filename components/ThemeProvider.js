import { useEffect } from 'react';

export default function ThemeProvider({ children }) {
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved ? saved : prefersDark ? 'dark' : 'light';
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(theme);
  }, []);

  return <>{children}</>;
}
