'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function TournamentHub() {
  const { id } = useParams();
  const router = useRouter();
  const [tournament, setTournament] = useState(null);
  const [teams, setTeams] = useState([]);
  const [matches, setMatches] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      // Fetch tournament details
      const { data: tData } = await supabase
        .from('tournaments')
        .select('*')
        .eq('id', id)
        .single();

      if (!tData) {
        router.push('/');
        return;
      }

      setTournament(tData);

      // Fetch teams
      const { data: teamsList } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', id);

      setTeams(teamsList || []);

      // Fetch matches + their innings
      const { data: matchesList } = await supabase
        .from('matches')
        .select(`
          *,
          innings(*)
        `)
        .eq('tournament_id', id);

      const ml = matchesList || [];
      setMatches(ml);

      // Calculate Standings Table
      calculateStandings(teamsList || [], ml, tData);
      setLoading(false);
    }
    loadData();
  }, [id]);

  const calculateStandings = (teamsList, matchesList, tData) => {
    const stats = {};
    teamsList.forEach(t => {
      stats[t.id] = {
        id: t.id,
        name: t.name,
        emoji: t.emoji,
        color: t.color,
        played: 0,
        won: 0,
        lost: 0,
        nr: 0,
        pts: 0,
        runsScored: 0,
        oversFaced: 0,
        runsConceded: 0,
        oversBowled: 0,
        recentForm: [], // Array of 'W', 'L', 'N'
      };
    });

    // Only league matches count for the points table
    const leagueMatches = matchesList
      .filter(m => m.stage === 'league')
      // Sort by match_number or completed time to get chronological form
      .sort((a, b) => a.match_number - b.match_number);

    leagueMatches.forEach(match => {
      if (match.status !== 'completed') return;

      const t1 = match.team1_id;
      const t2 = match.team2_id;

      if (!stats[t1] || !stats[t2]) return;

      stats[t1].played += 1;
      stats[t2].played += 1;

      // Handle Win/Loss/NR
      if (match.winner_id === t1) {
        stats[t1].won += 1;
        stats[t1].pts += tData.points_win;
        stats[t1].recentForm.push('W');

        stats[t2].lost += 1;
        stats[t2].pts += tData.points_loss;
        stats[t2].recentForm.push('L');
      } else if (match.winner_id === t2) {
        stats[t2].won += 1;
        stats[t2].pts += tData.points_win;
        stats[t2].recentForm.push('W');

        stats[t1].lost += 1;
        stats[t1].pts += tData.points_loss;
        stats[t1].recentForm.push('L');
      } else {
        // No result
        stats[t1].nr += 1;
        stats[t1].pts += tData.points_nr;
        stats[t1].recentForm.push('N');

        stats[t2].nr += 1;
        stats[t2].pts += tData.points_nr;
        stats[t2].recentForm.push('N');
      }

      // NRR calculation helper
      const inn1 = match.innings?.find(i => i.innings_number === 1 && !i.is_super_over);
      const inn2 = match.innings?.find(i => i.innings_number === 2 && !i.is_super_over);

      if (inn1 && inn2) {
        const inn1BatId = inn1.batting_team_id;
        const inn2BatId = inn2.batting_team_id;
        const inn1BowlId = inn1BatId === t1 ? t2 : t1;
        const inn2BowlId = inn2BatId === t1 ? t2 : t1;

        // Innings 1 stats
        stats[inn1BatId].runsScored += inn1.total_runs;
        stats[inn1BowlId].runsConceded += inn1.total_runs;

        // If a team is all-out, they face the FULL quota of overs for NRR
        const inn1TotalOvers = match.overs;
        const facedOvers1 = inn1.total_wickets >= match.wickets ? inn1TotalOvers : parseFloat(inn1.overs_completed);
        stats[inn1BatId].oversFaced += facedOvers1;
        stats[inn1BowlId].oversBowled += facedOvers1;

        // Innings 2 stats
        stats[inn2BatId].runsScored += inn2.total_runs;
        stats[inn2BowlId].runsConceded += inn2.total_runs;

        // If team 2 gets all out, they face full overs.
        // If team 2 wins by chasing, they faced actual overs completed.
        const facedOvers2 = inn2.total_wickets >= match.wickets ? match.overs : parseFloat(inn2.overs_completed);
        stats[inn2BatId].oversFaced += facedOvers2;
        stats[inn2BowlId].oversBowled += facedOvers2;
      }
    });

    // Compute NRR value
    const table = Object.values(stats).map(team => {
      let nrr = 0.0;
      if (team.oversFaced > 0 && team.oversBowled > 0) {
        // convert overs float (e.g. 5.3 overs = 5 + 3/6 = 5.5 overs) to actual decimals for computation
        const toDecimalOvers = (val) => {
          const main = Math.floor(val);
          const balls = Math.round((val - main) * 10);
          return main + balls / 6;
        };

        const decFaced = toDecimalOvers(team.oversFaced);
        const decBowled = toDecimalOvers(team.oversBowled);

        const rFacedRate = decFaced > 0 ? team.runsScored / decFaced : 0;
        const rBowledRate = decBowled > 0 ? team.runsConceded / decBowled : 0;
        nrr = rFacedRate - rBowledRate;
      }

      // Slice recent form to last 5
      const recent = team.recentForm.slice(-5);

      return {
        ...team,
        nrr: nrr,
        recent,
      };
    });

    // Sort by PTS desc -> NRR desc -> Wins desc
    table.sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      if (b.nrr !== a.nrr) return b.nrr - a.nrr;
      return b.won - a.won;
    });

    setTableData(table);
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0c0f1e' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(79,122,248,0.2)', borderTopColor: '#4f7af8', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const qualifyingCount = tournament.qualifiers_count || tournament.playoff_config?.qualifying_teams || 4;

  const navBtn = (active) => ({
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '10px',
    background: active ? 'linear-gradient(135deg, #4f7af8, #7c5cfc)' : 'rgba(255,255,255,0.05)',
    color: active ? 'white' : '#94a3b8',
    border: active ? 'none' : '1px solid rgba(255,255,255,0.08)',
    textDecoration: 'none', fontWeight: 600, fontSize: '0.875rem',
    boxShadow: active ? '0 4px 12px rgba(79,122,248,0.35)' : 'none',
  });

  return (
    <div style={{ minHeight: '100vh', background: '#0c0f1e' }}>
      <Navbar />

      <main style={{ maxWidth: '960px', margin: '0 auto', padding: '36px 20px' }}>
        {/* Header */}
        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: '1.9rem', color: '#eef2ff' }}>{tournament.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px' }}>
            <span style={{ fontSize: '0.82rem', color: '#4b5680' }}>
              {teams.length} teams · {matches.filter(m => m.stage === 'league').length} league matches
            </span>
          </div>
        </div>

        {/* Sub-Navigation */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', overflowX: 'auto' }}>
          <Link href={`/tournament/${id}`} style={navBtn(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M3 9h18M9 21V9" stroke="currentColor" strokeWidth="2"/></svg>
            Points Table
          </Link>
          <Link href={`/tournament/${id}/matches`} style={navBtn(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="2"/></svg>
            Schedule
          </Link>
          <Link href={`/record?tournamentId=${id}`} style={navBtn(false)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><circle cx="12" cy="12" r="3" fill="#ef4444" stroke="none"/></svg>
            Record Match
          </Link>
        </div>

        {/* Points Table */}
        <div style={{ background: '#161b2e', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: '1.05rem', color: '#eef2ff' }}>Points Table</h2>
            <span style={{ fontSize: '0.78rem', color: '#4b5680' }}>Top {qualifyingCount} qualify</span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '580px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['#', 'TEAM', 'P', 'W', 'L', 'NR', 'NRR', 'PTS', 'FORM'].map(h => (
                    <th key={h} style={{ padding: '12px 14px', textAlign: h === '#' || h === 'TEAM' ? 'left' : 'center', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: '#4b5680' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.map((row, idx) => {
                  const isQ = idx < qualifyingCount;
                  return (
                    <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', borderLeft: isQ ? '3px solid #22c55e' : '3px solid transparent' }}
                      onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.025)'}
                      onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '14px 14px', fontWeight: 700, color: '#4b5680', fontSize: '0.88rem' }}>{idx + 1}</td>
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '1.1rem' }}>{row.emoji}</span>
                          <span style={{ fontWeight: 600, color: row.color || '#eef2ff' }}>{row.name}</span>
                          {isQ && <span style={{ fontSize: '0.6rem', background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '4px', padding: '1px 5px', fontWeight: 700 }}>Q</span>}
                        </div>
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'center', color: '#94a3b8' }}>{row.played}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'center', color: '#22c55e', fontWeight: 600 }}>{row.won}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'center', color: '#ef4444' }}>{row.lost}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'center', color: '#4b5680' }}>{row.nr}</td>
                      <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: 600, fontFamily: 'monospace', color: row.nrr > 0 ? '#22c55e' : row.nrr < 0 ? '#ef4444' : '#94a3b8' }}>
                        {row.nrr >= 0 ? '+' : ''}{row.nrr.toFixed(3)}
                      </td>
                      <td style={{ padding: '14px 14px', textAlign: 'center', fontWeight: 800, fontSize: '1rem', color: '#eef2ff' }}>{row.pts}</td>
                      <td style={{ padding: '14px 14px' }}>
                        <div style={{ display: 'flex', gap: '3px', justifyContent: 'center' }}>
                          {row.recent.map((res, i) => (
                            <span key={i} style={{
                              width: '20px', height: '20px', borderRadius: '50%', display: 'inline-flex',
                              alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: 700,
                              background: res === 'W' ? 'rgba(34,197,94,0.15)' : res === 'L' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)',
                              color: res === 'W' ? '#22c55e' : res === 'L' ? '#ef4444' : '#4b5680',
                              border: `1px solid ${res === 'W' ? 'rgba(34,197,94,0.3)' : res === 'L' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}`,
                            }}>{res}</span>
                          ))}
                          {row.recent.length === 0 && <span style={{ color: '#4b5680', fontSize: '0.8rem' }}>—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
