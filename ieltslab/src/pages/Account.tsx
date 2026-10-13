import { useState, type FormEvent } from 'react';
import type { TestType } from '../../shared/types';
import { BAND_STEPS } from '../../shared/constants';
import { useApp } from '../app/AppContext';
import { Icon } from '../components/Icon';
import { Button, Field, Notice } from '../components/ui';
import { formatBand } from '../lib/format';
import { useRouter } from '../lib/router';
import type { ThemePref } from '../lib/theme';

function GoogleButton() {
  const { api } = useApp();
  const url = api.googleUrl();
  if (!url) {
    return (
      <div className="google-off">
        <button type="button" className="btn btn-secondary google-btn" disabled aria-describedby="google-off-note">
          <GoogleMark /> <span>Continue with Google</span>
        </button>
        <p className="hint" id="google-off-note">
          {api.mode === 'server'
            ? 'Google sign-in is not set up on this server. An administrator needs to add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (see the README).'
            : 'Google sign-in needs the IELTSLab server.'}
        </p>
      </div>
    );
  }
  return (
    <a className="btn btn-secondary google-btn" href={url}>
      <GoogleMark /> <span>Continue with Google</span>
    </a>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function AuthForms() {
  const { api, setUser, user, toast } = useApp();
  const { route, navigate } = useRouter();
  const [mode, setMode] = useState<'signin' | 'register'>(route.query.get('mode') === 'register' ? 'register' : 'signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(route.query.get('error') || '');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const u = mode === 'signin' ? await api.login({ email, password }) : await api.register({ name, email, password });
      setUser(u);
      toast(mode === 'signin' ? `Signed in as ${u.name}.` : user?.isGuest ? 'Account created. Your guest tests have been kept.' : 'Account created.');
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-card card">
      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'signin'} className={`tab${mode === 'signin' ? ' active' : ''}`} onClick={() => setMode('signin')}>
          Sign in
        </button>
        <button type="button" role="tab" aria-selected={mode === 'register'} className={`tab${mode === 'register' ? ' active' : ''}`} onClick={() => setMode('register')}>
          Create account
        </button>
      </div>
      {user?.isGuest && <Notice tone="info">You are using a guest session. {mode === 'register' ? 'Creating an account keeps your tests and results.' : 'Signing in moves your guest tests into your account.'}</Notice>}
      <form onSubmit={submit} className="stack" noValidate>
        {mode === 'register' && (
          <Field label="Name">
            {(p) => <input {...p} type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
        )}
        <Field label="Email" required>
          {(p) => <input {...p} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password" required hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
          {(p) => (
            <input
              {...p}
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        {error && <Notice tone="error">{error}</Notice>}
        <Button type="submit" variant="primary" busy={busy}>
          {mode === 'signin' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
      <div className="or">or</div>
      <GoogleButton />
    </div>
  );
}

function Preferences() {
  const { api, user, setUser, toast, theme, setTheme } = useApp();
  const [name, setName] = useState(user?.name || '');
  const [target, setTarget] = useState(user?.settings.targetBand ? String(user.settings.targetBand) : '');
  const [testType, setTestType] = useState<TestType>(user?.settings.defaultTestType || 'academic');
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const u = await api.updateAccount({
        name: user?.isGuest && api.mode === 'server' ? undefined : name,
        settings: { ...(target ? { targetBand: Number(target) } : {}), defaultTestType: testType },
      });
      setUser(u);
      toast('Preferences saved.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save.', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card stack">
      <h2 className="h3">Profile and study preferences</h2>
      <form onSubmit={save} className="form-grid">
        {!(user?.isGuest && api.mode === 'server') && (
          <Field label="Display name">{(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />}</Field>
        )}
        <Field label="Target band" hint="Shown on your results so you can see the gap.">
          {(p) => (
            <select {...p} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">Not set</option>
              {BAND_STEPS.filter((b) => b >= 4)
                .reverse()
                .map((b) => (
                  <option key={b} value={b}>
                    {formatBand(b)}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <Field label="Usual test format">
          {(p) => (
            <select {...p} value={testType} onChange={(e) => setTestType(e.target.value as TestType)}>
              <option value="academic">Academic</option>
              <option value="general">General Training</option>
            </select>
          )}
        </Field>
        <div className="form-actions">
          <Button type="submit" variant="primary" busy={busy}>
            Save preferences
          </Button>
        </div>
      </form>
      <fieldset className="theme-pick">
        <legend>Appearance</legend>
        {(['system', 'light', 'dark'] as ThemePref[]).map((t) => (
          <label key={t} className={`opt${theme === t ? ' selected' : ''}`}>
            <input type="radio" name="theme" checked={theme === t} onChange={() => setTheme(t)} />
            <Icon name={t === 'dark' ? 'moon' : t === 'light' ? 'sun' : 'settings'} size={16} />
            {t === 'system' ? 'Match device' : t === 'light' ? 'Light' : 'Dark'}
          </label>
        ))}
      </fieldset>
    </section>
  );
}

function Security() {
  const { api, user, toast, confirm, setUser } = useApp();
  const { navigate } = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  if (!user) return null;
  const changePw = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.changePassword(current, next);
      setCurrent('');
      setNext('');
      toast('Password updated. Other devices have been signed out.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not change password.', 'error');
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    const ok = await confirm({
      title: 'Delete your account?',
      body: <p>Your account, all attempts and all recordings are deleted permanently. This cannot be undone.</p>,
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (!ok) return;
    try {
      await api.deleteAccount();
      setUser(null);
      toast('Your account has been deleted.');
      navigate('/');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not delete the account.', 'error');
    }
  };
  return (
    <>
      <section className="card stack">
        <h2 className="h3">{user.hasPassword ? 'Change password' : 'Set a password'}</h2>
        {!user.hasPassword && <p className="muted">You sign in with Google. Add a password if you also want to sign in with your email.</p>}
        <form onSubmit={changePw} className="form-grid">
          {user.hasPassword && (
            <Field label="Current password">
              {(p) => <input {...p} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />}
            </Field>
          )}
          <Field label="New password" hint="At least 8 characters.">
            {(p) => <input {...p} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />}
          </Field>
          <div className="form-actions">
            <Button type="submit" busy={busy} disabled={next.length < 8}>
              {user.hasPassword ? 'Change password' : 'Set password'}
            </Button>
          </div>
        </form>
      </section>
      <section className="card stack danger-zone">
        <h2 className="h3">Delete account</h2>
        <p className="muted">Removes your profile, every attempt and every recording.</p>
        <Field label='Type "DELETE" to confirm'>{(p) => <input {...p} value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />}</Field>
        <div>
          <Button variant="danger" icon="trash" disabled={confirmText !== 'DELETE'} onClick={del}>
            Delete my account
          </Button>
        </div>
      </section>
    </>
  );
}

export function Account() {
  const { api, user, setUser, toast, confirm } = useApp();
  const { navigate } = useRouter();
  const signedIn = !!user && !user.isGuest;

  return (
    <div className="stack-lg narrow">
      <header className="page-head">
        <p className="eyebrow">Account</p>
        <h1>{signedIn ? user!.name : api.mode === 'local' ? 'Settings' : 'Sign in to IELTSLab'}</h1>
        {signedIn && (
          <p className="muted">
            {user!.email} · {user!.role === 'admin' ? 'Administrator' : 'Candidate'}
            {user!.googleLinked ? ' · Google linked' : ''}
          </p>
        )}
      </header>

      {api.mode === 'local' ? (
        <Notice tone="warn" title="Browser-only mode">
          Accounts, Google sign-in and cross-device history need the IELTSLab server. Here, tests and content are saved in this browser. You manage
          content as the local administrator.
        </Notice>
      ) : !signedIn ? (
        <AuthForms />
      ) : null}

      {user && <Preferences />}

      {signedIn && api.mode === 'server' && (
        <>
          <section className="card row-between">
            <div>
              <h2 className="h3">Sign out</h2>
              <p className="muted">Ends your session on this device.</p>
            </div>
            <Button
              icon="logout"
              onClick={async () => {
                await api.logout().catch(() => undefined);
                setUser(null);
                toast('Signed out.');
                navigate('/');
              }}
            >
              Sign out
            </Button>
          </section>
          <Security />
        </>
      )}

      {api.mode === 'local' && api.resetLocalData && (
        <section className="card row-between danger-zone">
          <div>
            <h2 className="h3">Reset this browser’s data</h2>
            <p className="muted">Deletes all attempts, recordings and custom content, and restores the demo set.</p>
          </div>
          <Button
            variant="danger"
            icon="trash"
            onClick={async () => {
              const ok = await confirm({ title: 'Reset all local data?', body: <p>Everything saved in this browser will be deleted.</p>, confirmLabel: 'Reset', danger: true });
              if (!ok) return;
              await api.resetLocalData!();
              setUser(await api.me());
              toast('Local data reset.');
              navigate('/');
            }}
          >
            Reset
          </Button>
        </section>
      )}
    </div>
  );
}
