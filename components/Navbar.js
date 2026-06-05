'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    document.cookie = 'sb-auth-token=; path=/; max-age=0';
    router.push('/login');
    router.refresh();
  }

  return (
    <nav style={{
      height: '62px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 24px',
      background: 'rgba(12, 15, 30, 0.92)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      {/* Brand */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
        <div style={{
          width: '34px', height: '34px',
          background: 'linear-gradient(135deg, #4f7af8, #7c5cfc)',
          borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.05rem', color: '#eef2ff' }}>
          CricManager
        </span>
      </Link>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {user ? (
          <>
            <Link href="/tournament/create" style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '8px 16px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #4f7af8, #7c5cfc)',
              color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem',
              boxShadow: '0 4px 12px rgba(79,122,248,0.35)',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
              New Tournament
            </Link>
            <button onClick={handleLogout} style={{
              display: 'inline-flex', alignItems: 'center', gap: '7px',
              padding: '8px 14px', borderRadius: '10px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              color: '#94a3b8', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem',
              fontFamily: "'Inter', sans-serif",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sign Out
            </button>
          </>
        ) : (
          <Link href="/login" style={{
            padding: '8px 16px', borderRadius: '10px',
            background: 'linear-gradient(135deg, #4f7af8, #7c5cfc)',
            color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem',
          }}>
            Sign In
          </Link>
        )}
      </div>
    </nav>
  );
}
