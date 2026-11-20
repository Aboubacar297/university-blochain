import { useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { useI18n } from '../i18n';

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
}

export interface ChartPoint {
  label: string;
  shortLabel: string;
  values: Record<string, number>;
}

interface AreaChartProps {
  points: ChartPoint[];
  series: ChartSeries[];
  ariaLabel: string;
  tableCaption: string;
}

const W = 720;
const H = 280;
const M = { left: 40, right: 16, top: 14, bottom: 30 };

function niceMax(max: number): number {
  if (max <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(max));
  const norm = max / mag;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * mag;
}

/** Courbe lissée (Catmull-Rom vers Bézier), bornée pour ne jamais passer sous l'axe. */
function smoothPath(pts: Array<[number, number]>, top: number, bottom: number): string {
  if (pts.length === 0) return '';
  const clamp = (y: number) => Math.min(bottom, Math.max(top, y));
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1: [number, number] = [p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6)];
    const c2: [number, number] = [p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6)];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

/**
 * Courbes statistiques interactives : survol, navigation au clavier, séries masquables,
 * annonce vocale de la valeur active et tableau de données équivalent (WCAG 1.1.1).
 */
export function AreaChart({ points, series, ariaLabel, tableCaption }: AreaChartProps) {
  const { t } = useI18n();
  const uid = useId().replace(/:/g, '');
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const visible = series.filter((s) => !hidden.has(s.key));
  const n = points.length;
  const innerW = W - M.left - M.right;
  const innerH = H - M.top - M.bottom;
  const baseline = M.top + innerH;

  const { max, geometry } = useMemo(() => {
    const rawMax = Math.max(0, ...visible.flatMap((s) => points.map((p) => p.values[s.key] ?? 0)));
    const m = niceMax(rawMax);
    const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
    const y = (v: number) => M.top + (1 - v / m) * innerH;
    const geo = visible.map((s) => {
      const pts = points.map((p, i): [number, number] => [x(i), y(p.values[s.key] ?? 0)]);
      const line = smoothPath(pts, M.top, baseline);
      const area = pts.length > 0 ? `${line} L${pts[pts.length - 1][0].toFixed(1)},${baseline} L${pts[0][0].toFixed(1)},${baseline} Z` : '';
      return { series: s, line, area, pts };
    });
    return { max: m, geometry: geo };
  }, [points, visible, n, innerW, innerH, baseline]);

  const xAt = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i * innerW) / (n - 1));
  const ticks = [0, 1, 2, 3, 4].map((k) => (max / 4) * k);

  function indexFromPointer(e: PointerEvent<HTMLDivElement>): number {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect || n <= 1) return 0;
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(((px - M.left) / innerW) * (n - 1));
    return Math.min(n - 1, Math.max(0, idx));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (n === 0) return;
    if (e.key === 'ArrowRight') setActive((a) => Math.min(n - 1, (a ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? n) - 1));
    else if (e.key === 'Home') setActive(0);
    else if (e.key === 'End') setActive(n - 1);
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  }

  function toggle(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else if (visible.length > 1) next.add(key);
      return next;
    });
  }

  const current = active !== null ? points[active] : null;
  const tooltipTop = current ? Math.min(...visible.map((s) => M.top + (1 - (current.values[s.key] ?? 0) / max) * innerH)) : 0;

  return (
    <div className="chart">
      <div className="chart__legend" role="group" aria-label={t('chart.series')}>
        {series.map((s) => (
          <button key={s.key} type="button" className="chart__toggle" aria-pressed={!hidden.has(s.key)} onClick={() => toggle(s.key)}>
            <span className="chart__swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </button>
        ))}
      </div>

      <div
        ref={stageRef}
        className="chart__stage"
        tabIndex={0}
        role="group"
        aria-label={`${ariaLabel}. ${t('chart.keyboardHelp')}`}
        onPointerMove={(e) => setActive(indexFromPointer(e))}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKeyDown}
        onBlur={() => setActive(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} preserveAspectRatio="xMidYMid meet">
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>
          <g className="chart__grid">
            {ticks.map((v) => (
              <line key={v} x1={M.left} x2={W - M.right} y1={M.top + (1 - v / max) * innerH} y2={M.top + (1 - v / max) * innerH} />
            ))}
          </g>
          <g className="chart__axis">
            {ticks.map((v) => (
              <text key={v} x={M.left - 8} y={M.top + (1 - v / max) * innerH + 4} textAnchor="end">
                {Math.round(v)}
              </text>
            ))}
            {points.map((p, i) => (
              <text key={p.label} x={xAt(i)} y={H - 8} textAnchor="middle">
                {p.shortLabel}
              </text>
            ))}
          </g>
          {geometry.map((g) => (
            <g key={g.series.key}>
              <path d={g.area} fill={`url(#${uid}-${g.series.key})`} />
              <path d={g.line} fill="none" stroke={g.series.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          ))}
          {active !== null && (
            <g>
              <line x1={xAt(active)} x2={xAt(active)} y1={M.top} y2={baseline} stroke="#8B9893" strokeDasharray="4 4" />
              {geometry.map((g) => (
                <circle key={g.series.key} cx={g.pts[active][0]} cy={g.pts[active][1]} r="5" fill="#0D1110" stroke={g.series.color} strokeWidth="2.5" />
              ))}
            </g>
          )}
        </svg>

        {current && (
          <div className="chart__tooltip" style={{ left: `${(xAt(active as number) / W) * 100}%`, top: `${(tooltipTop / H) * 100}%` }} aria-hidden="true">
            <strong>{current.label}</strong>
            {visible.map((s) => (
              <span key={s.key}>
                <i className="chart__swatch" style={{ background: s.color }} />
                {s.label} : {current.values[s.key] ?? 0}
              </span>
            ))}
          </div>
        )}
        <p className="visually-hidden" aria-live="polite">
          {current ? `${current.label}. ${visible.map((s) => `${s.label} : ${current.values[s.key] ?? 0}`).join(', ')}` : ''}
        </p>
      </div>

      <details className="chart__data">
        <summary>{t('chart.viewData')}</summary>
        <div className="table-wrap">
          <table className="data-table">
            <caption className="visually-hidden">{tableCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{t('chart.month')}</th>
                {series.map((s) => (
                  <th key={s.key} scope="col">
                    {s.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.label}>
                  <th scope="row" data-label={t('chart.month')}>
                    {p.label}
                  </th>
                  {series.map((s) => (
                    <td key={s.key} data-label={s.label}>
                      {p.values[s.key] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
