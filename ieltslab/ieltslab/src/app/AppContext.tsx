import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { PublicUser } from '../../shared/types';
import type { Api } from '../api';
import { Button, Modal } from '../components/ui';
import { applyTheme, getThemePref, type ThemePref } from '../lib/theme';

interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'error' | 'info';
}

interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface AppState {
  api: Api;
  user: PublicUser | null;
  setUser: (u: PublicUser | null) => void;
  refreshUser: () => Promise<void>;
  /** Returns the signed-in user, creating a guest session when needed. */
  ensureUser: () => Promise<PublicUser>;
  toast: (text: string, tone?: Toast['tone']) => void;
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  theme: ThemePref;
  setTheme: (t: ThemePref) => void;
  isAdmin: boolean;
}

const Ctx = createContext<AppState | null>(null);

export function useApp(): AppState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

export function AppProvider({ api, initialUser, children }: { api: Api; initialUser: PublicUser | null; children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(initialUser);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [theme, setThemeState] = useState<ThemePref>(getThemePref);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      setUser(await api.me());
    } catch {
      /* keep current */
    }
  }, [api]);

  const ensureUser = useCallback(async () => {
    if (user) return user;
    const u = await api.guest();
    setUser(u);
    return u;
  }, [api, user]);

  const setTheme = useCallback(
    (t: ThemePref) => {
      applyTheme(t);
      setThemeState(t);
      if (user && !user.isGuest && api.mode === 'server') api.updateAccount({ settings: { theme: t } }).catch(() => undefined);
    },
    [api, user],
  );

  // Apply a theme saved on the account the first time we see it.
  useEffect(() => {
    const saved = user?.settings.theme;
    if (saved && saved !== getThemePref()) {
      applyTheme(saved);
      setThemeState(saved);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })), []);
  const closeConfirm = (v: boolean) => {
    confirmState?.resolve(v);
    setConfirmState(null);
  };

  return (
    <Ctx.Provider value={{ api, user, setUser, refreshUser, ensureUser, toast, confirm, theme, setTheme, isAdmin: user?.role === 'admin' }}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            {t.text}
          </div>
        ))}
      </div>
      <Modal
        open={!!confirmState}
        title={confirmState?.title || ''}
        onClose={() => closeConfirm(false)}
        footer={
          <>
            <Button onClick={() => closeConfirm(false)}>{confirmState?.cancelLabel || 'Cancel'}</Button>
            <Button variant={confirmState?.danger ? 'danger' : 'primary'} onClick={() => closeConfirm(true)} autoFocus>
              {confirmState?.confirmLabel}
            </Button>
          </>
        }
      >
        {confirmState?.body}
      </Modal>
    </Ctx.Provider>
  );
}
