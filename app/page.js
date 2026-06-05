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
      <div className="t-card-bg-gradient" />
      <div className="t-card-content">
        <div className="t-card-top">
          <span className={`badge ${cls}`}>{label}</span>
          <span className="t-card-date">
            {new Date(tournament.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <div className="t-card-main">
          <h3 className="t-card-name">{tournament.name}</h3>
          <div className="t-card-details">
            <div className="t-card-stat">
              <span className="t-card-stat-value">{tournament.team_count || 0}</span>
              <span className="t-card-stat-label">Teams</span>
            </div>
            <div className="t-card-stat-divider" />
            <div className="t-card-stat">
              <span className="t-card-stat-value">{tournament.overs_league}</span>
              <span className="t-card-stat-label">Overs</span>
            </div>
          </div>
        </div>
        <div className="t-card-footer">
          <span className="t-card-action">View Tournament</span>
          <svg className="t-card-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </div>
      </div>
      <style jsx>{`
        .t-card {
          position: relative;
          display: flex;
          flex-direction: column;
          background: var(--bg-card);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          text-decoration: none;
          color: inherit;
          transition: var(--transition);
          cursor: pointer;
          overflow: hidden;
          min-height: 220px;
        }
        .t-card-bg-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(61,114,245,0.05) 0%, rgba(108,79,255,0.02) 100%);
          opacity: 0;
          transition: var(--transition);
        }
        .t-card:hover {
          border-color: var(--border-primary);
          transform: translateY(-4px);
          box-shadow: var(--shadow-card), var(--shadow-glow);
        }
        .t-card:hover .t-card-bg-gradient {
          opacity: 1;
        }
        .t-card-content {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          height: 100%;
          padding: 24px;
        }
        .t-card-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }
        .t-card-date {
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: 500;
        }
        .t-card-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          margin-bottom: 24px;
        }
        .t-card-name {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 16px;
          line-height: 1.3;
          color: var(--text-primary);
        }
        .t-card-details {
          display: flex;
          align-items: center;
          gap: 16px;
          background: var(--bg-secondary);
          padding: 12px 16px;
          border-radius: var(--radius-sm);
        }
        .t-card-stat {
          display: flex;
          flex-direction: column;
        }
        .t-card-stat-value {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
          line-height: 1;
          margin-bottom: 4px;
        }
        .t-card-stat-label {
          font-size: 0.75rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          font-weight: 600;
        }
        .t-card-stat-divider {
          width: 1px;
          height: 24px;
          background: var(--border-subtle);
        }
        .t-card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-top: 1px solid var(--border-subtle);
          padding-top: 16px;
          margin-top: auto;
        }
        .t-card-action {
          font-size: 0.875rem;
          font-weight: 600;
          color: var(--accent-primary);
        }
        .t-card-arrow {
          color: var(--accent-primary);
          transition: transform 0.3s ease;
        }
        .t-card:hover .t-card-arrow {
          transform: translateX(4px);
        }
      `}</style>
    </Link>
  );
}

function CreateCard() {
  return (
    <Link href="/tournament/create" className="create-card" id="create-tournament-btn">
      <div className="create-card-content">
        <div className="create-card-icon-wrapper">
          <svg className="create-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </div>
        <div className="create-card-text">
          <h3 className="create-card-title">Add Tournament</h3>
          <p className="create-card-subtitle">Create a new cricket tournament</p>
        </div>
      </div>
      <style jsx>{`
        .create-card {
          display: flex;
          flex-direction: column;
          background: var(--gradient-primary);
          border-radius: var(--radius-lg);
          text-decoration: none;
          color: white;
          transition: var(--transition);
          cursor: pointer;
          min-height: 220px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(61, 114, 245, 0.3);
        }
        .create-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(180deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 100%);
          pointer-events: none;
        }
        .create-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 15px 40px rgba(61, 114, 245, 0.4);
        }
        .create-card-content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100%;
          padding: 32px;
          text-align: center;
          position: relative;
          z-index: 1;
        }
        .create-card-icon-wrapper {
          width: 64px;
          height: 64px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 20px;
          backdrop-filter: blur(10px);
          transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        .create-card:hover .create-card-icon-wrapper {
          transform: scale(1.1) rotate(90deg);
        }
        .create-card-icon {
          width: 32px;
          height: 32px;
          color: white;
        }
        .create-card-title {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 8px;
          letter-spacing: 0.02em;
        }
        .create-card-subtitle {
          font-size: 0.875rem;
          opacity: 0.8;
          font-weight: 500;
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
