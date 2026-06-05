'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function MatchDetailPage() {
  const { id, matchId } = useParams();
  const [match, setMatch] = useState(null);
  const [teams, setTeams] = useState({});
  const [innings, setInnings] = useState([]);
  const [lastBalls, setLastBalls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!matchId) return;

      // Match Details
      const { data: mData } = await supabase
        .from('matches')
        .select('*')
        .eq('id', matchId)
        .single();
      setMatch(mData);

      // Teams list to build mapping
      const { data: tList } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', id);

      const tMap = {};
      (tList || []).forEach(t => {
        tMap[t.id] = t;
      });
      setTeams(tMap);

      // Innings for the match
      const { data: iList } = await supabase
        .from('innings')
        .select('*')
        .eq('match_id', matchId)
        .order('innings_number', { ascending: true });
      setInnings(iList || []);

      // Balls for the last 2 overs of the match
      // If innings 2 is active or complete, show innings 2's balls. Otherwise, innings 1.
      const activeInnings = iList?.find(inn => inn.innings_number === 2) || iList?.find(inn => inn.innings_number === 1);

      if (activeInnings) {
        // Fetch balls from this innings
        const { data: bList } = await supabase
          .from('balls')
          .select('*')
          .eq('innings_id', activeInnings.id)
          .order('delivery_sequence', { ascending: false })
          .limit(20); // fetch last 20 deliveries to extract the last 2 overs (approx 12-15 balls depending on extras)
        
        // Sort back chronologically for visualizer
        const sortedBalls = (bList || []).reverse();
        setLastBalls(sortedBalls);
      }

      setLoading(false);
    }
    loadData();
  }, [id, matchId]);

  if (loading) {
    return (
      <div className="page-wrapper flex items-center justify-center">
        <div className="spinner" style={{ width: 45, height: 45 }} />
      </div>
    );
  }

  const team1 = teams[match.team1_id];
  const team2 = teams[match.team2_id];

  const inn1 = innings.find(i => i.innings_number === 1 && !i.is_super_over);
  const inn2 = innings.find(i => i.innings_number === 2 && !i.is_super_over);
  const superInn1 = innings.find(i => i.is_super_over && i.innings_number === 1);
  const superInn2 = innings.find(i => i.is_super_over && i.innings_number === 2);

  // Helper to format ball class
  const getBallClass = (ball) => {
    if (ball.is_wicket) return 'wicket';
    if (ball.extras_type === 'wide') return 'wide';
    if (ball.extras_type === 'noball') return 'noball';
    if (ball.runs === 0 && !ball.extras) return 'dot';
    if (ball.runs === 4) return 'four';
    if (ball.runs === 6) return 'six';
    if (ball.runs === 1) return 'one';
    if (ball.runs === 2) return 'two';
    if (ball.runs === 3) return 'three';
    return '';
  };

  // Helper to format ball text display
  const getBallText = (ball) => {
    if (ball.is_wicket) return 'W';
    if (ball.extras_type === 'wide') return 'Wd';
    if (ball.extras_type === 'noball') return 'Nb';
    if (ball.runs === 0 && !ball.extras) return '·';
    return `${ball.runs + (ball.extras || 0)}`;
  };

  // Group balls by over for visualization
  const groupBallsByOver = () => {
    const oversMap = {};
    lastBalls.forEach(ball => {
      const overNum = ball.over_number + 1; // display 1-indexed
      if (!oversMap[overNum]) oversMap[overNum] = [];
      oversMap[overNum].push(ball);
    });
    // return array of { overLabel, balls }
    return Object.entries(oversMap).map(([overNum, balls]) => ({
      overLabel: `OV ${overNum}`,
      balls
    })).slice(-2); // only take the last 2 overs
  };

  const visibleOvers = groupBallsByOver();

  return (
    <div className="page-wrapper">
      <Navbar />

      <main className="container" style={{ padding: '32px 16px', position: 'relative', zIndex: 1, maxWidth: '800px' }}>
        <header style={{ marginBottom: '24px' }}>
          <Link href={`/tournament/${id}/matches`} style={{ textDecoration: 'none', color: 'var(--accent-primary)', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            ← Back to Matches
          </Link>
        </header>

        {/* Image 3 Styled Scoreboard Widget */}
        <section className="card-glass scorecard-widget" style={{ padding: '32px 24px', borderRadius: 'var(--radius-xl)', overflow: 'hidden', position: 'relative', background: '#0f183c', border: '1px solid rgba(61,114,245,0.3)', boxShadow: '0 8px 32px rgba(10, 14, 26, 0.6)' }}>
          <div className="widget-header flex justify-between items-center w-full" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '20px' }}>
            {/* Team 1 Widget Score */}
            <div className="widget-team flex-1 text-center">
              <div className="widget-logo" style={{ fontSize: '3rem', margin: '0 auto 8px' }}>{team1?.emoji || '❔'}</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: team1?.color }}>{team1?.name || 'TBD'}</h3>
              {inn1 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{inn1.total_runs}/{inn1.total_wickets}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{inn1.overs_completed} Overs</div>
                </div>
              )}
            </div>

            {/* Match Badge vs */}
            <div className="widget-vs-badge" style={{ padding: '4px 12px', background: 'var(--bg-primary)', border: '1.5px solid var(--border-primary)', borderRadius: '6px', fontWeight: 'bold', fontSize: '0.8rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Match {match.match_number}
            </div>

            {/* Team 2 Widget Score */}
            <div className="widget-team flex-1 text-center">
              <div className="widget-logo" style={{ fontSize: '3rem', margin: '0 auto 8px' }}>{team2?.emoji || '❔'}</div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: team2?.color }}>{team2?.name || 'TBD'}</h3>
              {inn2 && (
                <div style={{ marginTop: '8px' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: '900' }}>{inn2.total_runs}/{inn2.total_wickets}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{inn2.overs_completed} Overs</div>
                </div>
              )}
            </div>
          </div>

          {/* Last 2 overs details */}
          {visibleOvers.length > 0 && (
            <div className="widget-overs-tracker" style={{ display: 'flex', justifyContent: 'center', gap: '24px', padding: '24px 0 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap' }}>
              {visibleOvers.map((overGroup, oIdx) => (
                <div key={oIdx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginRight: '4px' }}>
                    {overGroup.overLabel}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {overGroup.balls.map((ball) => (
                      <span key={ball.id} className={`ball-chip ${getBallClass(ball)}`}>
                        {getBallText(ball)}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Result Banner at bottom of widget */}
          {match.status === 'completed' ? (
            <div className="widget-result-banner" style={{ background: '#3d72f5', color: '#ffffff', textAlign: 'center', padding: '12px', fontSize: '1rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.03em', margin: '20px -24px -32px' }}>
              {match.result_description}
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <Link href={`/record?matchId=${match.id}`} className="btn btn-primary animate-pulse-glow" style={{ width: '100%' }}>
                🔴 Record / Live Score Match
              </Link>
            </div>
          )}
        </section>

        {/* Super Over summary if exists */}
        {(superInn1 || superInn2) && (
          <section className="card mt-24" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-red)' }}>
            <h2 className="font-bold text-sm" style={{ color: 'var(--accent-red)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              ⚡ Super Over Scorecard
            </h2>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold" style={{ color: team1?.color }}>{team1?.name}</p>
                <p style={{ fontSize: '1.2rem', fontWeight: '800' }}>{superInn1?.total_runs || 0}/{superInn1?.total_wickets || 0} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({superInn1?.overs_completed || 0} ov)</span></p>
              </div>
              <div className="badge badge-red">Super Over</div>
              <div style={{ textAlign: 'right' }}>
                <p className="font-semibold" style={{ color: team2?.color }}>{team2?.name}</p>
                <p style={{ fontSize: '1.2rem', fontWeight: '800' }}>{superInn2?.total_runs || 0}/{superInn2?.total_wickets || 0} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({superInn2?.overs_completed || 0} ov)</span></p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
