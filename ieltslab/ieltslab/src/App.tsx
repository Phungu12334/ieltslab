import { useEffect, useState, type ReactElement } from 'react';
import type { PublicUser } from '../shared/types';
import { connectApi, type Api } from './api';
import { AppProvider, useApp } from './app/AppContext';
import { Layout } from './components/Layout';
import { Button, EmptyState, Spinner } from './components/ui';
import { matchPath, RouterProvider, useRouter } from './lib/router';
import { Account } from './pages/Account';
import { ContentList } from './pages/admin/ContentList';
import { ImportPage } from './pages/admin/ImportPage';
import { MaterialEditor } from './pages/admin/MaterialEditor';
import { ReviewQueue } from './pages/admin/ReviewQueue';
import { History } from './pages/History';
import { Home } from './pages/Home';
import { NewTest } from './pages/NewTest';
import { Results } from './pages/Results';
import { TestRunner } from './pages/runner/TestRunner';
import { Scoring } from './pages/Scoring';

function AdminGate({ children }: { children: ReactElement }) {
  const { isAdmin, user, api } = useApp();
  const { navigate } = useRouter();
  if (isAdmin) return children;
  return (
    <EmptyState title="Administrators only">
      {api.mode === 'server'
        ? user && !user.isGuest
          ? 'Your account does not have permission to manage test content. Ask an administrator to add your email to ADMIN_EMAILS.'
          : 'Sign in with an administrator account to manage test content.'
        : 'Content management is unavailable.'}
      <div className="row-gap">
        <Button variant="primary" onClick={() => navigate('/account')}>
          Go to account
        </Button>
      </div>
    </EmptyState>
  );
}

function Routes() {
  const { route, navigate } = useRouter();
  const p = route.path;
  let m: Record<string, string> | null;
  if ((m = matchPath('/attempt/:id', p))) return <TestRunner key={m.id} id={m.id} />;
  let page: ReactElement;
  if (p === '/') page = <Home />;
  else if (p === '/practice') page = <NewTest />;
  else if ((m = matchPath('/results/:id', p))) page = <Results key={m.id} id={m.id} />;
  else if (p === '/history') page = <History />;
  else if (p === '/account') page = <Account />;
  else if (p === '/scoring') page = <Scoring />;
  else if (p === '/admin') page = <AdminGate><ContentList /></AdminGate>;
  else if (p === '/admin/new') page = <AdminGate><MaterialEditor /></AdminGate>;
  else if ((m = matchPath('/admin/edit/:id', p))) page = <AdminGate><MaterialEditor key={m.id} id={m.id} /></AdminGate>;
  else if (p === '/admin/import') page = <AdminGate><ImportPage /></AdminGate>;
  else if (p === '/admin/reviews') page = <AdminGate><ReviewQueue /></AdminGate>;
  else
    page = (
      <EmptyState title="Page not found" action={<Button variant="primary" onClick={() => navigate('/')}>Go to dashboard</Button>}>
        The link may be out of date.
      </EmptyState>
    );
  return <Layout>{page}</Layout>;
}

export function App() {
  const [boot, setBoot] = useState<{ api: Api; user: PublicUser | null } | { error: string } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const api = await connectApi();
        const user = await api.me().catch(() => null);
        setBoot({ api, user });
      } catch (e) {
        setBoot({ error: e instanceof Error ? e.message : 'Could not start the app.' });
      }
    })();
  }, []);
  if (!boot) return <div className="boot"><Spinner label="Loading IELTSLab…" /></div>;
  if ('error' in boot) return <div className="boot"><EmptyState title="IELTSLab could not start">{boot.error}</EmptyState></div>;
  return (
    <RouterProvider>
      <AppProvider api={boot.api} initialUser={boot.user}>
        <Routes />
      </AppProvider>
    </RouterProvider>
  );
}
