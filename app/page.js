'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';

function statusLabel(status) {
  if (status === 'setup') return { label: 'Setup', cls: 'badge-yellow' };
  if (status === 'league') return { label: 'League Stage', cls: 'badge-blue' };
  if (status === 'playoffs') return { label: 'Playoffs', cls: 'badge-purple' };
  if (status === 'completed') return { label: 'Completed', cls: 'badge-green' };
  return { label: status, cls: 'badge-gray' };
}

function TournamentCard({ tournament }) {
  const { label, cls } = statusLabel(tournament.status);
  return (
    <Link href={`/tournament/${tournament.id}`} className="t-card" id={`tournament-${tournament.id}`}>
      <div className="t-card-top">
        <span className={`badge ${cls}`}>{label}</span>
      </div>
      <div className="t-card-emoji">🏆</div>
      <h3 className="t-card-name">{tournament.name}</h3>
      <div className="t-card-meta">
        <span>{tournament.team_count || 0} Teams</span>
        <span className="t-card-dot">·</span>
        <span>{tournament.overs_league} ov</span>
      </div>
      <div className="t-card-footer">
        <span className="t-card-date">
          {new Date(tournament.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
        <span className="t-card-arrow">→</span>
      </div>
      <style jsx>{`
        .t-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 24px;
          text-decoration: none;
          color: inherit;
          transition: var(--transition);
          cursor: pointer;
          position: relative;
          overflow: hidden;
        }
        .t-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: var(--gradient-card);
          opacity: 0;
          transition: var(--transition);
        }
        .t-card:hover {
          border-color: var(--border-primary);
          transform: translateY(-3px);
          box-shadow: var(--shadow-card), var(--shadow-glow);
        }
        .t-card:hover::before { opacity: 1; }
        .t-card-top { display: flex; justify-content: space-between; align-items: center; }
        .t-card-emoji { font-size: 2.5rem; }
        .t-card-name { font-size: 1.1rem; font-weight: 700; }
        .t-card-meta { display: flex; gap: 8px; align-items: center; color: var(--text-muted); font-size: 0.85rem; }
        .t-card-dot { opacity: 0.4; }
        .t-card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
        .t-card-date { font-size: 0.75rem; color: var(--text-muted); }
        .t-card-arrow { color: var(--accent-primary); font-size: 1.1rem; transition: var(--transition); }
        .t-card:hover .t-card-arrow { transform: translateX(4px); }
      `}</style>
    </Link>
  );
}

function CreateCard() {
  return (
    <Link href="/tournament/create" className="create-card" id="create-tournament-btn">
      <div className="create-card-icon">+</div>
      <span className="create-card-label">New Tournament</span>
      <style jsx>{`
        .create-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 16px;
          background: rgba(61,114,245,0.06);
          border: 2px dashed rgba(61,114,245,0.3);
          border-radius: var(--radius-lg);
          padding: 40px 24px;
          text-decoration: none;
          color: var(--accent-primary);
          transition: var(--transition);
          cursor: pointer;
          min-height: 200px;
          animation: pulse-glow 3s ease-in-out infinite;
        }
        .create-card:hover {
          background: rgba(61,114,245,0.12);
          border-color: var(--accent-primary);
          transform: translateY(-3px);
        }
        .create-card-icon {
          width: 56px;
          height: 56px;
          background: var(--gradient-primary);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2rem;
          color: white;
          font-weight: 300;
          box-shadow: 0 8px 24px rgba(61,114,245,0.35);
        }
        .create-card-label {
          font-weight: 700;
          font-size: 1rem;
          font-family: 'Space Grotesk', sans-serif;
        }
      `}</style>
    </Link>
  );
}

export default function HomePage() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('tournaments')
        .select('*, teams(count)')
        .eq('created_by', user.id)
        .order('created_at', { ascending: false });

      const withCount = (data || []).map(t => ({
        ...t,
        team_count: t.teams?.[0]?.count || 0,
      }));
      setTournaments(withCount);
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="page-wrapper">
      <Navbar />
      <main className="home-main container" style={{ position: 'relative', zIndex: 1 }}>
        <header className="home-header animate-fade-in">
          <div>
            <h1 className="home-title">My Tournaments</h1>
            <p className="home-subtitle">Create, manage and score your cricket tournaments</p>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center" style={{ minHeight: 300 }}>
            <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
          </div>
        ) : (
          <div className="tournaments-grid animate-fade-in">
            <CreateCard />
            {tournaments.map(t => <TournamentCard key={t.id} tournament={t} />)}
          </div>
        )}

        {!loading && tournaments.length === 0 && (
          <p className="home-empty-hint">No tournaments yet — create your first one above!</p>
        )}
      </main>

      <style jsx>{`
        .home-main { padding: 40px 0 80px; }
        .home-header { margin-bottom: 40px; }
        .home-title {
          font-size: 2.25rem;
          background: linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .home-subtitle { color: var(--text-muted); margin-top: 6px; font-size: 1rem; }
        .tournaments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 20px;
        }
        .home-empty-hint {
          text-align: center;
          color: var(--text-muted);
          font-size: 0.9rem;
          margin-top: -20px;
        }
      `}</style>
    </div>
  );
}
