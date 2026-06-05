'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';

export default function CreateTournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [numTeams, setNumTeams] = useState(4);
  const [teams, setTeams] = useState([
    { name: 'Team A', shortName: 'TA', color: '#3d72f5' },
    { name: 'Team B', shortName: 'TB', color: '#ef4444' },
    { name: 'Team C', shortName: 'TC', color: '#22c55e' },
    { name: 'Team D', shortName: 'TD', color: '#f59e0b' },
  ]);
  const [oversLeague, setOversLeague] = useState(5);
  const [wicketsLeague, setWicketsLeague] = useState(1); // Default 1 wicket per team, configurable
  const [leagueMatchesPerPair, setLeagueMatchesPerPair] = useState(1);
  const [pointsWin, setPointsWin] = useState(2);
  const [pointsLoss, setPointsLoss] = useState(0);
  const [pointsNr, setPointsNr] = useState(1);
  const [qualifyingTeams, setQualifyingTeams] = useState(4);

  // Playoff state: list of custom playoff matches/rounds
  const [playoffs, setPlayoffs] = useState([
    { id: 'q1', name: 'Qualifier 1', overs: 5, wickets: 1, typeA: 'position', valA: '1', typeB: 'position', valB: '2' },
    { id: 'elim', name: 'Eliminator', overs: 5, wickets: 1, typeA: 'position', valA: '3', typeB: 'position', valB: '4' },
    { id: 'q2', name: 'Qualifier 2', overs: 5, wickets: 1, typeA: 'winner', valA: 'elim', typeB: 'loser', valB: 'q1' },
    { id: 'final', name: 'Final', overs: 5, wickets: 1, typeA: 'winner', valA: 'q1', typeB: 'winner', valB: 'q2' },
  ]);

  // Adjust teams array when number of teams changes
  const handleNumTeamsChange = (val) => {
    const n = parseInt(val, 10) || 2;
    setNumTeams(n);
    const newTeams = [...teams];
    if (newTeams.length < n) {
      const defaultColors = ['#3d72f5', '#ef4444', '#22c55e', '#f59e0b', '#6c4fff', '#06b6d4', '#ec4899', '#f97316', '#a855f7', '#64748b'];
      for (let i = newTeams.length; i < n; i++) {
        const char = String.fromCharCode(65 + i);
        newTeams.push({
          name: `Team ${char}`,
          shortName: `T${char}`,
          color: defaultColors[i % defaultColors.length],
        });
      }
    } else if (newTeams.length > n) {
      newTeams.splice(n);
    }
    setTeams(newTeams);
  };

  const updateTeam = (index, field, value) => {
    const newTeams = [...teams];
    newTeams[index][field] = value;
    setTeams(newTeams);
  };

  const addPlayoffRound = () => {
    const id = `p_${Date.now()}`;
    setPlayoffs([...playoffs, {
      id,
      name: `Playoff ${playoffs.length + 1}`,
      overs: oversLeague,
      wickets: wicketsLeague,
      typeA: 'position',
      valA: '1',
      typeB: 'position',
      valB: '2',
    }]);
  };

  const removePlayoffRound = (id) => {
    setPlayoffs(playoffs.filter(p => p.id !== id));
  };

  const updatePlayoff = (id, field, value) => {
    setPlayoffs(playoffs.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const validateAndNext = () => {
    setError('');
    if (step === 1 && !name.trim()) {
      setError('Please enter a tournament name.');
      return;
    }
    if (step === 2) {
      if (teams.some(t => !t.name.trim())) {
        setError('All teams must have a name.');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleCreate = async () => {
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // 1. Insert Tournament
      const { data: tournament, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name,
          created_by: user.id,
          overs_league: oversLeague,
          wickets_league: wicketsLeague,
          league_matches_per_pair: leagueMatchesPerPair,
          status: 'league',
          points_win: pointsWin,
          points_loss: pointsLoss,
          points_nr: pointsNr,
          playoff_config: {
            qualifying_teams: qualifyingTeams,
            rounds: playoffs,
          },
        })
        .select()
        .single();

      if (tErr) throw tErr;

      // 2. Insert Teams
      const teamsToInsert = teams.map(t => ({
        tournament_id: tournament.id,
        name: t.name,
        color: t.color,
        emoji: t.shortName,
      }));

      const { data: insertedTeams, error: teamsErr } = await supabase
        .from('teams')
        .insert(teamsToInsert)
        .select();

      if (teamsErr) throw teamsErr;

      // Map team name to ID for league matching
      const teamIdMap = {};
      insertedTeams.forEach(t => {
        teamIdMap[t.name] = t.id;
      });

      // 3. Auto-Generate League Matches (Round Robin)
      const leagueMatches = [];
      let matchNo = 1;
      for (let round = 0; round < leagueMatchesPerPair; round++) {
        for (let i = 0; i < insertedTeams.length; i++) {
          for (let j = i + 1; j < insertedTeams.length; j++) {
            // Swap home/away alternately per round
            const home = round % 2 === 0 ? insertedTeams[i] : insertedTeams[j];
            const away = round % 2 === 0 ? insertedTeams[j] : insertedTeams[i];
            leagueMatches.push({
              tournament_id: tournament.id,
              team1_id: home.id,
              team2_id: away.id,
              stage: 'league',
              match_number: matchNo++,
              overs: oversLeague,
              wickets: wicketsLeague,
              status: 'scheduled',
            });
          }
        }
      }

      const { error: matchesErr } = await supabase
        .from('matches')
        .insert(leagueMatches);

      if (matchesErr) throw matchesErr;

      // 4. Generate Empty Post-League Matches (TBD)
      const playoffMatches = playoffs.map((round, idx) => ({
        tournament_id: tournament.id,
        team1_id: null, // TBD
        team2_id: null, // TBD
        stage: round.name,
        match_number: matchNo++,
        overs: round.overs,
        wickets: round.wickets || wicketsLeague,
        status: 'scheduled',
      }));

      if (playoffMatches.length > 0) {
        const { error: pMatchesErr } = await supabase
          .from('matches')
          .insert(playoffMatches);
        if (pMatchesErr) throw pMatchesErr;
      }

      router.push(`/tournament/${tournament.id}`);
      router.refresh();
    } catch (err) {
      setError(err.message || 'Something went wrong during creation.');
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      {/* Progress Bar */}
      <div className="progress-bar-wrapper">
        <div className="progress-steps">
          {[1, 2, 3, 4, 5, 6, 7].map((s) => (
            <div key={s} className="progress-step">
              <div className={`progress-step-circle ${step === s ? 'active' : step > s ? 'done' : 'pending'}`}>
                {step > s ? '✓' : s}
              </div>
              {s < 7 && <div className={`progress-step-line ${step > s ? 'done' : ''}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between max-w-xl mx-auto mt-8 text-xs text-muted">
          <span>1. Info</span>
          <span>2. Teams</span>
          <span>3. Overs</span>
          <span>4. Points</span>
          <span>5. Qualify</span>
          <span>6. Playoffs</span>
          <span>7. Review</span>
        </div>
      </div>

      <main className="container" style={{ maxWidth: '600px', padding: '40px 16px', position: 'relative', zIndex: 1 }}>
        <div className="card animate-fade-in" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
          {error && <div className="form-error mb-16" style={{ background: 'rgba(239,68,68,0.1)', padding: '12px', borderRadius: '8px' }}>{error}</div>}

          {/* STEP 1: General Info */}
          {step === 1 && (
            <div className="flex flex-col gap-16">
              <h2 className="font-bold mb-8">Tournament Details</h2>
              <div className="form-group">
                <label className="form-label">Tournament Name</label>
                <input
                  type="text"
                  className="form-input form-input-lg"
                  placeholder="e.g. Street Premier League 2026"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 2: Teams Setup */}
          {step === 2 && (
            <div className="flex flex-col gap-16">
              <h2 className="font-bold">Teams Configuration</h2>
              <div className="form-group">
                <label className="form-label">Number of Teams</label>
                <input
                  type="number"
                  min="2"
                  max="12"
                  className="form-input"
                  value={numTeams}
                  onChange={(e) => handleNumTeamsChange(e.target.value)}
                />
              </div>
              <div className="divider" style={{ margin: '8px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto', paddingRight: '8px' }}>
                {teams.map((team, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ width: '50px', textAlign: 'center', padding: '10px 0' }}
                      value={team.shortName}
                      onChange={(e) => updateTeam(idx, 'shortName', e.target.value)}
                      placeholder="Short"
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder={`Team ${idx + 1}`}
                      value={team.name}
                      onChange={(e) => updateTeam(idx, 'name', e.target.value)}
                    />
                    <input
                      type="color"
                      style={{ border: 'none', background: 'none', cursor: 'pointer', width: '36px', height: '36px' }}
                      value={team.color}
                      onChange={(e) => updateTeam(idx, 'color', e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Match Settings (Overs & Wickets) */}
          {step === 3 && (
            <div className="flex flex-col gap-16">
              <h2 className="font-bold">League Match Settings</h2>
              <div className="form-group">
                <label className="form-label">Overs per Innings (League)</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  className="form-input form-input-lg"
                  value={oversLeague}
                  onChange={(e) => setOversLeague(parseInt(e.target.value) || 5)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Wickets per Innings (Default: 1 for Gully/Street style)</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  className="form-input form-input-lg"
                  value={wicketsLeague}
                  onChange={(e) => setWicketsLeague(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Matches per pair (League rounds)</label>
                <select
                  className="form-input form-input-lg"
                  value={leagueMatchesPerPair}
                  onChange={(e) => setLeagueMatchesPerPair(parseInt(e.target.value))}
                >
                  <option value={1}>Each plays once (Single Round Robin)</option>
                  <option value={2}>Each plays twice (Home & Away)</option>
                </select>
              </div>
            </div>
          )}

          {/* STEP 4: Points Config */}
          {step === 4 && (
            <div className="flex flex-col gap-16">
              <h2 className="font-bold">Points System Configuration</h2>
              <div className="form-group">
                <label className="form-label">Points for Win</label>
                <input
                  type="number"
                  className="form-input"
                  value={pointsWin}
                  onChange={(e) => setPointsWin(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Points for Loss</label>
                <input
                  type="number"
                  className="form-input"
                  value={pointsLoss}
                  onChange={(e) => setPointsLoss(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Points for No Result / Tie (unscored)</label>
                <input
                  type="number"
                  className="form-input"
                  value={pointsNr}
                  onChange={(e) => setPointsNr(parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
          )}

          {/* STEP 5: Qualification Limit */}
          {step === 5 && (
            <div className="flex flex-col gap-16">
              <h2 className="font-bold">Post-League Standing Settings</h2>
              <div className="form-group">
                <label className="form-label">How many teams qualify for Playoffs?</label>
                <input
                  type="number"
                  min="2"
                  max={numTeams}
                  className="form-input form-input-lg"
                  value={qualifyingTeams}
                  onChange={(e) => setQualifyingTeams(parseInt(e.target.value) || 4)}
                />
              </div>
              <p className="text-sm text-muted">
                Usually, top 4 teams qualify in a standard T20/IPL tournament. Customize as per your requirement.
              </p>
            </div>
          )}

          {/* STEP 6: Playoff Builder */}
          {step === 6 && (
            <div className="flex flex-col gap-16">
              <div className="flex justify-between items-center">
                <h2 className="font-bold">Playoff Bracket Builder</h2>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addPlayoffRound}>+ Add Round</button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
                {playoffs.map((playoff, idx) => (
                  <div key={playoff.id} className="card" style={{ background: 'var(--bg-primary)', padding: '16px' }}>
                    <div className="flex justify-between items-center mb-8">
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontWeight: 'bold', width: '60%' }}
                        value={playoff.name}
                        onChange={(e) => updatePlayoff(playoff.id, 'name', e.target.value)}
                      />
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => removePlayoffRound(playoff.id)}>Remove</button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div className="form-group">
                        <label className="form-label">Overs</label>
                        <input
                          type="number"
                          className="form-input"
                          value={playoff.overs}
                          onChange={(e) => updatePlayoff(playoff.id, 'overs', parseInt(e.target.value) || oversLeague)}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Wickets</label>
                        <input
                          type="number"
                          className="form-input"
                          value={playoff.wickets || wicketsLeague}
                          onChange={(e) => updatePlayoff(playoff.id, 'wickets', parseInt(e.target.value) || wicketsLeague)}
                        />
                      </div>
                    </div>

                    <div className="divider" style={{ margin: '8px 0' }} />

                    {/* Team A setup */}
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                      <span className="text-xs text-muted" style={{ width: '60px' }}>Team A:</span>
                      <select
                        className="form-input"
                        value={playoff.typeA}
                        onChange={(e) => updatePlayoff(playoff.id, 'typeA', e.target.value)}
                      >
                        <option value="position">Table Position</option>
                        <option value="winner">Winner of</option>
                        <option value="loser">Loser of</option>
                      </select>
                      <input
                        type="text"
                        className="form-input"
                        style={{ width: '100px' }}
                        value={playoff.valA}
                        onChange={(e) => updatePlayoff(playoff.id, 'valA', e.target.value)}
                        placeholder="e.g. 1 or q1"
                      />
                    </div>

                    {/* Team B setup */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className="text-xs text-muted" style={{ width: '60px' }}>Team B:</span>
                      <select
                        className="form-input"
                        value={playoff.typeB}
                        onChange={(e) => updatePlayoff(playoff.id, 'typeB', e.target.value)}
                      >
                        <option value="position">Table Position</option>
                        <option value="winner">Winner of</option>
                        <option value="loser">Loser of</option>
                      </select>
                      <input
                        type="text"
                        className="form-input"
                        style={{ width: '100px' }}
                        value={playoff.valB}
                        onChange={(e) => updatePlayoff(playoff.id, 'valB', e.target.value)}
                        placeholder="e.g. 2 or elim"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 7: Review & Confirm */}
          {step === 7 && (
            <div className="flex flex-col gap-16">
              <h2 className="font-bold">Review Tournament</h2>
              <div>
                <p className="text-sm text-secondary">Name: <strong className="text-primary">{name}</strong></p>
                <p className="text-sm text-secondary">Teams: <strong className="text-primary">{teams.map(t => `${t.shortName} - ${t.name}`).join(', ')}</strong></p>
                <p className="text-sm text-secondary">Overs (League): <strong className="text-primary">{oversLeague} overs</strong></p>
                <p className="text-sm text-secondary">Wickets (League): <strong className="text-primary">{wicketsLeague} wickets</strong></p>
                <p className="text-sm text-secondary">Points: <strong className="text-primary">Win: {pointsWin} | Loss: {pointsLoss} | NR: {pointsNr}</strong></p>
                <p className="text-sm text-secondary">Playoffs Qualifying Limit: <strong className="text-primary">Top {qualifyingTeams} Teams</strong></p>
                <p className="text-sm text-secondary">Playoff Stages: <strong className="text-primary">{playoffs.map(p => p.name).join(' → ') || 'None'}</strong></p>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-24">
            {step > 1 ? (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep(step - 1)}
                disabled={loading}
              >
                Back
              </button>
            ) : (
              <div />
            )}

            {step < 7 ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={validateAndNext}
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : 'Create Tournament'}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
