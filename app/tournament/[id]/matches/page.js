'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function MatchesListPage() {
  const { id } = useParams();
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) return;

      const { data: tData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();
      setTournament(tData);

      const { data: tList } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', id);

      const tMap = {};
      (tList || []).forEach(t => {
        tMap[t.id] = t;
      });
      setTeams(tMap);

      const { data: mList } = await supabase
        .from('matches')
        .select('*, innings(*)')
        .eq('tournament_id', id)
        .order('match_number', { ascending: false }); // Latest matches first or schedule order? Standard order is descending (newest/finals at top)

      setMatches(mList || []);
      setLoading(false);
    }
    loadData();
  }, [id]);

  if (loading) {
    return (
      <div className="page-wrapper flex items-center justify-center">
        <div className="spinner" style={{ width: 45, height: 45 }} />
      </div>
    );
  }

  // Format team score
  const getTeamScoreText = (match, teamId) => {
    if (match.status === 'scheduled') return '-';
    const inn = match.innings?.find(i => i.batting_team_id === teamId && !i.is_super_over);
    if (!inn) return 'DNB';
    return `${inn.total_runs}/${inn.total_wickets}`;
  };

  const getTeamOversText = (match, teamId) => {
    if (match.status === 'scheduled') return '';
    const inn = match.innings?.find(i => i.batting_team_id === teamId && !i.is_super_over);
    if (!inn) return '';
    return `(${inn.overs_completed} ov)`;
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="container" style={{ padding: '32px 16px', position: 'relative', zIndex: 1, maxWidth: '800px' }}>
        <header style={{ marginBottom: '32px' }}>
          <Link href={`/tournament/${id}`} style={{ textDecoration: 'none', color: 'var(--accent-primary)', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            ← Back to Points Table
          </Link>
          <h1 style={{ fontSize: '2rem', marginTop: '12px' }}>Matches Schedule</h1>
          <p className="text-secondary">{tournament.name}</p>
        </header>

        {/* Timeline Matches list */}
        <div className="matches-timeline">
          {matches.map((match) => {
            const team1 = teams[match.team1_id];
            const team2 = teams[match.team2_id];

            return (
              <div key={match.id} className="timeline-item" id={`match-card-${match.id}`}>
                {/* Timeline connector visual line on left */}
                <div className="timeline-marker">
                  <div className={`timeline-circle ${match.status === 'completed' ? 'completed' : match.status === 'live' ? 'live' : ''}`} />
                  <div className="timeline-line" />
                </div>

                <div className="timeline-content">
                  <Link href={`/tournament/${id}/match/${match.id}`} className="match-card-wrapper" style={{ textDecoration: 'none', color: 'inherit' }}>
                    <div className="match-stage-info">
                      <span className="badge badge-gray">{match.stage === 'league' ? `Match ${match.match_number}` : match.stage}</span>
                      {match.status === 'live' && <span className="badge badge-red animate-pulse-glow">🔴 Live</span>}
                      {match.status === 'completed' && <span className="badge badge-green">Completed</span>}
                    </div>

                    <div className="match-team-row">
                      {/* Team 1 info */}
                      <div className="team-display">
                        <span className="team-emoji">{team1?.emoji || '❔'}</span>
                        <span className="team-name" style={{ color: team1?.color }}>{team1?.name || 'TBD'}</span>
                      </div>
                      <div className="score-display">
                        <span className="score-runs">{getTeamScoreText(match, match.team1_id)}</span>
                        <span className="score-overs">{getTeamOversText(match, match.team1_id)}</span>
                      </div>
                    </div>

                    <div className="vs-divider">vs</div>

                    <div className="match-team-row">
                      {/* Team 2 info */}
                      <div className="team-display">
                        <span className="team-emoji">{team2?.emoji || '❔'}</span>
                        <span className="team-name" style={{ color: team2?.color }}>{team2?.name || 'TBD'}</span>
                      </div>
                      <div className="score-display">
                        <span className="score-runs">{getTeamScoreText(match, match.team2_id)}</span>
                        <span className="score-overs">{getTeamOversText(match, match.team2_id)}</span>
                      </div>
                    </div>

                    {match.status === 'completed' && match.result_description && (
                      <div className="match-result-banner">
                        {match.result_description}
                      </div>
                    )}
                  </Link>
                </div>
              </div>
            );
          })}

          {matches.length === 0 && (
            <div className="empty-state">
              <span className="empty-state-icon">📅</span>
              <p className="empty-state-title">No matches scheduled yet.</p>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .matches-timeline {
          display: flex;
          flex-direction: column;
          position: relative;
          padding-left: 20px;
        }
        .timeline-item {
          display: flex;
          position: relative;
          margin-bottom: 24px;
        }
        .timeline-marker {
          position: absolute;
          left: -20px;
          top: 0;
          bottom: 0;
          width: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .timeline-circle {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: var(--bg-input);
          border: 2px solid var(--border-subtle);
          margin-top: 24px;
          z-index: 2;
        }
        .timeline-circle.completed {
          background: var(--accent-green);
          border-color: var(--accent-green);
        }
        .timeline-circle.live {
          background: var(--accent-red);
          border-color: var(--accent-red);
        }
        .timeline-line {
          width: 2px;
          flex: 1;
          background: var(--border-subtle);
        }
        .timeline-item:last-child .timeline-line {
          display: none;
        }
        .timeline-content {
          flex: 1;
          padding-left: 24px;
        }
        .match-card-wrapper {
          display: block;
          background: var(--bg-secondary);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          padding: 20px;
          transition: var(--transition);
        }
        .match-card-wrapper:hover {
          border-color: var(--border-primary);
          background: var(--bg-card-hover);
        }
        .match-stage-info {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .match-team-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 6px 0;
        }
        .team-display {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .team-emoji {
          font-size: 1.25rem;
        }
        .team-name {
          font-weight: 600;
        }
        .score-display {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .score-runs {
          font-weight: 800;
          font-size: 1.1rem;
        }
        .score-overs {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .vs-divider {
          text-align: center;
          font-size: 0.75rem;
          color: var(--text-muted);
          font-weight: bold;
          margin: 4px 0;
          text-transform: uppercase;
        }
        .match-result-banner {
          margin-top: 16px;
          padding: 8px 12px;
          background: rgba(61, 114, 245, 0.08);
          border-left: 3px solid var(--accent-primary);
          border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
}
