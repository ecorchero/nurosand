type Props = {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  color?: string;
};

export default function RingProgress({
  value,
  size = 120,
  stroke = 10,
  label,
  sublabel,
  color = "var(--accent)",
}: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
        <div className="text-2xl font-semibold tabular-nums" style={{ fontFamily: "var(--font-serif), Georgia, serif" }}>
          {Math.round(pct)}%
        </div>
        {label && <div className="text-[11px] leading-tight muted">{label}</div>}
        {sublabel && <div className="text-[10px] muted">{sublabel}</div>}
      </div>
    </div>
  );
}
