import React from 'react';
import { createRoot } from 'react-dom/client';
import { ChevronRight, Mail, MonitorSmartphone, PanelTop, Workflow } from 'lucide-react';

import { supabase } from './lib/supabaseClient';
import './styles.css';

function App() {
  const hasSupabase = Boolean(supabase);

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
          <a href="#services">Services</a>
          <a href="#approach">Approach</a>
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
                <a className="button primary" href="#services">
                  Explore Solutions
                  <ChevronRight size={14} />
                </a>
                <a className="button secondary" href="#contact">
                  View Work
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
                <span className={hasSupabase ? 'dot dot-on' : 'dot dot-off'} />
                <span>{hasSupabase ? 'Supabase wiring ready' : 'Supabase not configured yet'}</span>
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
                <h4><ChevronRight size={16} /> Custom system tools</h4>
                <p>Software that matches the task instead of forcing the task to fit.</p>
              </article>
            </div>
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

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
