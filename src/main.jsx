import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronRight,
  Eye,
  EyeOff,
  LogOut,
  Mail,
  MonitorSmartphone,
  PanelTop,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

import { getSupabaseStatus, supabase } from './lib/supabaseClient';
import './styles.css';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState('sign-in');

  const supabaseStatus = useMemo(() => getSupabaseStatus(), []);

  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (!supabase) {
        if (isMounted) setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        setSession(data.session ?? null);
        setLoading(false);
      }
    }

    init();

    if (!supabase) return undefined;

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession ?? null);
      if (event === 'SIGNED_OUT') setMessage('Signed out.');
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!supabase) {
      setMessage('Supabase is not configured yet. Add the .env values first.');
      return;
    }

    const email = form.email.trim();
    const password = form.password;

    if (!email || !password) {
      setMessage('Enter both email and password.');
      return;
    }

    const action = mode === 'sign-up'
      ? supabase.auth.signUp({ email, password })
      : supabase.auth.signInWithPassword({ email, password });

    const { error } = await action;

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(mode === 'sign-up'
      ? 'Account request sent. Check your email if confirmation is enabled.'
      : 'Signed in successfully.');
    setForm((current) => ({ ...current, password: '' }));
  }

  async function handleSignOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage('Signed out.');
  }

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="topbar">
        <div className="brand-mark">
          <img src="/forced-logic-logo.png" alt="Forced Logic logo" />
        </div>
        <div className="brand-copy">
          <p className="eyebrow">Precision engineered software</p>
          <h1>Forced Logic</h1>
          <p className="tagline">Engineering the Future of Desktop and Mobile Experiences</p>
          <p className="subtag">Performance-Driven Development</p>
        </div>
        <nav className="nav">
          <a href="#auth">Login</a>
          <a href="#services">Services</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <div>
              <p className="section-kicker">Operational Software</p>
              <h2>Built for live systems, not generic pages.</h2>
              <p className="hero-text">
                Forced Logic builds focused software systems that combine clean design,
                responsive behavior, and practical performance for desktop and mobile workflows.
              </p>
              <div className="hero-actions">
                <a className="button primary" href="#auth">
                  Access the site
                  <ChevronRight size={14} />
                </a>
                <a className="button secondary" href="#services">
                  Explore solutions
                </a>
              </div>
            </div>

            <div className="signal-row">
              <div>
                <span>Desktop</span>
                <strong>React / Vite</strong>
              </div>
              <div>
                <span>Mobile</span>
                <strong>Responsive builds</strong>
              </div>
              <div>
                <span>Systems</span>
                <strong>Operational tools</strong>
              </div>
            </div>
          </div>

          <div className="hero-panel">
            <div className="panel-card core-card">
              <p className="panel-label">Current Focus</p>
              <h3>Precision. Control. Reliability.</h3>
              <p>
                Minimal overhead, clear structure, and software that stays organized under pressure.
              </p>
              <div className="status-chip">
                <span className={supabaseStatus.ready ? 'dot dot-on' : 'dot dot-off'} />
                <span>
                  {supabaseStatus.ready ? 'Supabase wiring ready' : 'Supabase not configured yet'}
                </span>
              </div>
            </div>

            <div className="panel-grid">
              <article>
                <span>01</span>
                <h4><MonitorSmartphone size={16} /> Desktop applications</h4>
                <p>Interfaces that stay sharp, readable, and efficient.</p>
              </article>
              <article>
                <span>02</span>
                <h4><Workflow size={16} /> Mobile experiences</h4>
                <p>Layouts that adapt cleanly without losing structure.</p>
              </article>
              <article>
                <span>03</span>
                <h4><PanelTop size={16} /> Reactive workspaces</h4>
                <p>Modular systems built around live state and practical use.</p>
              </article>
              <article>
                <span>04</span>
                <h4><ShieldCheck size={16} /> Secure access</h4>
                <p>Login-first structure with session state and backend auth support.</p>
              </article>
            </div>
          </div>
        </section>

        <section id="auth" className="section-block auth-block">
          <div className="section-heading">
            <p className="section-kicker">Login</p>
            <h2>{session ? 'You are signed in.' : 'Access the site.'}</h2>
          </div>

          {loading ? (
            <p className="approach-text">Loading session...</p>
          ) : session ? (
            <div className="auth-session">
              <div className="auth-session-copy">
                <p className="auth-label">Active session</p>
                <h3>{session.user.email}</h3>
                <p className="approach-text">
                  You are signed in to the Forced Logic workspace. This page can now be used as a controlled entry point.
                </p>
              </div>
              <button className="button primary" type="button" onClick={handleSignOut}>
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              <label>
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="you@example.com"
                />
              </label>
              <label>
                <span>Password</span>
                <div className="password-field">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    placeholder="Your password"
                  />
                  <button
                    className="password-toggle"
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <div className="auth-actions">
                <button className="button primary" type="submit">
                  {mode === 'sign-up' ? 'Create account' : 'Sign in'}
                </button>
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setMode((current) => (current === 'sign-up' ? 'sign-in' : 'sign-up'))}
                >
                  {mode === 'sign-up' ? 'Switch to sign in' : 'Switch to sign up'}
                </button>
              </div>

              <p className="auth-note">
                {mode === 'sign-up'
                  ? 'If email confirmation is enabled in Supabase, check your inbox after creating the account.'
                  : 'Use your Supabase auth user to sign in here.'}
              </p>
            </form>
          )}

          {message ? <p className="auth-message">{message}</p> : null}
        </section>

        <section id="services" className="section-block">
          <div className="section-heading">
            <p className="section-kicker">What we build</p>
            <h2>Software systems with a clear operating purpose.</h2>
          </div>
          <div className="service-grid">
            <article>
              <h3>Product landing pages</h3>
              <p>Fast, polished, and focused on getting the right message across.</p>
            </article>
            <article>
              <h3>Operator dashboards</h3>
              <p>Interfaces for live state, telemetry, and action without clutter.</p>
            </article>
            <article>
              <h3>Internal tools</h3>
              <p>Purpose-built systems for workflows that need structure and speed.</p>
            </article>
          </div>
        </section>

        <section id="approach" className="section-block split">
          <div>
            <p className="section-kicker">Approach</p>
            <h2>Simple front end. Strong structure. No unnecessary noise.</h2>
          </div>
          <p className="approach-text">
            The goal is to keep the UI clean enough to stay understandable and strong enough
            to handle serious work. Everything should feel deliberate, not crowded.
          </p>
        </section>

        <section id="contact" className="contact-block">
          <div>
            <p className="section-kicker">Start here</p>
            <h2>Ready for the next build.</h2>
            <p>One site, one system, one clean front door for the work.</p>
          </div>
          <a className="button primary" href="mailto:hello@forced-logic.com">
            <Mail size={14} />
            Contact Us
          </a>
        </section>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
