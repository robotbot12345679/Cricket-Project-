'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignUp(e) {
    e.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
    } else {
      // Set simple cookie for middleware check (no email verification for now)
      document.cookie = `sb-auth-token=${data.session?.access_token}; path=/; max-age=604800; SameSite=Lax`;
      router.push('/');
      router.refresh();
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-orb login-bg-orb-1" />
      <div className="login-bg-orb login-bg-orb-2" />

      <div className="login-container animate-fade-in">
        <div className="login-brand">
          <div className="login-brand-icon">🏏</div>
          <h1 className="login-brand-name">CricManager</h1>
          <p className="login-brand-sub">Your personal cricket tournament manager</p>
        </div>

        <div className="login-card">
          <h2 className="login-title">Create Account</h2>
          <p className="login-subtitle">Sign up to start managing tournaments</p>

          <form onSubmit={handleSignUp} className="login-form">
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                className="form-input form-input-lg"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input form-input-lg"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                type="password"
                className="form-input form-input-lg"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="login-error">
                <span>⚠</span> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full"
              disabled={loading}
            >
              {loading ? <><span className="spinner" /> Signing up…</> : 'Sign Up'}
            </button>
          </form>
        </div>

        <p className="login-footer-note">Already have an account? <a href="/login" className="text-primary underline">Log in</a></p>
      </div>

      <style jsx>{`
        .login-page { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-primary); position: relative; overflow: hidden; padding: 24px; }
        .login-bg-orb { position: fixed; border-radius: 50%; pointer-events: none; }
        .login-bg-orb-1 { width: 700px; height: 700px; top: -200px; right: -200px; background: radial-gradient(circle, rgba(61,114,245,0.12) 0%, transparent 65%); }
        .login-bg-orb-2 { width: 500px; height: 500px; bottom: -150px; left: -100px; background: radial-gradient(circle, rgba(108,79,255,0.1) 0%, transparent 65%); }
        .login-container { width: 100%; max-width: 420px; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 32px; }
        .login-brand { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px; }
        .login-brand-icon { width: 68px; height: 68px; background: var(--gradient-primary); border-radius: 20px; display: flex; align-items: center; justify-content: center; font-size: 36px; box-shadow: 0 8px 32px rgba(61,114,245,0.35); animation: pulse-glow 3s ease-in-out infinite; }
        .login-brand-name { font-size: 2rem; background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .login-brand-sub { color: var(--text-muted); font-size: 0.9rem; }
        .login-card { background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: var(--radius-xl); padding: 36px 32px; box-shadow: var(--shadow-card); }
        .login-title { font-size: 1.5rem; margin-bottom: 4px; }
        .login-subtitle { color: var(--text-muted); font-size: 0.9rem; margin-bottom: 28px; }
        .login-form { display: flex; flex-direction: column; gap: 20px; }
        .login-error { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.3); border-radius: var(--radius-sm); padding: 10px 14px; color: var(--accent-red); font-size: 0.875rem; display: flex; align-items: center; gap: 8px; }
        .login-footer-note { text-align: center; color: var(--text-muted); font-size: 0.8rem; }
      `}</style>
    </div>
  );
}
