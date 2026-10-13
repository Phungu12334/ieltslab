// Small hash router: works on any static host and inside sandboxed previews.
import { createContext, useContext, useEffect, useState, type ReactNode, type MouseEvent, type AnchorHTMLAttributes } from 'react';

export interface Route {
  path: string;
  query: URLSearchParams;
}

function readHash(): Route {
  let h = '';
  try {
    h = window.location.hash || '';
  } catch {
    /* ignore */
  }
  const raw = h.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  return { path: p.startsWith('/') ? p : '/' + p, query: new URLSearchParams(q) };
}

const RouterCtx = createContext<{ route: Route; navigate: (to: string, opts?: { replace?: boolean }) => void }>({
  route: { path: '/', query: new URLSearchParams() },
  navigate: () => undefined,
});

export function RouterProvider({ children }: { children: ReactNode }) {
  const [route, setRoute] = useState<Route>(readHash);
  useEffect(() => {
    const on = () => setRoute(readHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const navigate = (to: string, opts: { replace?: boolean } = {}) => {
    const [p, q = ''] = to.split('?');
    setRoute({ path: p, query: new URLSearchParams(q) });
    try {
      if (opts.replace) history.replaceState(null, '', '#' + to);
      else history.pushState(null, '', '#' + to);
    } catch {
      /* sandboxed frames may block history; in-memory routing still works */
    }
    window.scrollTo({ top: 0 });
  };
  return <RouterCtx.Provider value={{ route, navigate }}>{children}</RouterCtx.Provider>;
}

export const useRouter = () => useContext(RouterCtx);

/** Match "/attempt/:id" against a path. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const keys: string[] = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => (keys.push(k), '([^/]+)')) + '/?$');
  const m = re.exec(path);
  if (!m) return null;
  return Object.fromEntries(keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
}

export function Link({ to, children, onClick, ...rest }: { to: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { navigate, route } = useRouter();
  const active = route.path === to.split('?')[0];
  return (
    <a
      href={'#' + to}
      aria-current={active ? 'page' : undefined}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    >
      {children}
    </a>
  );
}
