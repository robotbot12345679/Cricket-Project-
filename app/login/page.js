'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // { text, type: 'error'|'success' }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (!email || !password) {
      setMessage({ text: 'Please enter both email and password.', type: 'error' });
      setLoading(false);
      return;
    }

    if (mode === 'signin') {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage({ text: error.message, type: 'error' });
        setLoading(false);
      } else {
        document.cookie = `sb-auth-token=${data.session.access_token}; path=/; max-age=604800; SameSite=Lax`;
        router.push('/');
        router.refresh();
      }
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage({ text: error.message, type: 'error' });
        setLoading(false);
      } else if (data?.session) {
        document.cookie = `sb-auth-token=${data.session.access_token}; path=/; max-age=604800; SameSite=Lax`;
        router.push('/');
        router.refresh();
      } else {
        setMessage({ text: 'Account created! Check your email for the confirmation link.', type: 'success' });
        setLoading(false);
      }
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0c0f1e',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background blobs */}
      <div style={{
        position: 'fixed', top: '-200px', right: '-150px',
        width: '600px', height: '600px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79,122,248,0.1) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: '-150px', left: '-100px',
        width: '500px', height: '500px', borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,92,252,0.08) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative', zIndex: 1 }} className="animate-fade-in">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <div style={{
            width: '58px', height: '58px', margin: '0 auto 14px',
            background: 'linear-gradient(135deg, #4f7af8, #7c5cfc)',
            borderRadius: '16px', display: 'flex', alignItems: 'center',
            justifyContent: 'center', boxShadow: '0 8px 28px rgba(79,122,248,0.4)',
            animation: 'pulse-glow 3s ease-in-out infinite',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 17l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12l10 5 10-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, color: '#eef2ff' }}>
            CricManager
          </h1>
          <p style={{ color: '#4b5680', fontSize: '0.9rem', marginTop: '4px' }}>
            Your cricket tournament platform
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#161b2e', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: '20px', padding: '32px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}>
          {/* Tabs */}
          <div style={{
            display: 'flex', background: '#1c2238', borderRadius: '12px',
            padding: '4px', marginBottom: '28px', gap: '4px',
          }}>
            {['signin', 'signup'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setMessage(null); }}
                style={{
                  flex: 1, padding: '9px', border: 'none', cursor: 'pointer',
                  borderRadius: '9px', fontWeight: 600, fontSize: '0.9rem',
                  fontFamily: "'Inter', sans-serif",
                  background: mode === m ? 'linear-gradient(135deg, #4f7af8, #7c5cfc)' : 'transparent',
                  color: mode === m ? 'white' : '#4b5680',
                  transition: 'all 0.2s ease',
                  boxShadow: mode === m ? '0 2px 10px rgba(79,122,248,0.4)' : 'none',
                }}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Message */}
            {message && (
              <div style={{
                padding: '12px 16px', borderRadius: '10px', fontSize: '0.875rem',
                background: message.type === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                color: message.type === 'error' ? '#ef4444' : '#22c55e',
                border: `1px solid ${message.type === 'error' ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}`,
              }}>
                {message.text}
              </div>
            )}

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.83rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.02em' }}>
                EMAIL ADDRESS
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                style={{
                  background: '#1c2238', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '12px', padding: '13px 16px', fontSize: '0.95rem',
                  color: '#eef2ff', fontFamily: "'Inter', sans-serif", outline: 'none',
                  width: '100%', transition: 'border-color 0.2s ease',
                }}
                onFocus={e => { e.target.style.borderColor = '#4f7af8'; e.target.style.boxShadow = '0 0 0 3px rgba(79,122,248,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.83rem', fontWeight: 600, color: '#94a3b8', letterSpacing: '0.02em' }}>
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                style={{
                  background: '#1c2238', border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: '12px', padding: '13px 16px', fontSize: '0.95rem',
                  color: '#eef2ff', fontFamily: "'Inter', sans-serif", outline: 'none',
                  width: '100%', transition: 'border-color 0.2s ease',
                }}
                onFocus={e => { e.target.style.borderColor = '#4f7af8'; e.target.style.boxShadow = '0 0 0 3px rgba(79,122,248,0.15)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.07)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                background: 'linear-gradient(135deg, #4f7af8, #7c5cfc)',
                color: 'white', border: 'none', borderRadius: '12px',
                padding: '14px', fontWeight: 700, fontSize: '1rem',
                fontFamily: "'Inter', sans-serif", cursor: loading ? 'not-allowed' : 'pointer',
                width: '100%', marginTop: '6px',
                boxShadow: '0 4px 16px rgba(79,122,248,0.4)',
                opacity: loading ? 0.7 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                transition: 'opacity 0.2s, transform 0.2s',
              }}
              onMouseOver={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseOut={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              {loading ? (
                <>
                  <span style={{ width: '18px', height: '18px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                  Processing…
                </>
              ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 8px 28px rgba(79,122,248,0.4); }
          50% { box-shadow: 0 8px 40px rgba(79,122,248,0.7); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fadeIn 0.35s ease both; }
        input::placeholder { color: #4b5680 !important; }
      `}</style>
    </div>
  );
}
