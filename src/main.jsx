import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ChevronRight,
  CircleGauge,
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

const defaultWorkspaceCards = [
  {
    badge: 'Overview',
    title: 'Session map',
    body: 'A private launch surface for the current site session and the next places to go.',
    note: 'Use this as the home base after authentication.',
  },
  {
    badge: 'Modules',
    title: 'Project areas',
    body: 'Drop in product pages, tools, notes, or build zones as selectable modules.',
    note: 'Each card can become a live module as the site grows.',
  },
  {
    badge: 'Status',
    title: 'Deployment',
    body: 'GitHub Pages serves the app and keeps the current build online.',
    note: 'Pushes to main update the live URL automatically.',
  },
  {
    badge: 'Data',
    title: 'Supabase feed',
    body: 'Workspace cards are loaded from Supabase when the table is ready.',
    note: 'The page falls back to these defaults if the table is empty.',
  },
];

const workspaceModuleMeta = {
  'Session map': {
    status: 'Auth / navigation',
    summary: 'Shows whether the private area is open and which module is active.',
    actions: ['Review session state', 'Refresh auth view', 'Return to top'],
  },
  'Project areas': {
    status: 'Build zone',
    summary: 'Holds the parts of the site that can expand into real tools and pages.',
    actions: ['Plan a module', 'Open a tool area', 'Add new content'],
    launchTargets: ['Session map', 'Deployment', 'Supabase feed'],
  },
  Deployment: {
    status: 'Live / build',
    summary: 'Tracks the build path that keeps the site online and shows the current commit.',
    actions: ['Check publish state', 'Confirm latest build', 'Inspect cache'],
  },
  'Supabase feed': {
    status: 'Data source',
    summary: 'Represents the private data layer that can feed the workspace cards.',
    actions: ['Verify connection', 'Refresh cards', 'Review table'],
  },
};

function enhanceWorkspaceCard(card, index) {
  const meta = workspaceModuleMeta[card.title] ?? {};
  return {
    ...card,
    status: meta.status ?? card.badge,
    summary: meta.summary ?? card.body,
    actions: meta.actions ?? [card.note],
    launchTargets: meta.launchTargets ?? [],
    index: String(index + 1).padStart(2, '0'),
  };
}

function normalizeWorkspaceCard(card, index) {
  const fallback = defaultWorkspaceCards[index] ?? defaultWorkspaceCards[0];
  return {
    badge: card?.badge || fallback.badge,
    title: card?.title || fallback.title,
    body: card?.body || fallback.body,
    note: card?.note || fallback.note,
    status: card?.status,
    summary: card?.summary,
    actions: card?.actions,
    index: card?.index,
  };
}

function scrollWorkspaceIntoView() {
  window.requestAnimationFrame(() => {
    document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [workspaceCards, setWorkspaceCards] = useState(defaultWorkspaceCards);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [workspaceStatus, setWorkspaceStatus] = useState('Workspace table not loaded yet.');
  const [workspaceActivity, setWorkspaceActivity] = useState('Choose a module action to update the workspace.');
  const [activeModuleId, setActiveModuleId] = useState(defaultWorkspaceCards[0].title);
  const [workspaceRefreshTick, setWorkspaceRefreshTick] = useState(0);
  const buildSha = import.meta.env.VITE_BUILD_SHA || 'local-dev';

  const supabaseStatus = useMemo(() => getSupabaseStatus(), []);
  const workspaceModules = useMemo(
    () => workspaceCards.map((card, index) => enhanceWorkspaceCard(card, index)),
    [workspaceCards],
  );
  const workspaceHref = `${import.meta.env.BASE_URL}workspace`;
  const workspaceIntent = window.location.pathname.endsWith('/workspace');

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
        setWorkspaceCards(defaultWorkspaceCards);
        setWorkspaceStatus('Signed out.');
        setActiveModuleId(defaultWorkspaceCards[0].title);
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

      try {
        const { data: cards, error: cardsError } = await supabase
          .from('workspace_cards')
          .select('id, title, body, note, badge, order_index, is_active')
          .eq('is_active', true)
          .order('order_index', { ascending: true });

        if (cancelled) return;

        if (cardsError) {
          setWorkspaceCards(defaultWorkspaceCards);
          setWorkspaceStatus(`Using fallback cards because the workspace table is not ready: ${cardsError.message}`);
        } else if (cards?.length) {
          setWorkspaceCards(cards.map((card, index) => normalizeWorkspaceCard(card, index)));
          setWorkspaceStatus(`Loaded ${cards.length} workspace card${cards.length === 1 ? '' : 's'} from Supabase.`);
        } else {
          setWorkspaceCards(defaultWorkspaceCards);
          setWorkspaceStatus('Workspace table is connected, but no cards have been added yet.');
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaceCards(defaultWorkspaceCards);
          setWorkspaceStatus(`Workspace load failed: ${error?.message || 'Unknown error'}`);
        }
      }
    }

    if (session) {
      loadWorkspace();
    } else {
      setWorkspaceCards(defaultWorkspaceCards);
      setWorkspaceStatus('Login required.');
      setWorkspaceActivity('Login to load live workspace cards.');
    }

    return () => {
      cancelled = true;
    };
  }, [session, workspaceRefreshTick]);

  function handleModuleAction(moduleTitle, action) {
    setWorkspaceActivity(`${action} on ${moduleTitle}.`);
    if (action.toLowerCase().includes('refresh')) {
      setWorkspaceStatus(`Refreshing ${moduleTitle.toLowerCase()}...`);
      setWorkspaceRefreshTick((current) => current + 1);
    }
  }

  function openModule(moduleTitle) {
    setActiveModuleId(moduleTitle);
    setWorkspaceActivity(`Opened ${moduleTitle}.`);
  }

  function openWorkspaceRoute(event) {
    event.preventDefault();
    if (window.location.pathname !== workspaceHref) {
      window.history.pushState({}, '', workspaceHref);
    }
    scrollWorkspaceIntoView();
  }

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

  useEffect(() => {
    if (!session) return undefined;

    const timeout = window.setTimeout(() => {
      scrollWorkspaceIntoView();
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [session]);

  useEffect(() => {
    if (!workspaceIntent) return undefined;

    const timeout = window.setTimeout(() => {
      scrollWorkspaceIntoView();
    }, 200);

    return () => window.clearTimeout(timeout);
  }, [workspaceIntent]);

  useEffect(() => {
    if (!workspaceModules.length) return;
    const currentModule = workspaceModules.find(
      (card) => card.title === activeModuleId || card.badge === activeModuleId,
    );
    if (!currentModule) {
      setActiveModuleId(workspaceModules[0].title);
    }
  }, [workspaceModules, activeModuleId]);

  return (
    <div className="page-shell">
      <div className="ambient ambient-left" />
      <div className="ambient ambient-right" />

      <header className="topbar">
        <div className="brand-mark" aria-label="Forced Logic logo">
          <span className="brand-monogram">FL</span>
        </div>
        <div className="brand-copy">
          <p className="eyebrow">Precision engineered software</p>
          <h1>Forced Logic</h1>
          <p className="tagline">Engineering the Future of Desktop and Mobile Experiences</p>
          <p className="subtag">Performance-Driven Development</p>
        </div>
        <nav className="nav">
          <a href="#auth">Login</a>
          <a href={workspaceHref} onClick={openWorkspaceRoute}>Workspace</a>
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
                <a className="button secondary" href={workspaceHref} onClick={openWorkspaceRoute}>
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

              <p className="auth-note">This site uses your authenticated Supabase account only.</p>
            </form>
          )}

          {message ? <p className="auth-message">{message}</p> : null}
        </section>

        <section id="workspace" className="section-block dashboard-block">
            <div className="section-heading">
              <p className="section-kicker">Workspace</p>
              <h2>{session ? 'Private module workspace.' : 'Workspace locked.'}</h2>
            </div>
            <div className="workspace-status-bar">
              <div className="status-chip">
                <span className={`dot ${session ? 'dot-on' : 'dot-off'}`} />
                <span>{session ? workspaceStatus : 'Sign in to unlock the live workspace.'}</span>
              </div>
              <div className="workspace-status-meta">
                <span>{workspaceModules.length} loaded modules</span>
                <span>{supabaseStatus.ready ? 'Supabase connected' : 'Local fallback'}</span>
                <span>{session ? workspaceActivity : 'The workspace is waiting for sign-in.'}</span>
              </div>
            </div>
            <div className="module-workspace">
              <aside className="module-rail">
                <article className="dashboard-card dashboard-primary">
                  <p className="panel-label">Live Entry</p>
                  <h3>{session ? 'Forced Logic control surface' : 'Locked workspace preview'}</h3>
                  <p>
                    {session
                      ? 'This is the private layer of the site. It loads module content after login and keeps the public page clean.'
                      : 'The workspace route now lands here even before login, so the page changes visibly instead of doing nothing.'}
                  </p>
                  <div className="workspace-summary">
                    <div className="status-chip">
                      <span className={session ? 'dot dot-on' : 'dot dot-off'} />
                      <span>{session ? 'Signed-in session active' : 'Sign in required'}</span>
                    </div>
                    <p className="auth-note">
                      {session
                        ? 'Your account opens straight into the private workspace.'
                        : 'Use the login form above to unlock the module shell.'}
                    </p>
                  </div>
                  <div className="dashboard-actions">
                    <a className="button primary" href="#auth">
                      {session ? 'View services' : 'Sign in'}
                    </a>
                    <a className="button secondary" href="#contact">
                      Contact
                    </a>
                  </div>
                </article>
                {session ? (
                  <div className="module-list">
                    {workspaceModules.map((card) => {
                      const isActive = card.title === activeModuleId || card.badge === activeModuleId;
                      return (
                        <button
                          className={`module-tile ${isActive ? 'is-active' : ''}`}
                          type="button"
                          key={`${card.badge}-${card.title}`}
                          onClick={() => setActiveModuleId(card.title)}
                        >
                          <span className="module-index">{card.index}</span>
                          <div>
                            <span className="dashboard-chip">{card.badge}</span>
                            <h4>{card.title}</h4>
                          </div>
                          <p>{card.summary}</p>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="module-list locked-list">
                    <article className="module-tile locked-tile is-active">
                      <span className="module-index">01</span>
                      <div>
                        <span className="dashboard-chip">Locked</span>
                        <h4>Workspace waiting</h4>
                      </div>
                      <p>{workspaceIntent ? 'The route is live. Sign in to unlock the private cards.' : 'Choose View workspace to open the locked shell.'}</p>
                    </article>
                  </div>
                )}
              </aside>

              <article className="module-detail dashboard-card">
                {session ? (() => {
                  const activeModule =
                    workspaceModules.find(
                      (card) => card.title === activeModuleId || card.badge === activeModuleId,
                    ) ?? workspaceModules[0];

                  return (
                    <>
                      <p className="panel-label">Active module</p>
                      <h3>
                        <CircleGauge size={20} />
                        {activeModule.title}
                      </h3>
                      <p>{activeModule.body}</p>
                      <small>{activeModule.note}</small>

                      <div className="module-detail-grid">
                        <div>
                          <span>Badge</span>
                          <strong>{activeModule.badge}</strong>
                        </div>
                        <div>
                          <span>State</span>
                          <strong>{activeModule.status}</strong>
                        </div>
                        <div>
                          <span>Source</span>
                          <strong>{supabaseStatus.ready ? 'Supabase / fallback' : 'Local fallback'}</strong>
                        </div>
                        <div>
                          <span>Mode</span>
                          <strong>Live workspace</strong>
                        </div>
                        {activeModule.title === 'Deployment' ? (
                          <div className="module-detail-wide">
                            <span>Build SHA</span>
                            <strong>{buildSha}</strong>
                          </div>
                        ) : activeModule.title === 'Session map' ? (
                          <div className="module-detail-wide">
                            <span>Auth state</span>
                            <strong>{session ? `Signed in as ${session.user.email}` : 'Signed out'}</strong>
                          </div>
                        ) : null}
                      </div>

                      <div className="module-detail-note">
                        <p>
                          {activeModule.summary}
                        </p>
                      </div>
                      <div className="module-action-list">
                        {activeModule.actions.map((action) => (
                          <button
                            key={action}
                            type="button"
                            className="module-action-pill"
                            onClick={() => handleModuleAction(activeModule.title, action)}
                          >
                            {action}
                          </button>
                        ))}
                      </div>
                      {activeModule.launchTargets?.length ? (
                        <div className="module-launcher">
                          <span>Quick launch</span>
                          <div className="module-action-list">
                            {activeModule.launchTargets.map((moduleTitle) => (
                              <button
                                key={moduleTitle}
                                type="button"
                                className="module-action-pill"
                                onClick={() => openModule(moduleTitle)}
                              >
                                {moduleTitle}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })() : (
                  <>
                    <p className="panel-label">Active module</p>
                    <h3>
                      <CircleGauge size={20} />
                      Workspace locked
                    </h3>
                    <p>Open the sign-in form above to unlock the live workspace cards and actions.</p>
                    <div className="module-detail-grid">
                      <div>
                        <span>Badge</span>
                        <strong>Locked</strong>
                      </div>
                      <div>
                        <span>State</span>
                        <strong>Awaiting login</strong>
                      </div>
                      <div>
                        <span>Source</span>
                        <strong>{supabaseStatus.ready ? 'Supabase ready' : 'Local fallback'}</strong>
                      </div>
                      <div>
                        <span>Mode</span>
                        <strong>Front door</strong>
                      </div>
                    </div>
                    <div className="module-detail-note">
                      <p>The workspace route is live, but the private module grid only opens after sign-in.</p>
                    </div>
                  </>
                )}
              </article>
            </div>
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || 'Unexpected rendering error.' };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-shell">
          <main className="section-block auth-block">
            <div className="section-heading">
              <p className="section-kicker">System</p>
              <h2>Something interrupted the page.</h2>
            </div>
            <p className="auth-message">
              {this.state.message}
            </p>
            <p className="auth-note">
              Refresh the page. If it keeps happening, the issue is now contained instead of blanking the site.
            </p>
          </main>
        </div>
      );
    }

    return this.props.children;
  }
}

const fallbackPath = new URLSearchParams(window.location.search).get('p');

if (fallbackPath) {
  const targetUrl = new URL(fallbackPath, window.location.origin);
  window.history.replaceState({}, '', `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);


