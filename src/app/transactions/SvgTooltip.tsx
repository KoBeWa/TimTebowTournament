// Small tooltip box drawn inside the chart SVGs
export default function SvgTooltip({ x, y, lines, W, H }: { x: number; y: number; lines: string[]; W: number; H: number }) {
  const PAD = 6, LINE_H = 13, boxW = 110;
  const boxH = lines.length * LINE_H + PAD * 2;
  const tx = x + 10 + boxW > W ? x - boxW - 8 : x + 10;
  const ty = y - boxH / 2 < 0 ? 4 : y + boxH / 2 > H ? H - boxH - 4 : y - boxH / 2;
  return (
    <g pointerEvents="none">
      <rect x={tx} y={ty} width={boxW} height={boxH} rx={6} className="fill-solid stroke-border" strokeWidth={1} />
      {lines.map((l, i) => (
        <text key={i} x={tx + PAD} y={ty + PAD + LINE_H * i + 9}
          style={{ fontSize: "11px", fill: "var(--color-ink)", fontFamily: i === 0 ? "inherit" : "var(--font-outlier)", fontWeight: i === 0 ? "500" : "400" }}>
          {l}
        </text>
      ))}
    </g>
  );
}
