import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Material } from '../../../shared/types';
import { Icon } from '../../components/Icon';
import { prefs } from '../../lib/format';

type Ranges = Record<number, [number, number][]>;

function merge(list: [number, number][]): [number, number][] {
  const sorted = [...list].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

function offsetIn(el: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.setEnd(node, offset);
  return r.toString().length;
}

/** Split a passage into paragraphs, keeping a leading "A " style paragraph label. */
export function splitParagraphs(text: string): { label?: string; text: string }[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const m = /^([A-Z])\s+(?=[A-Z"'])/.exec(p);
      return m ? { label: m[1], text: p.slice(m[0].length) } : { text: p };
    });
}

export function Passage({ attemptId, material, label }: { attemptId: string; material: Material; label: string }) {
  const key = `bw-hl-${attemptId}-${material.id}`;
  const paras = useMemo(() => splitParagraphs(material.passage || ''), [material.passage]);
  const [ranges, setRanges] = useState<Ranges>(() => {
    try {
      return JSON.parse(prefs.get(key) || '{}') as Ranges;
    } catch {
      return {};
    }
  });
  const [popover, setPopover] = useState<{ top: number; left: number } | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => prefs.set(key, JSON.stringify(ranges)), [key, ranges]);

  const readSelection = useCallback((): Ranges | null => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount || !box.current) return null;
    const range = sel.getRangeAt(0);
    if (!box.current.contains(range.commonAncestorContainer)) return null;
    const found: Ranges = {};
    box.current.querySelectorAll<HTMLElement>('[data-para]').forEach((el) => {
      if (!range.intersectsNode(el)) return;
      const i = Number(el.dataset.para);
      const len = (el.textContent || '').length;
      const start = el.contains(range.startContainer) ? offsetIn(el, range.startContainer, range.startOffset) : 0;
      const end = el.contains(range.endContainer) ? offsetIn(el, range.endContainer, range.endOffset) : len;
      if (end > start) found[i] = [[start, end]];
    });
    return Object.keys(found).length ? found : null;
  }, []);

  const onSelect = () => {
    const found = readSelection();
    setHasSelection(!!found);
    if (!found || !box.current) return setPopover(null);
    const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
    const outer = box.current.getBoundingClientRect();
    setPopover({ top: rect.top - outer.top + box.current.scrollTop - 44, left: Math.max(8, Math.min(rect.left - outer.left + rect.width / 2 - 52, outer.width - 120)) });
  };

  const highlight = () => {
    const found = readSelection();
    if (!found) return;
    setRanges((prev) => {
      const next: Ranges = { ...prev };
      for (const [k, v] of Object.entries(found)) next[Number(k)] = merge([...(next[Number(k)] || []), ...v]);
      return next;
    });
    window.getSelection()?.removeAllRanges();
    setPopover(null);
    setHasSelection(false);
  };

  const count = Object.values(ranges).reduce((n, r) => n + r.length, 0);

  return (
    <div className="passage-wrap">
      <div className="passage-tools">
        <span className="eyebrow">{label}</span>
        <div className="row-gap-sm">
          <button type="button" className="tool-btn" onMouseDown={(e) => e.preventDefault()} onClick={highlight} disabled={!hasSelection}>
            <Icon name="highlight" size={16} /> Highlight
          </button>
          <button type="button" className="tool-btn" onClick={() => setRanges({})} disabled={!count}>
            <Icon name="x" size={16} /> Clear highlights
          </button>
        </div>
      </div>
      <article className="passage" ref={box} onMouseUp={onSelect} onKeyUp={onSelect} onTouchEnd={() => setTimeout(onSelect, 50)}>
        <h2 className="passage-title">{material.title}</h2>
        {paras.map((p, i) => (
          <p key={i} className={p.label ? 'labelled' : undefined}>
            {p.label && <span className="para-label">{p.label}</span>}
            <span data-para={i}>{renderMarks(p.text, merge(ranges[i] || []))}</span>
          </p>
        ))}
        {popover && (
          <button type="button" className="hl-pop" style={{ top: popover.top, left: popover.left }} onMouseDown={(e) => e.preventDefault()} onClick={highlight}>
            <Icon name="highlight" size={15} /> Highlight
          </button>
        )}
      </article>
    </div>
  );
}

function renderMarks(text: string, rs: [number, number][]) {
  if (!rs.length) return text;
  const out: ReactNode[] = [];
  let pos = 0;
  rs.forEach(([s, e], i) => {
    if (s > pos) out.push(text.slice(pos, s));
    out.push(<mark key={i}>{text.slice(s, e)}</mark>);
    pos = e;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}
