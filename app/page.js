'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';

function statusBadge(status) {
  if (status === 'setup') return { label: 'Setup', bg: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: 'rgba(245,158,11,0.25)' };
  if (status === 'league') return { label: 'Live', bg: 'rgba(34,197,94,0.12)', color: '#22c55e', border: 'rgba(34,197,94,0.25)' };
  if (status === 'playoffs') return { label: 'Playoffs', bg: 'rgba(124,92,252,0.12)', color: '#7c5cfc', border: 'rgba(124,92,252,0.25)' };
  if (status === 'completed') return { label: 'Done', bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: 'rgba(100,116,139,0.25)' };
  return { label: status, bg: 'rgba(100,116,139,0.12)', color: '#94a3b8', border: 'rgba(100,116,139,0.25)' };
}

function TournamentCard({ t }) {
  const s = statusBadge(t.status);
  const date = new Date(t.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <Link href={`/tournament/${t.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: '#161b2e',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: '16px',
        padding: '20px',
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        display: 'flex', flexDirection: 'column', gap: '14px',
      }}
        onMouseOver={e => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.4)';
          e.currentTarget.style.borderColor = 'rgba(79,122,248,0.2)';
        }}
        onMouseOut={e => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.05rem', color: '#eef2ff', marginBottom: '4px' }}>
              {t.name}
            </h3>
            <p style={{ fontSize: '0.8rem', color: '#4b5680' }}>{date}</p>
          </div>
          <span style={{
            display: 'inline-flex', alignItems: 'center', padding: '4px 10px',
            borderRadius: '100px', fontSize: '0.72rem', fontWeight: 700,
            letterSpacing: '0.05em', textTransform: 'uppercase',
            background: s.bg, color: s.color, border: `1px solid ${s.border}`,
            flexShrink: 0,
          }}>
            {s.label}
          </span>
        </div>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)' }} />

        {/* Stats */}
        <div style={{ display: 'flex', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5680', fontSize: '0.82rem' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>{t.team_count || 0} teams</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#4b5680', fontSize: '0.82rem' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <polyline points="12 6 12 12 16 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span>{t.overs_league || '?'} overs</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function HomePage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }
      setUser(user);

      const { data } = await supabase
        .from('tournaments')
        .select('*, teams(count)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      setTournaments((data || []).map(t => ({ ...t, team_count: t.teams?.[0]?.count || 0 })));
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0f1e' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(79,122,248,0.2)', borderTopColor: '#4f7af8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0c0f1e' }}>
      <Navbar />

      <main style={{ maxWidth: '900px', margin: '0 auto', padding: '40px 20px' }}>
        {/* Page Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '2rem', color: '#eef2ff' }}>
              My Tournaments
            </h1>
            <p style={{ color: '#4b5680', marginTop: '4px', fontSize: '0.9rem' }}>
              {tournaments.length} tournament{tournaments.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <Link href="/tournament/create" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '11px 20px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #4f7af8, #7c5cfc)',
            color: 'white', textDecoration: 'none', fontWeight: 700, fontSize: '0.9rem',
            boxShadow: '0 4px 14px rgba(79,122,248,0.4)',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
              <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
            New Tournament
          </Link>
        </div>

        {/* Tournament Grid */}
        {tournaments.length === 0 ? (
          <div style={{
            background: '#161b2e', border: '1px dashed rgba(255,255,255,0.1)',
            borderRadius: '20px', padding: '64px 24px', textAlign: 'center',
          }}>
            <div style={{
              width: '64px', height: '64px', margin: '0 auto 20px',
              background: 'rgba(79,122,248,0.1)', borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#4f7af8" strokeWidth="2" strokeLinecap="round"/>
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#4f7af8" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 style={{ color: '#eef2ff', fontFamily: "'Space Grotesk', sans-serif", marginBottom: '8px' }}>No tournaments yet</h3>
            <p style={{ color: '#4b5680', fontSize: '0.9rem', marginBottom: '24px' }}>Create your first cricket tournament to get started.</p>
            <Link href="/tournament/create" style={{
              display: 'inline-flex', alignItems: 'center', gap: '8px',
              padding: '12px 24px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #4f7af8, #7c5cfc)',
              color: 'white', textDecoration: 'none', fontWeight: 700,
            }}>
              Create Tournament
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {tournaments.map(t => <TournamentCard key={t.id} t={t} />)}
          </div>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
