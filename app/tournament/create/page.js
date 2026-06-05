'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import Modal from '@/components/Modal';

// Array of preset SVG icons and Emojis for the icon picker
const PRESET_ICONS = [
  '🏏', '🔥', '⚡', '🦁', '👑', '🦈', '🦅', '🐺', '🦊', '🐻',
  '🐅', '🐆', '🐊', '🐍', '🐉', '🐲', '🦄', '🐎', '🐂', '🐃',
  '🚀', '⚔️', '🛡️', '🎯', '⚓', '☄️', '🌪️', '🌊', '🌋', '⭐'
];

export default function CreateTournamentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  // Icon Picker State
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [activeTeamIndex, setActiveTeamIndex] = useState(null);

  // Form State
  const [name, setName] = useState('');
  const [teamCount, setTeamCount] = useState('8');
  const [oversLeague, setOversLeague] = useState('5');
  const [wicketsLeague, setWicketsLeague] = useState('10');
  const [leagueMatchesPerPair, setLeagueMatchesPerPair] = useState('1');
  const [qualifiersCount, setQualifiersCount] = useState('4');
  const [teams, setTeams] = useState([]);

  // Playoff state
  const [playoffs, setPlayoffs] = useState([
    { id: 'q1', name: 'Qualifier 1', typeA: 'position', valA: '1', typeB: 'position', valB: '2' },
    { id: 'elim', name: 'Eliminator', typeA: 'position', valA: '3', typeB: 'position', valB: '4' },
    { id: 'q2', name: 'Qualifier 2', typeA: 'winner', valA: 'elim', typeB: 'loser', valB: 'q1' },
    { id: 'final', name: 'Final', typeA: 'winner', valA: 'q1', typeB: 'winner', valB: 'q2' },
  ]);

  const generateTeams = () => {
    const c = parseInt(teamCount) || 2;
    setTeams(Array.from({ length: c }, (_, i) => ({
      name: `Team ${String.fromCharCode(65 + i)}`,
      emoji: PRESET_ICONS[i % PRESET_ICONS.length],
      color: `hsl(${(i * 360) / c}, 70%, 50%)`
    })));
  };

  useEffect(() => {
    generateTeams();
  }, [teamCount]);

  const updateTeam = (index, field, value) => {
    const newTeams = [...teams];
    newTeams[index][field] = value;
    setTeams(newTeams);
  };

  const addPlayoffRound = () => {
    setPlayoffs([...playoffs, {
      id: `p_${Date.now()}`,
      name: `Playoff ${playoffs.length + 1}`,
      typeA: 'position', valA: '1', typeB: 'position', valB: '2',
    }]);
  };

  const removePlayoffRound = (id) => setPlayoffs(playoffs.filter(p => p.id !== id));
  const updatePlayoff = (id, field, value) => setPlayoffs(playoffs.map(p => p.id === id ? { ...p, [field]: value } : p));
  const showModal = (title, message, type = 'info') => setModalConfig({ isOpen: true, title, message, type });
  const closeModal = () => setModalConfig({ ...modalConfig, isOpen: false });

  const validateAndNext = () => {
    if (step === 1 && !name.trim()) return showModal('Missing', 'Please enter a tournament name.', 'danger');
    if (step === 2 && teams.some(t => !t.name.trim())) return showModal('Missing', 'All teams must have a name.', 'danger');
    setStep(step + 1);
  };

  const handleCreate = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // 1. Create Tournament
      const { data: tournament, error: tErr } = await supabase
        .from('tournaments')
        .insert({
          name, created_by: user.id, status: 'setup',
          overs_league: parseInt(oversLeague) || 5,
          wickets_league: parseInt(wicketsLeague) || 10,
          qualifiers_count: parseInt(qualifiersCount) || 4,
          playoff_config: { rounds: playoffs }
        }).select().single();
      if (tErr) throw tErr;

      // 2. Insert Teams
      const { data: insertedTeams, error: teamsErr } = await supabase
        .from('teams')
        .insert(teams.map(t => ({ tournament_id: tournament.id, name: t.name, color: t.color, emoji: t.emoji })))
        .select();
      if (teamsErr) throw teamsErr;

      // 3. Generate League Matches (Round Robin avoiding back-to-back)
      let leagueMatches = [];
      const numRounds = parseInt(leagueMatchesPerPair) || 1;
      let matchNo = 1;

      for (let r = 0; r < numRounds; r++) {
        let rounds = [];
        let pool = [...insertedTeams];
        if (pool.length % 2 !== 0) pool.push(null);
        for (let i = 0; i < pool.length - 1; i++) {
          let round = [];
          for (let j = 0; j < pool.length / 2; j++) {
            round.push([pool[j], pool[pool.length - 1 - j]]);
          }
          rounds.push(round);
          pool.splice(1, 0, pool.pop());
        }
        rounds.forEach(round => {
          round.forEach(([t1, t2]) => {
            if (t1 && t2) leagueMatches.push({
              tournament_id: tournament.id, team1_id: t1.id, team2_id: t2.id, 
              stage: 'league', status: 'scheduled', match_number: matchNo++,
              overs: parseInt(oversLeague) || 5, wickets: parseInt(wicketsLeague) || 10
            });
          });
        });
      }
      
      const { error: matchesErr } = await supabase.from('matches').insert(leagueMatches);
      if (matchesErr) throw matchesErr;

      // 4. Generate Empty Post-League Matches
      const playoffMatches = playoffs.map((round) => ({
        tournament_id: tournament.id, team1_id: null, team2_id: null,
        stage: round.name, match_number: matchNo++,
        overs: parseInt(oversLeague) || 5, wickets: parseInt(wicketsLeague) || 10, status: 'scheduled'
      }));
      if (playoffMatches.length > 0) {
        const { error: pMatchesErr } = await supabase.from('matches').insert(playoffMatches);
        if (pMatchesErr) throw pMatchesErr;
      }

      router.push(`/tournament/${tournament.id}`);
    } catch (err) {
      showModal('Creation Failed', err.message, 'danger');
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <Navbar />

      <div className="progress-bar-wrapper">
        <div className="progress-steps">
          {[1, 2, 3].map((s) => (
            <div key={s} className="progress-step">
              <div className={`progress-step-circle ${step === s ? 'active' : step > s ? 'done' : 'pending'}`}>
                {step > s ? '✓' : s}
              </div>
              {s < 3 && <div className={`progress-step-line ${step > s ? 'done' : ''}`} />}
            </div>
          ))}
        </div>
      </div>

      <Modal isOpen={modalConfig.isOpen} title={modalConfig.title} message={modalConfig.message} type={modalConfig.type} onConfirm={closeModal} />

      {iconPickerOpen && (
        <div className="icon-picker-overlay" onClick={() => setIconPickerOpen(false)}>
          <div className="icon-picker-box animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold mb-16 text-center">Choose an Icon</h3>
            <div className="icon-grid">
              {PRESET_ICONS.map((icon, idx) => (
                <button key={idx} className="icon-picker-btn" onClick={() => { if (activeTeamIndex !== null) updateTeam(activeTeamIndex, 'emoji', icon); setIconPickerOpen(false); }}>{icon}</button>
              ))}
            </div>
            <button className="btn btn-secondary w-full mt-16" onClick={() => setIconPickerOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <main className="container" style={{ maxWidth: '600px', padding: '40px 16px' }}>
        <div className="card">
          {step === 1 && (
            <div className="flex flex-col gap-16">
              <h2 className="font-bold">Tournament Settings</h2>
              <div className="form-group">
                <label className="form-label">Tournament Name</label>
                <input type="text" className="form-input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-16">
                <div className="form-group">
                  <label className="form-label">Number of Teams</label>
                  <input type="number" className="form-input" value={teamCount} onChange={(e) => setTeamCount(e.target.value)} min="2" max="24" />
                </div>
                <div className="form-group">
                  <label className="form-label">Matches vs Same Team</label>
                  <input type="number" className="form-input" value={leagueMatchesPerPair} onChange={(e) => setLeagueMatchesPerPair(e.target.value)} min="1" max="5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-16">
                <div className="form-group">
                  <label className="form-label">Overs per Match</label>
                  <input type="number" className="form-input" value={oversLeague} onChange={(e) => setOversLeague(e.target.value)} min="1" max="50" />
                </div>
                <div className="form-group">
                  <label className="form-label">Wickets per Innings</label>
                  <input type="number" className="form-input" value={wicketsLeague} onChange={(e) => setWicketsLeague(e.target.value)} min="1" max="11" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Number of Teams to Qualify</label>
                <input type="number" className="form-input" value={qualifiersCount} onChange={(e) => setQualifiersCount(e.target.value)} min="1" max="10" />
              </div>
              <button className="btn btn-primary w-full mt-16" onClick={validateAndNext}>Next: Teams & Branding</button>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-16">
              <h2 className="font-bold">Teams Configuration</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '400px', overflowY: 'auto' }}>
                {teams.map((team, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <button type="button" className="form-input flex items-center justify-center cursor-pointer" style={{ width: '48px', height: '48px', padding: '0', fontSize: '1.25rem' }} onClick={() => { setActiveTeamIndex(idx); setIconPickerOpen(true); }}>
                      {team.emoji}
                    </button>
                    <input type="text" className="form-input flex-1" value={team.name} onChange={(e) => updateTeam(idx, 'name', e.target.value)} />
                    <input type="color" style={{ border: 'none', background: 'none', cursor: 'pointer', width: '36px', height: '36px' }} value={team.color} onChange={(e) => updateTeam(idx, 'color', e.target.value)} />
                  </div>
                ))}
              </div>
              <div className="flex gap-12 mt-16">
                <button className="btn btn-secondary flex-1" onClick={() => setStep(1)}>Back</button>
                <button className="btn btn-primary flex-1" onClick={validateAndNext}>Next: Playoffs</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-16">
              <h2 className="font-bold">Post-League Logic</h2>
              {playoffs.map((round) => (
                <div key={round.id} className="card" style={{ background: 'var(--bg-primary)' }}>
                  <div className="flex justify-between items-center mb-12">
                    <input type="text" className="form-input" value={round.name} onChange={(e) => updatePlayoff(round.id, 'name', e.target.value)} style={{ fontWeight: 'bold' }} />
                    <button className="btn btn-ghost text-red" onClick={() => removePlayoffRound(round.id)}>✕</button>
                  </div>
                  <div className="grid grid-cols-2 gap-12 text-sm">
                    <div>
                      <label className="text-muted block mb-4">Team 1</label>
                      <div className="flex gap-4">
                        <select className="form-input" value={round.typeA} onChange={(e) => updatePlayoff(round.id, 'typeA', e.target.value)}>
                          <option value="position">Position</option><option value="winner">Winner of</option><option value="loser">Loser of</option>
                        </select>
                        <input type="text" className="form-input" value={round.valA} onChange={(e) => updatePlayoff(round.id, 'valA', e.target.value)} placeholder="1, 2 or Match" />
                      </div>
                    </div>
                    <div>
                      <label className="text-muted block mb-4">Team 2</label>
                      <div className="flex gap-4">
                        <select className="form-input" value={round.typeB} onChange={(e) => updatePlayoff(round.id, 'typeB', e.target.value)}>
                          <option value="position">Position</option><option value="winner">Winner of</option><option value="loser">Loser of</option>
                        </select>
                        <input type="text" className="form-input" value={round.valB} onChange={(e) => updatePlayoff(round.id, 'valB', e.target.value)} placeholder="1, 2 or Match" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              <button className="btn btn-secondary" onClick={addPlayoffRound}>+ Add Playoff Match</button>
              <div className="flex gap-12 mt-16">
                <button className="btn btn-secondary flex-1" onClick={() => setStep(2)}>Back</button>
                <button className="btn btn-primary flex-1" onClick={handleCreate} disabled={loading}>{loading ? 'Creating...' : 'Create Tournament'}</button>
              </div>
            </div>
          )}
        </div>
      </main>

      <style jsx>{`
        .icon-picker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); z-index: 10000; display: flex; align-items: center; justify-content: center; padding: 24px; }
        .icon-picker-box { background: var(--bg-card); border: 1px solid var(--border-primary); border-radius: var(--radius-xl); padding: 24px; max-width: 320px; width: 100%; box-shadow: 0 20px 60px rgba(0,0,0,0.5); }
        .icon-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; max-height: 300px; overflow-y: auto; padding: 4px; }
        .icon-picker-btn { background: var(--bg-secondary); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); font-size: 1.5rem; padding: 8px 0; cursor: pointer; transition: var(--transition); }
        .icon-picker-btn:hover { background: rgba(61,114,245,0.1); border-color: var(--accent-primary); transform: scale(1.1); }
      `}</style>
    </div>
  );
}
