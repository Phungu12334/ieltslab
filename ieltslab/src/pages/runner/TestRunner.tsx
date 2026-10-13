import { useEffect, useState } from 'react';
import { SKILL_LABEL } from '../../../shared/constants';
import type { Attempt } from '../../../shared/types';
import { useApp } from '../../app/AppContext';
import { Logo } from '../../components/Layout';
import { Button, ErrorState, Spinner } from '../../components/ui';
import { useRouter } from '../../lib/router';
import { useAsync } from '../../lib/useAsync';
import { ActiveSection } from './ActiveSection';
import { SectionIntro } from './SectionIntro';

export function TestRunner({ id }: { id: string }) {
  const { api, ensureUser } = useApp();
  const { navigate } = useRouter();
  const load = useAsync(async () => {
    await ensureUser().catch(() => undefined);
    return (await api.getAttempt(id)).attempt;
  }, [api, id]);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);

  useEffect(() => {
    if (load.data) setAttempt(load.data);
  }, [load.data]);

  useEffect(() => {
    if (attempt?.status === 'submitted') navigate(`/results/${attempt.id}`, { replace: true });
  }, [attempt?.status, attempt?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (load.loading && !attempt) return <div className="boot"><Spinner label="Loading your test…" /></div>;
  if (load.error && !attempt)
    return (
      <div className="boot narrow">
        <ErrorState error={load.error} onRetry={load.reload} />
        <Button onClick={() => navigate('/')}>Back to dashboard</Button>
      </div>
    );
  if (!attempt || attempt.status === 'submitted') return <div className="boot"><Spinner label="Opening results…" /></div>;

  const idx = attempt.currentSection;
  const section = attempt.sections[idx];

  const onSectionDone = (next: Attempt) => {
    setJustSubmitted(SKILL_LABEL[section.skill]);
    setAttempt(next);
    window.scrollTo({ top: 0 });
  };

  if (section.status === 'pending') {
    return (
      <div className="runner-pre">
        <header className="pre-head wrap">
          <span className="brand">
            <Logo />
            <span className="brand-name">
              IELTS<span className="brand-accent">Lab</span>
            </span>
          </span>
          <Button variant="ghost" icon="left" onClick={() => navigate('/')}>
            Save and exit
          </Button>
        </header>
        <SectionIntro
          attempt={attempt}
          justSubmitted={justSubmitted}
          onStarted={(startedAt) => {
            const copy: Attempt = JSON.parse(JSON.stringify(attempt));
            copy.sections[idx].status = 'active';
            copy.sections[idx].startedAt = startedAt;
            setAttempt(copy);
          }}
        />
      </div>
    );
  }

  return <ActiveSection key={`${attempt.id}-${idx}`} attempt={attempt} sectionIndex={idx} onSectionDone={onSectionDone} />;
}
