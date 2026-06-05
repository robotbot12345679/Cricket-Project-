'use client';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';

import { Suspense } from 'react';

function RecordMatchConsole() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMatchId = searchParams.get('matchId');
  const initialTournamentId = searchParams.get('tournamentId');

  // Lists
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState(initialTournamentId || '');
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState({});

  // Active Scoring Match
  const [activeMatch, setActiveMatch] = useState(null);
  const [activeInnings, setActiveInnings] = useState(null); // innings 1 or 2
  const [inn1Stats, setInn1Stats] = useState(null);
  const [inn2Stats, setInn2Stats] = useState(null);
  const [currentOverBalls, setCurrentOverBalls] = useState([]);
  
  // Toss states
  const [tossWinnerId, setTossWinnerId] = useState('');
  const [tossDecision, setTossDecision] = useState('bat'); // 'bat' or 'bowl'

  // Loading/saving states
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch initial data
  useEffect(() => {
    async function loadInitial() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tList } = await supabase
        .from('tournaments')
        .select('*')
        .eq('created_by', user.id);
      
      setTournaments(tList || []);
      
      if (tList?.length > 0 && !selectedTournamentId) {
        setSelectedTournamentId(tList[0].id);
      }
      setLoading(false);
    }
    loadInitial();
  }, []);

  // Fetch matches whenever tournament changes
  useEffect(() => {
    async function loadMatches() {
      if (!selectedTournamentId) return;

      // Teams mapping
      const { data: tList } = await supabase
        .from('teams')
        .select('*')
        .eq('tournament_id', selectedTournamentId);
      const tMap = {};
      (tList || []).forEach(t => { tMap[t.id] = t; });
      setTeams(tMap);

      // Matches
      const { data: mList } = await supabase
        .from('matches')
        .select('*, innings(*)')
        .eq('tournament_id', selectedTournamentId)
        .order('match_number', { ascending: true });
      
      setMatches(mList || []);

      if (initialMatchId) {
        const found = mList?.find(m => m.id === initialMatchId);
        if (found) selectMatch(found);
      }
    }
    loadMatches();
  }, [selectedTournamentId]);

  const selectMatch = async (match) => {
    setActiveMatch(match);
    
    // Sort innings by number
    const sortedInnings = [...(match.innings || [])].sort((a, b) => a.innings_number - b.innings_number);
    const i1 = sortedInnings.find(i => i.innings_number === 1 && !i.is_super_over);
    const i2 = sortedInnings.find(i => i.innings_number === 2 && !i.is_super_over);
    setInn1Stats(i1 || null);
    setInn2Stats(i2 || null);

    if (i2) {
      setActiveInnings(i2);
      await loadOverBalls(i2.id);
    } else if (i1) {
      setActiveInnings(i1);
      await loadOverBalls(i1.id);
    } else {
      setActiveInnings(null);
      setCurrentOverBalls([]);
    }
  };

  const loadOverBalls = async (inningsId) => {
    const { data: balls } = await supabase
      .from('balls')
      .select('*')
      .eq('innings_id', inningsId)
      .order('delivery_sequence', { ascending: true });

    if (balls && balls.length > 0) {
      // Find the latest over number
      const latestOver = Math.max(...balls.map(b => b.over_number));
      // filter balls belonging to the current active over
      const activeOverBalls = balls.filter(b => b.over_number === latestOver);
      setCurrentOverBalls(activeOverBalls);
    } else {
      setCurrentOverBalls([]);
    }
  };

  const startMatch = async () => {
    if (!tossWinnerId) return alert('Select toss winner');
    setSaving(true);

    const team1Id = activeMatch.team1_id;
    const team2Id = activeMatch.team2_id;
    const battingTeamId = tossWinnerId === team1Id 
      ? (tossDecision === 'bat' ? team1Id : team2Id)
      : (tossDecision === 'bat' ? team2Id : team1Id);

    // Update match toss
    const { data: updatedMatch, error: matchErr } = await supabase
      .from('matches')
      .update({
        toss_winner_id: tossWinnerId,
        toss_decision: tossDecision,
        status: 'live'
      })
      .eq('id', activeMatch.id)
      .select()
      .single();

    if (matchErr) {
      alert(matchErr.message);
      setSaving(false);
      return;
    }

    // Create 1st Innings
    const { data: inningsData, error: innErr } = await supabase
      .from('innings')
      .insert({
        match_id: activeMatch.id,
        innings_number: 1,
        batting_team_id: battingTeamId,
        total_runs: 0,
        total_wickets: 0,
        overs_completed: 0.0,
        is_complete: false
      })
      .select()
      .single();

    if (innErr) {
      alert(innErr.message);
      setSaving(false);
      return;
    }

    // Refresh match state in UI
    const updatedMatches = matches.map(m => m.id === activeMatch.id ? { ...updatedMatch, innings: [inningsData] } : m);
    setMatches(updatedMatches);
    setActiveMatch({ ...updatedMatch, innings: [inningsData] });
    setActiveInnings(inningsData);
    setInn1Stats(inningsData);
    setCurrentOverBalls([]);
    setSaving(false);
  };

  const recordBall = async (runs, extrasType = null, isWicket = false) => {
    if (!activeInnings || saving) return;
    setSaving(true);

    try {
      // Calculate over and ball numbers
      let currentOver = 0;
      let currentBallInOver = 0;

      // Get all current balls for the innings
      const { data: existingBalls } = await supabase
        .from('balls')
        .select('*')
        .eq('innings_id', activeInnings.id)
        .order('delivery_sequence', { ascending: true });

      const seq = existingBalls ? existingBalls.length + 1 : 1;

      if (existingBalls && existingBalls.length > 0) {
        const lastBall = existingBalls[existingBalls.length - 1];
        currentOver = lastBall.over_number;
        currentBallInOver = lastBall.ball_number;

        // If the last ball was legal, we advance. Wides and No Balls do not count as legal balls.
        const isLegal = lastBall.extras_type !== 'wide' && lastBall.extras_type !== 'noball';
        if (isLegal) {
          if (currentBallInOver === 5) {
            currentOver += 1;
            currentBallInOver = 0;
          } else {
            currentBallInOver += 1;
          }
        } else {
          // Keep current over and ball counts (re-bowl)
        }
      }

      const isThisLegal = extrasType !== 'wide' && extrasType !== 'noball';

      // Runs calculation
      const extras = extrasType === 'wide' || extrasType === 'noball' ? 1 : 0; // standard 1 extra for wide/no ball

      // Create new ball
      const { data: newBall, error: ballErr } = await supabase
        .from('balls')
        .insert({
          innings_id: activeInnings.id,
          over_number: currentOver,
          ball_number: isThisLegal ? currentBallInOver : currentBallInOver, // unchanged if extra
          runs,
          extras,
          extras_type: extrasType,
          is_wicket: isWicket,
          delivery_sequence: seq
        })
        .select()
        .single();

      if (ballErr) throw ballErr;

      // Re-calculate Innings stats
      const allBalls = [...(existingBalls || []), newBall];
      const totalRuns = allBalls.reduce((acc, b) => acc + b.runs + b.extras, 0);
      const totalWickets = allBalls.filter(b => b.is_wicket).length;

      // Calculate overs completed
      const legalDeliveries = allBalls.filter(b => b.extras_type !== 'wide' && b.extras_type !== 'noball').length;
      const calcOvers = Math.floor(legalDeliveries / 6) + (legalDeliveries % 6) / 10;

      // Update innings in db
      const { data: updatedInnings, error: innErr } = await supabase
        .from('innings')
        .update({
          total_runs: totalRuns,
          total_wickets: totalWickets,
          overs_completed: calcOvers,
        })
        .eq('id', activeInnings.id)
        .select()
        .single();

      if (innErr) throw innErr;

      // Update states
      if (activeInnings.innings_number === 1) {
        setInn1Stats(updatedInnings);
      } else {
        setInn2Stats(updatedInnings);
      }
      setActiveInnings(updatedInnings);

      // Load over balls
      const updatedOverBalls = allBalls.filter(b => b.over_number === currentOver);
      setCurrentOverBalls(updatedOverBalls);

      // Check for Innings/Match closure rules
      const totalAlottedOvers = activeMatch.overs;
      const wicketsLimit = activeMatch.wickets;

      if (activeInnings.innings_number === 1) {
        // End of 1st Innings conditions
        if (totalWickets >= wicketsLimit || legalDeliveries >= totalAlottedOvers * 6) {
          await closeInnings1(updatedInnings);
        }
      } else {
        // Innings 2 conditions
        const target = inn1Stats.total_runs + 1;
        const chased = totalRuns >= target;
        const allOut = totalWickets >= wicketsLimit;
        const oversEnded = legalDeliveries >= totalAlottedOvers * 6;

        if (chased || allOut || oversEnded) {
          await closeMatch(updatedInnings, totalRuns);
        }
      }

    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const undoLastBall = async () => {
    if (!activeInnings || saving) return;

    const confirmUndo = confirm('Are you sure you want to undo the last delivery?');
    if (!confirmUndo) return;

    setSaving(true);
    try {
      // Find latest ball
      const { data: lastBalls } = await supabase
        .from('balls')
        .select('*')
        .eq('innings_id', activeInnings.id)
        .order('delivery_sequence', { ascending: false })
        .limit(1);

      if (!lastBalls || lastBalls.length === 0) {
        alert('No deliveries to undo.');
        setSaving(false);
        return;
      }

      const targetBall = lastBalls[0];

      // Delete ball
      const { error: delErr } = await supabase
        .from('balls')
        .delete()
        .eq('id', targetBall.id);

      if (delErr) throw delErr;

      // Fetch remaining balls to compute updated scorecard
      const { data: remainingBalls } = await supabase
        .from('balls')
        .select('*')
        .eq('innings_id', activeInnings.id)
        .order('delivery_sequence', { ascending: true });

      const totalRuns = (remainingBalls || []).reduce((acc, b) => acc + b.runs + b.extras, 0);
      const totalWickets = (remainingBalls || []).filter(b => b.is_wicket).length;
      const legalDeliveries = (remainingBalls || []).filter(b => b.extras_type !== 'wide' && b.extras_type !== 'noball').length;
      const calcOvers = Math.floor(legalDeliveries / 6) + (legalDeliveries % 6) / 10;

      // Update innings
      const { data: updatedInnings, error: innErr } = await supabase
        .from('innings')
        .update({
          total_runs: totalRuns,
          total_wickets: totalWickets,
          overs_completed: calcOvers,
        })
        .eq('id', activeInnings.id)
        .select()
        .single();

      if (innErr) throw innErr;

      if (activeInnings.innings_number === 1) {
        setInn1Stats(updatedInnings);
      } else {
        setInn2Stats(updatedInnings);
      }
      setActiveInnings(updatedInnings);

      if (remainingBalls && remainingBalls.length > 0) {
        const latestOverNum = Math.max(...remainingBalls.map(b => b.over_number));
        setCurrentOverBalls(remainingBalls.filter(b => b.over_number === latestOverNum));
      } else {
        setCurrentOverBalls([]);
      }

    } catch (e) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const closeInnings1 = async (inn1) => {
    // Set innings 1 complete
    await supabase
      .from('innings')
      .update({ is_complete: true })
      .eq('id', inn1.id);

    // Create Innings 2
    const battingTeamId = activeMatch.team1_id === inn1.batting_team_id 
      ? activeMatch.team2_id 
      : activeMatch.team1_id;

    const { data: inn2, error: innErr } = await supabase
      .from('innings')
      .insert({
        match_id: activeMatch.id,
        innings_number: 2,
        batting_team_id: battingTeamId,
        total_runs: 0,
        total_wickets: 0,
        overs_completed: 0.0,
        is_complete: false
      })
      .select()
      .single();

    if (innErr) {
      alert(innErr.message);
      return;
    }

    setInn2Stats(inn2);
    setActiveInnings(inn2);
    setCurrentOverBalls([]);
  };

  const closeMatch = async (inn2, runs2) => {
    const runs1 = inn1Stats.total_runs;
    let winnerId = null;
    let resultDesc = '';

    if (runs2 > runs1) {
      winnerId = inn2.batting_team_id;
      const wicketsLeft = activeMatch.wickets - inn2.total_wickets;
      resultDesc = `${teams[winnerId]?.name} won by ${wicketsLeft} wickets`;
    } else if (runs1 > runs2) {
      winnerId = inn1Stats.batting_team_id;
      const runsMargin = runs1 - runs2;
      resultDesc = `${teams[winnerId]?.name} won by ${runsMargin} runs`;
    } else {
      // TIE -> trigger super over
      resultDesc = 'Match Tied (Super Over TBD)';
    }

    const { data: updatedMatch, error: matchErr } = await supabase
      .from('matches')
      .update({
        winner_id: winnerId,
        result_description: resultDesc,
        status: winnerId ? 'completed' : 'live', // live if super over needed
        has_super_over: !winnerId
      })
      .eq('id', activeMatch.id)
      .select()
      .single();

    if (matchErr) throw matchErr;

    // Refresh UI
    alert(resultDesc);
    router.push(`/tournament/${selectedTournamentId}`);
    router.refresh();
  };

  return (
    <div className="page-wrapper flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="navbar flex-shrink-0">
        <Link href="/" className="navbar-brand">
          <div className="navbar-brand-icon">🏏</div>
          <span className="navbar-brand-name">CricManager — Live Scorer</span>
        </Link>
        <div>
          <select
            className="form-input"
            style={{ width: '220px', padding: '6px 12px' }}
            value={selectedTournamentId}
            onChange={(e) => setSelectedTournamentId(e.target.value)}
          >
            <option value="">Select Tournament...</option>
            {tournaments.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>
      </header>

      {/* Main split-screen panel wrapper */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left scrollable list */}
        <aside className="record-left-panel flex-shrink-0" style={{ width: '320px', background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-subtle)', overflowY: 'auto', padding: '16px' }}>
          <h2 className="text-sm font-bold mb-16 text-secondary" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matches</h2>
          <div className="flex flex-col gap-12">
            {matches.map((m) => {
              const isSelected = activeMatch?.id === m.id;
              const t1 = teams[m.team1_id];
              const t2 = teams[m.team2_id];
              return (
                <div
                  key={m.id}
                  className={`card cursor-pointer ${isSelected ? 'active-match-card' : ''}`}
                  style={{ padding: '14px', background: isSelected ? 'rgba(61,114,245,0.08)' : 'var(--bg-card)', borderColor: isSelected ? 'var(--accent-primary)' : 'var(--border-subtle)' }}
                  onClick={() => selectMatch(m)}
                >
                  <div className="flex justify-between items-center mb-8">
                    <span className="badge badge-gray" style={{ fontSize: '0.65rem' }}>{m.stage === 'league' ? `Match ${m.match_number}` : m.stage}</span>
                    <span className={`badge ${m.status === 'completed' ? 'badge-green' : m.status === 'live' ? 'badge-red' : 'badge-yellow'}`} style={{ fontSize: '0.65rem' }}>
                      {m.status}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold" style={{ margin: '4px 0' }}>
                    <span style={{ color: t1?.color }}>{t1?.name || 'TBD'}</span>
                    <span style={{ color: t2?.color }}>{t2?.name || 'TBD'}</span>
                  </div>
                </div>
              );
            })}
            {matches.length === 0 && (
              <p className="text-xs text-muted text-center mt-24">Select a tournament to view matches.</p>
            )}
          </div>
        </aside>

        {/* Right side live scorer console */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-primary)', position: 'relative' }}>
          {activeMatch ? (
            <div style={{ padding: '32px' }} className="animate-fade-in">
              {/* Pre-toss setup */}
              {activeMatch.status === 'scheduled' && (
                <div className="card max-w-md mx-auto" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                  <h2 className="font-bold mb-16 text-center">Toss & Match Setup</h2>
                  <div className="form-group mb-16">
                    <label className="form-label">Who won the toss?</label>
                    <select
                      className="form-input"
                      value={tossWinnerId}
                      onChange={(e) => setTossWinnerId(e.target.value)}
                    >
                      <option value="">Select Team...</option>
                      <option value={activeMatch.team1_id}>{teams[activeMatch.team1_id]?.name}</option>
                      <option value={activeMatch.team2_id}>{teams[activeMatch.team2_id]?.name}</option>
                    </select>
                  </div>

                  <div className="form-group mb-24">
                    <label className="form-label">Decision</label>
                    <select
                      className="form-input"
                      value={tossDecision}
                      onChange={(e) => setTossDecision(e.target.value)}
                    >
                      <option value="bat">Batted First</option>
                      <option value="bowl">Bowled First</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    className="btn btn-primary w-full btn-lg"
                    onClick={startMatch}
                    disabled={saving}
                  >
                    {saving ? <span className="spinner" /> : '🚀 Start Innings 1'}
                  </button>
                </div>
              )}

              {/* Match live console */}
              {activeMatch.status === 'live' && activeInnings && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Scoreboard widget */}
                  <div className="card-glass text-center" style={{ background: '#0e1739', border: '1px solid rgba(61,114,245,0.3)', padding: '24px' }}>
                    <p style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 'bold' }}>
                      Innings {activeInnings.innings_number} in progress
                    </p>
                    <h1 style={{ fontSize: '3rem', fontWeight: '900', margin: '8px 0', color: teams[activeInnings.batting_team_id]?.color }}>
                      {activeInnings.total_runs}/{activeInnings.total_wickets}
                    </h1>
                    <p style={{ fontSize: '1rem', fontWeight: '600' }}>
                      Overs: {activeInnings.overs_completed} / {activeMatch.overs}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '8px' }}>
                      Batting: <strong style={{ color: teams[activeInnings.batting_team_id]?.color }}>{teams[activeInnings.batting_team_id]?.name}</strong>
                    </p>

                    {/* Target indicator for Innings 2 */}
                    {activeInnings.innings_number === 2 && inn1Stats && (
                      <div style={{ marginTop: '16px', background: 'rgba(255,255,255,0.05)', padding: '12px', borderRadius: '8px' }}>
                        <p style={{ fontSize: '0.95rem', fontWeight: '700' }}>
                          Target: <span style={{ color: 'var(--accent-yellow)' }}>{inn1Stats.total_runs + 1}</span> runs
                        </p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          Need {inn1Stats.total_runs + 1 - activeInnings.total_runs} runs from {Math.max(0, activeMatch.overs * 6 - (Math.floor(activeInnings.overs_completed) * 6 + Math.round((activeInnings.overs_completed % 1) * 10)))} balls
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Over balls visual tracker */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="text-xs text-muted" style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>This Over:</span>
                    {currentOverBalls.map((b) => (
                      <span key={b.id} className={`ball-chip ${b.is_wicket ? 'wicket' : b.extras_type === 'wide' ? 'wide' : b.extras_type === 'noball' ? 'noball' : b.runs === 0 ? 'dot' : b.runs === 4 ? 'four' : b.runs === 6 ? 'six' : 'one'}`} style={{ width: '28px', height: '28px', fontSize: '0.7rem' }}>
                        {b.is_wicket ? 'W' : b.extras_type === 'wide' ? 'Wd' : b.extras_type === 'noball' ? 'Nb' : b.runs === 0 ? '·' : b.runs}
                      </span>
                    ))}
                    {currentOverBalls.length === 0 && <span className="text-xs text-muted">First ball...</span>}
                  </div>

                  {/* Ball scoring buttons */}
                  <div className="card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', padding: '24px' }}>
                    <h3 className="font-bold text-center mb-16" style={{ fontSize: '1rem' }}>Record Delivery</h3>
                    
                    {/* Runs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
                      <button type="button" className="btn btn-secondary btn-lg" onClick={() => recordBall(0)} disabled={saving}>· Dot</button>
                      <button type="button" className="btn btn-secondary btn-lg" onClick={() => recordBall(1)} disabled={saving}>1</button>
                      <button type="button" className="btn btn-secondary btn-lg" onClick={() => recordBall(2)} disabled={saving}>2</button>
                      <button type="button" className="btn btn-secondary btn-lg" onClick={() => recordBall(3)} disabled={saving}>3</button>
                      <button type="button" className="btn btn-secondary btn-lg" style={{ color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }} onClick={() => recordBall(4)} disabled={saving}>4</button>
                      <button type="button" className="btn btn-secondary btn-lg" style={{ color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)' }} onClick={() => recordBall(6)} disabled={saving}>6</button>
                      <button type="button" className="btn btn-danger btn-lg" onClick={() => recordBall(0, null, true)} disabled={saving}>🔴 Wicket</button>
                      <button type="button" className="btn btn-secondary btn-lg" onClick={undoLastBall} disabled={saving}>↩ Undo</button>
                    </div>

                    {/* Extras */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      <button type="button" className="btn btn-ghost" onClick={() => recordBall(0, 'wide')} disabled={saving}>Wide</button>
                      <button type="button" className="btn btn-ghost" onClick={() => recordBall(0, 'noball')} disabled={saving}>No Ball</button>
                      <button type="button" className="btn btn-ghost" onClick={() => recordBall(1, 'bye')} disabled={saving}>Bye</button>
                      <button type="button" className="btn btn-ghost" onClick={() => recordBall(1, 'legbye')} disabled={saving}>Leg Bye</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Completed matches display */}
              {activeMatch.status === 'completed' && (
                <div className="card text-center max-w-md mx-auto">
                  <span style={{ fontSize: '3rem' }}>🏆</span>
                  <h2 className="font-bold mt-16 mb-8">Match Completed</h2>
                  <p className="text-secondary mb-24">{activeMatch.result_description}</p>
                  <Link href={`/tournament/${selectedTournamentId}`} className="btn btn-primary">
                    View Points Table
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <span className="empty-state-icon">🏏</span>
              <p className="empty-state-title">Select a Match to Record Score</p>
              <p className="empty-state-desc">Choose a tournament from the dropdown and select a scheduled match from the left panel.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default function RecordMatchPage() {
  return (
    <Suspense fallback={
      <div className="page-wrapper flex items-center justify-center">
        <div className="spinner" style={{ width: 45, height: 45 }} />
      </div>
    }>
      <RecordMatchConsole />
    </Suspense>
  );
}
