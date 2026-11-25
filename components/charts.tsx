// Small dependency-free SVG charts, rendered on the server.
type Pt = [number, number];
const smooth = (p: Pt[]) => {
  if (p.length < 2) return '';
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
};
const nice = (m: number) => { if (m <= 0) return 1; const p = 10 ** Math.floor(Math.log10(m)), n = m / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
export const short = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : `${Math.round(n)}`);

export function Spark({ data, color = '#6b4cff', id }: { data: number[]; color?: string; id: string }) {
  const max = Math.max(...data, 1), W = 100, H = 34;
  const pts: Pt[] = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * W, H - 3 - (v / max) * (H - 8)]);
  const line = smooth(pts);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="spark" aria-hidden="true">
      <defs><linearGradient id={`s${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".28" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {line && <><path d={`${line} L${W},${H} L0,${H}Z`} fill={`url(#s${id})`} /><path d={line} fill="none" stroke={color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" strokeLinecap="round" /></>}
    </svg>
  );
}

export function AreaChart({ labels, data, fmt, color = '#6b4cff', id }: { labels: string[]; data: number[]; fmt: (n: number) => string; color?: string; id: string }) {
  const W = 760, H = 270, L = 50, R = 14, T = 18, B = 30, max = nice(Math.max(...data, 1));
  const x = (i: number) => L + (i / Math.max(1, data.length - 1)) * (W - L - R), y = (v: number) => T + (1 - v / max) * (H - T - B);
  const pts: Pt[] = data.map((v, i) => [x(i), y(v)]), line = smooth(pts), peak = data.indexOf(Math.max(...data));
  const step = Math.ceil(labels.length / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Chart">
      <defs><linearGradient id={`a${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={color} stopOpacity=".3" /><stop offset="1" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(g => { const v = (max / 4) * g, yy = y(v); return <g key={g}><line className="grid" x1={L} x2={W - R} y1={yy} y2={yy} /><text className="ax" x={L - 8} y={yy + 4} textAnchor="end">{fmt(v)}</text></g>; })}
      {line && <><path d={`${line} L${x(data.length - 1)},${H - B} L${x(0)},${H - B}Z`} fill={`url(#a${id})`} /><path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" /></>}
      {labels.map((l, i) => i % step === 0 && <text key={i} className="ax" x={x(i)} y={H - 8} textAnchor="middle">{l}</text>)}
      {data.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={i === peak && v > 0 ? 6 : 9} fill={i === peak && v > 0 ? color : 'transparent'} stroke={i === peak && v > 0 ? 'var(--card)' : 'none'} strokeWidth="3"><title>{`${labels[i]}: ${fmt(v)}`}</title></circle>)}
    </svg>
  );
}

export function Bars({ labels, data, color = '#ff8a4c', fmt = (n: number) => String(n) }: { labels: string[]; data: number[]; color?: string; fmt?: (n: number) => string }) {
  const W = 760, H = 220, L = 34, B = 28, T = 12, max = nice(Math.max(...data, 1)), bw = (W - L) / data.length;
  const step = Math.ceil(labels.length / 10);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="Bar chart">
      {[0, 1, 2, 3].map(g => { const v = (max / 3) * g, yy = T + (1 - v / max) * (H - T - B); return <g key={g}><line className="grid" x1={L} x2={W} y1={yy} y2={yy} /><text className="ax" x={L - 6} y={yy + 4} textAnchor="end">{fmt(Math.round(v))}</text></g>; })}
      {data.map((v, i) => { const h = (v / max) * (H - T - B); return <g key={i}><rect x={L + i * bw + bw * 0.2} y={H - B - h} width={bw * 0.6} height={Math.max(h, 0)} rx={Math.min(8, bw * 0.3)} fill={color} opacity={v ? 1 : 0.18}><title>{`${labels[i]}: ${fmt(v)}`}</title></rect>{i % step === 0 && <text className="ax" x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle">{labels[i]}</text>}</g>; })}
    </svg>
  );
}

export function Donut({ parts, big, small }: { parts: { label: string; value: number; color: string }[]; big: string; small: string }) {
  const total = parts.reduce((s, p) => s + p.value, 0), R = 62, C = 2 * Math.PI * R;
  let off = 0;
  return (
    <div className="donut">
      <svg viewBox="0 0 160 160" width="170" height="170" role="img" aria-label="Donut chart">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--line)" strokeWidth="16" />
        {total > 0 && parts.map(p => { const len = (p.value / total) * C, el = <circle key={p.label} cx="80" cy="80" r={R} fill="none" stroke={p.color} strokeWidth="16" strokeDasharray={`${Math.max(len - 3, 0)} ${C}`} strokeDashoffset={-off} transform="rotate(-90 80 80)" strokeLinecap="round"><title>{`${p.label}: ${p.value}`}</title></circle>; off += len; return el; })}
        <text x="80" y="82" textAnchor="middle" className="dbig">{big}</text><text x="80" y="100" textAnchor="middle" className="dsmall">{small}</text>
      </svg>
      <ul className="legend">{parts.map(p => <li key={p.label}><i style={{ background: p.color }} />{p.label}<b>{p.value}</b></li>)}</ul>
    </div>
  );
}
