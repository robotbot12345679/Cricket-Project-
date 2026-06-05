'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const router = useRouter();

  async function handleLogout() {
    await supabase.auth.signOut();
    document.cookie = 'sb-auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="navbar">
      <Link href="/" className="navbar-brand">
        <div className="navbar-brand-icon">🏏</div>
        <span className="navbar-brand-name">CricManager</span>
      </Link>
      <div className="navbar-actions">
          <Link href="/record" className="btn btn-secondary btn-sm" id="nav-record">
            🔴 Record Match
          </Link>
          <Link href="/signup" className="btn btn-primary btn-sm" id="nav-signup">
            Sign Up
          </Link>
          <button
            id="nav-logout"
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
          >
            Sign Out
          </button>
          <button
            id="theme-toggle"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              const root = document.documentElement;
              if (root.classList.contains('light')) {
                root.classList.remove('light');
                root.classList.add('dark');
                localStorage.setItem('theme', 'dark');
              } else {
                root.classList.remove('dark');
                root.classList.add('light');
                localStorage.setItem('theme', 'light');
              }
            }}
          >
            {document.documentElement.classList.contains('light') ? '🌙' : '☀️'}
          </button>
        </div>
    </nav>
  );
}
