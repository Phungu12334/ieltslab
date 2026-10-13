import { useState, type ReactNode } from 'react';
import { DISCLAIMER } from '../../shared/constants';
import { useApp } from '../app/AppContext';
import { firstName } from '../lib/format';
import { Link, useRouter } from '../lib/router';
import { effectiveTheme } from '../lib/theme';
import { Icon } from './Icon';

export function Logo() {
  // A band ruler: nine ticks rising to a mark — the scale every result is reported on.
  return (
    <span className="logo" aria-hidden="true">
      <svg viewBox="0 0 28 28" width="28" height="28">
        <rect x="1" y="1" width="26" height="26" rx="7" fill="var(--primary)" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={6 + i * 3.6} y={19 - i * 2.6} width="2.2" height={3 + i * 2.6} rx="1" fill="var(--primary-ink)" opacity={0.55 + i * 0.11} />
        ))}
      </svg>
    </span>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { user, isAdmin, theme, setTheme, api } = useApp();
  const { route } = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const dark = effectiveTheme(theme) === 'dark';
  const nav = [
    { to: '/', label: 'Dashboard' },
    { to: '/practice', label: 'Practice' },
    { to: '/history', label: 'History' },
    ...(isAdmin ? [{ to: '/admin', label: 'Content' }] : []),
    { to: '/scoring', label: 'Scoring' },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main" onClick={(e) => (e.preventDefault(), document.getElementById('main')?.focus())}>
        Skip to content
      </a>
      <header className="site-header">
        <div className="wrap header-row">
          <Link to="/" className="brand" aria-label="IELTSLab home">
            <Logo />
            <span className="brand-name">
              IELTS<span className="brand-accent">Lab</span>
            </span>
            <span className="brand-sub">Practice tests</span>
          </Link>
          <button type="button" className="icon-btn nav-toggle" aria-expanded={menuOpen} aria-controls="primary-nav" onClick={() => setMenuOpen((o) => !o)}>
            <Icon name="menu" />
            <span className="sr-only">Menu</span>
          </button>
          <nav id="primary-nav" className={`primary-nav${menuOpen ? ' open' : ''}`} aria-label="Main">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={route.path === n.to || (n.to !== '/' && route.path.startsWith(n.to)) ? 'active' : ''}
                onClick={() => setMenuOpen(false)}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="header-tools">
            {api.mode === 'local' && (
              <span className="chip chip-warn" title="No server connected: tests are saved in this browser only.">
                Browser-only
              </span>
            )}
            <button
              type="button"
              className="icon-btn"
              onClick={() => setTheme(dark ? 'light' : 'dark')}
              aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={dark ? 'Light theme' : 'Dark theme'}
            >
              <Icon name={dark ? 'sun' : 'moon'} />
            </button>
            <Link to="/account" className="account-link" onClick={() => setMenuOpen(false)}>
              <Icon name="user" />
              <span>{user && !user.isGuest ? firstName(user.name) : api.mode === 'server' ? 'Sign in' : 'Settings'}</span>
            </Link>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className="wrap main">
        {children}
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <p>{DISCLAIMER}</p>
          <p className="muted">
            IELTS is a registered trademark of its owners and is used here only to describe the test format.{' '}
            <Link to="/scoring">How practice scores work</Link>
          </p>
        </div>
      </footer>
    </div>
  );
}
