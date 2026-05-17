import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronRight,
  CirclePlus,
  Eye,
  EyeOff,
  KeyRound,
  LogOut,
  Mail,
  MonitorSmartphone,
  PanelTop,
  ShieldCheck,
  Workflow,
} from 'lucide-react';

import { getSupabaseStatus, supabase } from './lib/supabaseClient';
import './styles.css';

const defaultWorkspaceCards = [
  {
    badge: 'Ready',
    title: 'Live workspace',
    body: 'This private layer is the first authenticated surface for Forced Logic.',
    note: 'Swap these defaults out for rows in Supabase when you are ready.',
  },
  {
    badge: 'Next',
    title: 'Private modules',
    body: 'Add admin tools, content blocks, and project areas here behind login.',
    note: 'This section is now wired to accept rows from the database.',
  },
  {
    badge: 'Status',
    title: 'Deployment',
    body: 'GitHub Pages serves the app and the workflow is already connected.',
    note: 'Future pushes will update the live URL automatically.',
  },
  {
    badge: 'Control',
    title: 'Supabase data',
    body: 'Workspace cards and approved users both live in Supabase tables.',
    note: 'Use the schema file to create the tables in the project.',
  },
];

const defaultAdminForm = {
  badge: '',
  title: '',
  body: '',
  note: '',
  order_index: '0',
  is_active: true,
};

const defaultAccessForm = {
  email: '',
  display_name: '',
  can_admin: false,
};

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessLoading, setAccessLoading] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [canAdmin, setCanAdmin] = useState(false);
  const [workspaceCards, setWorkspaceCards] = useState(defaultWorkspaceCards);
  const [approvedUsers, setApprovedUsers] = useState([]);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState('Workspace table not loaded yet.');
  const [workspaceActionStatus, setWorkspaceActionStatus] = useState('');
  const [adminForm, setAdminForm] = useState(defaultAdminForm);
  const [accessForm, setAccessForm] = useState(defaultAccessForm);

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
      if (event === 'SIGNED_OUT') {
        setHasAccess(false);
        setCanAdmin(false);
        setWorkspaceCards(defaultWorkspaceCards);
        setApprovedUsers([]);
        setWorkspaceStatus('Signed out.');
        setWorkspaceActionStatus('');
      }
    });

    return () => {
      isMounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      if (!supabase || !session?.user?.email) return;

      setAccessLoading(true);
      setWorkspaceStatus('Checking access...');
      setWorkspaceActionStatus('');

      const email = session.user.email.toLowerCase();
      const [{ data: approvalRows, error: approvalError }, { data: cards, error: cardsError }] =
        await Promise.all([
          supabase
            .from('approved_users')
            .select('email, display_name, active')
            .eq('email', email)
            .maybeSingle(),
          supabase
            .from('workspace_cards')
            .select('id, title, body, note, badge, order_index, is_active')
            .eq('is_active', true)
            .order('order_index', { ascending: true }),
        ]);

      if (cancelled) return;

      if (approvalError) {
        setHasAccess(false);
        setWorkspaceStatus(`Approval check unavailable: ${approvalError.message}`);
        setMessage('Login succeeded, but workspace approval could not be confirmed.');
        setAccessLoading(false);
        return;
      }

      if (!approvalRows) {
        setHasAccess(false);
        setCanAdmin(false);
        setWorkspaceStatus('Access denied for this email.');
        setMessage('This account is not on the approved access list.');
        await supabase.auth.signOut();
        setAccessLoading(false);
        return;
      }

      setHasAccess(true);
      setCanAdmin(Boolean(approvalRows.can_admin));
      setWorkspaceStatus(
        approvalRows.display_name
          ? `Approved for ${approvalRows.display_name}.`
          : 'Approved user detected.',
      );

      const { data: cardRows, error: cardError } = await supabase
        .from('workspace_cards')
        .select('id, title, body, note, badge, order_index, is_active')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (approvalRows.can_admin) {
        const { data: accessRows, error: accessError } = await supabase
          .from('approved_users')
          .select('email, display_name, can_admin, active, created_at')
          .order('email', { ascending: true });

        if (accessError) {
          setApprovedUsers([]);
          setWorkspaceStatus(`Approved user table unavailable: ${accessError.message}`);
        } else {
          setApprovedUsers(accessRows ?? []);
        }
      }

      if (cardError) {
        setWorkspaceCards(defaultWorkspaceCards);
        setWorkspaceStatus(`Using fallback cards because the workspace table is not ready: ${cardError.message}`);
      } else if (cardRows?.length) {
        setWorkspaceCards(cardRows);
      } else {
        setWorkspaceCards(defaultWorkspaceCards);
        setWorkspaceStatus('Workspace table is connected, but no cards have been added yet.');
      }

      setAccessLoading(false);
    }

    if (session) {
      loadWorkspace();
    } else {
      setHasAccess(false);
      setAccessLoading(false);
      setWorkspaceCards(defaultWorkspaceCards);
      setWorkspaceStatus('Login required.');
    }

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage('');

    if (!supabase) {
      setMessage('Supabase is not configured yet. Add the .env values first.');
      return;
    }

    const email = form.email.trim().toLowerCase();
    const password = form.password;

    if (!email || !password) {
      setMessage('Enter both email and password.');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Signed in successfully.');
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

  async function handleAddWorkspaceCard(event) {
    event.preventDefault();
    setWorkspaceActionStatus('');

    if (!supabase || !canAdmin) {
      setWorkspaceActionStatus('Admin access is required to add workspace cards.');
      return;
    }

    const payload = {
      badge: adminForm.badge.trim(),
      title: adminForm.title.trim(),
      body: adminForm.body.trim(),
      note: adminForm.note.trim(),
      order_index: Number(adminForm.order_index) || 0,
      is_active: Boolean(adminForm.is_active),
    };

    if (!payload.badge || !payload.title || !payload.body) {
      setWorkspaceActionStatus('Badge, title, and body are required.');
      return;
    }

    const { error } = await supabase.from('workspace_cards').insert(payload);

    if (error) {
      setWorkspaceActionStatus(error.message);
      return;
    }

    setWorkspaceActionStatus('Workspace card added.');
    setAdminForm(defaultAdminForm);
  }

  async function handleAddApprovedUser(event) {
    event.preventDefault();
    setWorkspaceActionStatus('');

    if (!supabase || !canAdmin) {
      setWorkspaceActionStatus('Admin access is required to add approved users.');
      return;
    }

    const payload = {
      email: accessForm.email.trim().toLowerCase(),
      display_name: accessForm.display_name.trim(),
      can_admin: Boolean(accessForm.can_admin),
      active: true,
    };

    if (!payload.email) {
      setWorkspaceActionStatus('Email is required.');
      return;
    }

    const { error } = await supabase.from('approved_users').upsert(payload);

    if (error) {
      setWorkspaceActionStatus(error.message);
      return;
    }

    setWorkspaceActionStatus('Approved user saved.');
    setAccessForm(defaultAccessForm);
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
          <a href="#workspace">Workspace</a>
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
                <a className="button secondary" href="#workspace">
                  View workspace
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
                  You are signed in to the Forced Logic workspace. This page now gates the private area.
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
                    autoComplete="current-password"
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

              <button className="button primary" type="submit">
                Sign in
              </button>

              <p className="auth-note">
                This site uses approved accounts only. Sign-up is disabled on purpose.
              </p>
            </form>
          )}

          {message ? <p className="auth-message">{message}</p> : null}
        </section>

        {session ? (
          <section id="workspace" className="section-block dashboard-block">
            <div className="section-heading">
              <p className="section-kicker">Workspace</p>
              <h2>Post-login control panel.</h2>
            </div>
            <div className="dashboard-grid">
              <article className="dashboard-card dashboard-primary">
                <p className="panel-label">Live Entry</p>
                <h3>Forced Logic control panel</h3>
                <p>
                  This is the first authenticated layer of the site. It now pulls private workspace
                  content from Supabase and keeps the public page clean.
                </p>
                <div className="dashboard-actions">
                  <a className="button primary" href="#services">
                    View services
                  </a>
                  <a className="button secondary" href="#contact">
                    Contact
                  </a>
                </div>
              </article>

              {workspaceCards.map((card) => (
                <article className="dashboard-card" key={`${card.badge}-${card.title}`}>
                  <span className="dashboard-chip">{card.badge}</span>
                  <h4>{card.title}</h4>
                  <p>{card.body}</p>
                  <small>{card.note}</small>
                </article>
              ))}
            </div>
            <p className="auth-message">{accessLoading ? 'Checking workspace access...' : workspaceStatus}</p>
          </section>
        ) : null}

        {session && hasAccess && canAdmin ? (
          <section id="admin" className="section-block dashboard-block">
            <div className="section-heading">
              <p className="section-kicker">Admin</p>
              <h2>Private control panel.</h2>
            </div>
            <div className="dashboard-grid">
              <article className="dashboard-card dashboard-primary">
                <p className="panel-label">Admin tools</p>
                <h3>Access control and workspace content.</h3>
                <p>
                  This panel edits the Supabase-backed approval list and workspace cards directly from the browser.
                  Only approved admin accounts can use these tools.
                </p>
                <div className="dashboard-actions">
                  <a className="button secondary" href="#workspace">
                    Review workspace
                  </a>
                  <a className="button secondary" href="#contact">
                    Contact
                  </a>
                </div>
              </article>

              <article className="dashboard-card">
                <span className="dashboard-chip">Workspace cards</span>
                <form className="admin-form" onSubmit={handleAddWorkspaceCard}>
                  <label>
                    <span>Badge</span>
                    <input
                      value={adminForm.badge}
                      onChange={(event) => setAdminForm((current) => ({ ...current, badge: event.target.value }))}
                      placeholder="Live"
                    />
                  </label>
                  <label>
                    <span>Title</span>
                    <input
                      value={adminForm.title}
                      onChange={(event) => setAdminForm((current) => ({ ...current, title: event.target.value }))}
                      placeholder="Private modules"
                    />
                  </label>
                  <label>
                    <span>Body</span>
                    <textarea
                      rows="3"
                      value={adminForm.body}
                      onChange={(event) => setAdminForm((current) => ({ ...current, body: event.target.value }))}
                      placeholder="Add the private module text."
                    />
                  </label>
                  <label>
                    <span>Note</span>
                    <textarea
                      rows="2"
                      value={adminForm.note}
                      onChange={(event) => setAdminForm((current) => ({ ...current, note: event.target.value }))}
                      placeholder="Short supporting note."
                    />
                  </label>
                  <div className="admin-inline">
                    <label>
                      <span>Order</span>
                      <input
                        type="number"
                        value={adminForm.order_index}
                        onChange={(event) =>
                          setAdminForm((current) => ({ ...current, order_index: event.target.value }))
                        }
                        placeholder="0"
                      />
                    </label>
                    <label className="admin-check">
                      <input
                        type="checkbox"
                        checked={adminForm.is_active}
                        onChange={(event) =>
                          setAdminForm((current) => ({ ...current, is_active: event.target.checked }))
                        }
                      />
                      <span>Active</span>
                    </label>
                  </div>
                  <button className="button primary" type="submit">
                    <CirclePlus size={14} />
                    Add workspace card
                  </button>
                </form>
              </article>

              <article className="dashboard-card">
                <span className="dashboard-chip">Approved users</span>
                <form className="admin-form" onSubmit={handleAddApprovedUser}>
                  <label>
                    <span>Email</span>
                    <input
                      type="email"
                      value={accessForm.email}
                      onChange={(event) => setAccessForm((current) => ({ ...current, email: event.target.value }))}
                      placeholder="name@example.com"
                    />
                  </label>
                  <label>
                    <span>Display name</span>
                    <input
                      value={accessForm.display_name}
                      onChange={(event) =>
                        setAccessForm((current) => ({ ...current, display_name: event.target.value }))
                      }
                      placeholder="Michael"
                    />
                  </label>
                  <label className="admin-check">
                    <input
                      type="checkbox"
                      checked={accessForm.can_admin}
                      onChange={(event) =>
                        setAccessForm((current) => ({ ...current, can_admin: event.target.checked }))
                      }
                    />
                    <span>Admin access</span>
                  </label>
                  <button className="button primary" type="submit">
                    <KeyRound size={14} />
                    Save approved user
                  </button>
                </form>
              </article>

              <article className="dashboard-card">
                <span className="dashboard-chip">Access list</span>
                <div className="workspace-list">
                  {approvedUsers.length ? (
                    approvedUsers.map((user) => (
                      <div className="workspace-list-item" key={user.email}>
                        <div>
                          <strong>{user.display_name || user.email}</strong>
                          <p>{user.email}</p>
                        </div>
                        <div className="workspace-flags">
                          <span>{user.can_admin ? 'Admin' : 'Approved'}</span>
                          <span>{user.active ? 'Active' : 'Inactive'}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="auth-note">No approved users loaded yet.</p>
                  )}
                </div>
              </article>
            </div>
            {workspaceActionStatus ? <p className="auth-message">{workspaceActionStatus}</p> : null}
          </section>
        ) : null}

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
