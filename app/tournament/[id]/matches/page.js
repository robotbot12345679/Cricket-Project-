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
  const navBtn = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '10px',
    background: active ? 'linear-gradient(135deg, #4f7af8, #7c5cfc)' : 'rgba(255,255,255,0.05)',
    color: active ? 'white' : '#94a3b8',
    border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
    textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem',
    boxShadow: active ? '0 4px 12px rgba(79,122,248,0.35)' : 'none',
  });

  const getScore = (match, teamId) => {
    if (match.status === 'scheduled') return null;
    const inn = match.innings?.find(i => i.batting_team_id === teamId && !i.is_super_over);
    if (!inn) return null;
    return { runs: inn.total_runs, wickets: inn.total_wickets, overs: inn.overs_completed };
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0c0f1e' }}>
      <Navbar />

      <main style={{ maxWidth: '760px', margin: '0 auto', padding: '36px 20px' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '1.9rem', color: '#eef2ff' }}>{tournament?.name}</h1>
          <p style={{ color: '#4b5680', marginTop: '4px', fontSize: '0.85rem' }}>{matches.length} matches · Schedule</p>
        </div>

        {/* Sub-Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', overflowX: 'auto' }}>
          <Link href={`/tournament/${id}`} style={navBtn(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="2"/></svg>
            Points Table
          </Link>
          <Link href={`/tournament/${id}/matches`} style={navBtn(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2"/></svg>
            Schedule
          </Link>
          <Link href={`/record?tournamentId=${id}`} style={navBtn(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" fill="#ef4444" stroke="none"/></svg>
            Record Match
          </Link>
        </div>

        {/* Matches List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {matches.length === 0 && (
            <div style={{ background: '#161b2e', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '16px', padding: '48px', textAlign: 'center' }}>
              <p style={{ color: '#4b5680' }}>No matches scheduled yet.</p>
            </div>
          )}

          {matches.map((match) => {
            const t1 = teams[match.team1_id];
            const t2 = teams[match.team2_id];
            const s1 = getScore(match, match.team1_id);
            const s2 = getScore(match, match.team2_id);
            const isCompleted = match.status === 'completed';
            const isLive = match.status === 'live';

            return (
              <Link key={match.id} href={`/record?tournamentId=${id}&matchId=${match.id}`}
                style={{ textDecoration: 'none', display: 'block' }}
                id={`match-card-${match.id}`}
              >
                <div style={{
                  background: '#161b2e', border: `1px solid ${isLive ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: '14px', padding: '18px 20px',
                  transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
                }}
                  onMouseOver={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.3)'; e.currentTarget.style.borderColor = 'rgba(79,122,248,0.25)'; }}
                  onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = isLive ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.07)'; }}
                >
                  {/* Match Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                    <span style={{ fontSize: '0.75rem', color: '#4b5680', fontWeight: 600 }}>
                      {match.stage === 'league' ? `Match ${match.match_number}` : match.stage?.toUpperCase()} · {match.overs || '?'} OV
                    </span>
                    {isLive && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 10px', borderRadius: '100px', background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.25)', fontSize: '0.7rem', fontWeight: 700 }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite' }} />
                        LIVE
                      </span>
                    )}
                    {isCompleted && (
                      <span style={{ padding: '3px 10px', borderRadius: '100px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)', fontSize: '0.7rem', fontWeight: 700 }}>
                        DONE
                      </span>
                    )}
                    {!isCompleted && !isLive && (
                      <span style={{ padding: '3px 10px', borderRadius: '100px', background: 'rgba(255,255,255,0.05)', color: '#4b5680', border: '1px solid rgba(255,255,255,0.08)', fontSize: '0.7rem', fontWeight: 700 }}>
                        SCHEDULED
                      </span>
                    )}
                  </div>

                  {/* Teams */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {/* Team 1 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{t1?.emoji || '?'}</span>
                        <span style={{ fontWeight: 600, color: t1?.color || '#eef2ff', fontSize: '0.95rem' }}>{t1?.name || 'TBD'}</span>
                        {isCompleted && match.winner_id === match.team1_id && (
                          <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 700 }}>WON</span>
                        )}
                      </div>
                      {s1 ? (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#eef2ff' }}>{s1.runs}/{s1.wickets}</span>
                          <span style={{ color: '#4b5680', fontSize: '0.75rem', marginLeft: '6px' }}>({s1.overs} ov)</span>
                        </div>
                      ) : <span style={{ color: '#4b5680', fontSize: '0.9rem' }}>—</span>}
                    </div>

                    <div style={{ height: '1px', background: 'rgba(255,255,255,0.04)' }} />

                    {/* Team 2 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.2rem' }}>{t2?.emoji || '?'}</span>
                        <span style={{ fontWeight: 600, color: t2?.color || '#eef2ff', fontSize: '0.95rem' }}>{t2?.name || 'TBD'}</span>
                        {isCompleted && match.winner_id === match.team2_id && (
                          <span style={{ fontSize: '0.65rem', padding: '2px 6px', borderRadius: '4px', background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 700 }}>WON</span>
                        )}
                      </div>
                      {s2 ? (
                        <div style={{ textAlign: 'right' }}>
                          <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#eef2ff' }}>{s2.runs}/{s2.wickets}</span>
                          <span style={{ color: '#4b5680', fontSize: '0.75rem', marginLeft: '6px' }}>({s2.overs} ov)</span>
                        </div>
                      ) : <span style={{ color: '#4b5680', fontSize: '0.9rem' }}>—</span>}
                    </div>
                  </div>

                  {/* Result */}
                  {isCompleted && match.result_description && (
                    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '0.82rem', color: '#94a3b8' }}>
                      {match.result_description}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

