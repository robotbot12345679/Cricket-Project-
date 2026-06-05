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
        nrr: parseFloat(nrr.toFixed(3)),
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
      <div className="page-wrapper flex items-center justify-center">
        <div className="spinner" style={{ width: 45, height: 45 }} />
      </div>
    );
  }

  const qualifyingCount = tournament.playoff_config?.qualifying_teams || 4;

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="container" style={{ padding: '32px 16px', position: 'relative', zIndex: 1 }}>
        <header style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '2rem' }}>{tournament.name}</h1>
            <p className="text-secondary" style={{ fontSize: '0.9rem' }}>
              Status: <span className="badge badge-purple">{tournament.status} Stage</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <Link href={`/tournament/${id}/matches`} className="btn btn-secondary" id="btn-view-matches">
              📅 Matches List
            </Link>
            <Link href={`/record?tournamentId=${id}`} className="btn btn-primary animate-pulse-glow" id="btn-record-match">
              🔴 Record a Match
            </Link>
          </div>
        </header>

        {/* Standings Table Card */}
        <section className="card" style={{ background: 'var(--bg-secondary)', overflowX: 'auto', padding: '16px' }} id="points-table-card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', fontFamily: 'Space Grotesk' }}>Points Table</h2>

          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                <th style={{ padding: '12px 8px' }}>POS</th>
                <th style={{ padding: '12px 8px' }}>TEAM</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>P</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>W</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>L</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>NR</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>NRR</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>PTS</th>
                <th style={{ padding: '12px 8px', textAlign: 'center' }}>RECENT FORM</th>
              </tr>
            </thead>
            <tbody>
              {tableData.map((row, idx) => {
                const isQualifying = idx < qualifyingCount;
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.95rem' }} className="table-row-hover">
                    <td style={{ padding: '16px 8px', fontWeight: 'bold' }}>{idx + 1}</td>
                    <td style={{ padding: '16px 8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '1.2rem' }}>{row.emoji}</span>
                      <span style={{ fontWeight: '600', color: row.color }}>{row.name}</span>
                      {isQualifying && <span className="badge badge-green" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>Q</span>}
                    </td>
                    <td style={{ padding: '16px 8px', textAlign: 'center' }}>{row.played}</td>
                    <td style={{ padding: '16px 8px', textAlign: 'center' }}>{row.won}</td>
                    <td style={{ padding: '16px 8px', textAlign: 'center' }}>{row.lost}</td>
                    <td style={{ padding: '16px 8px', textAlign: 'center' }}>{row.nr}</td>
                    <td style={{ padding: '16px 8px', textAlign: 'center', color: row.nrr >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                      {row.nrr > 0 ? `+${row.nrr}` : row.nrr}
                    </td>
                    <td style={{ padding: '16px 8px', textAlign: 'center', fontWeight: 'bold' }}>{row.pts}</td>
                    <td style={{ padding: '16px 8px' }}>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                        {row.recent.map((res, rIdx) => (
                          <span
                            key={rIdx}
                            className={`form-indicator ${res === 'W' ? 'win' : res === 'L' ? 'loss' : 'nr'}`}
                          >
                            {res}
                          </span>
                        ))}
                        {row.recent.length === 0 && <span className="text-muted">-</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>

      <style jsx>{`
        .table-row-hover:hover {
          background: rgba(255,255,255,0.02);
        }
      `}</style>
    </div>
  );
}
