import React from 'react';
import { createRoot } from 'react-dom/client';

import forgedLogicLogo from '../forged-logic-logo.png';
import './styles.css';

function StaticLanding() {
  return (
    <main className="static-landing" aria-label="Forged Logic static landing page">
      <img
        className="static-hero"
        src={forgedLogicLogo}
        alt="Forged Logic"
        decoding="async"
        loading="eager"
      />
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StaticLanding />
  </React.StrictMode>,
);
