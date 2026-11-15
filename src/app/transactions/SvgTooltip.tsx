// Small tooltip box drawn inside the chart SVGs
export default function SvgTooltip({ x, y, lines, W, H }: { x: number; y: number; lines: string[]; W: number; H: number }) {
  const PAD = 6, LINE_H = 13, boxW = 110;
  const boxH = lines.length * LINE_H + PAD * 2;
  const tx = x + 10 + boxW > W ? x - boxW - 8 : x + 10;
  const ty = y - boxH / 2 < 0 ? 4 : y + boxH / 2 > H ? H - boxH - 4 : y - boxH / 2;
  return (
    <g pointerEvents="none">
      <rect x={tx} y={ty} width={boxW} height={boxH} rx={3} className="fill-red" opacity={0.88} />
      {lines.map((l, i) => (
        <text key={i} x={tx + PAD} y={ty + PAD + LINE_H * i + 9}
          style={{ fontSize: "10px", fill: "#fff", fontFamily: "inherit", fontWeight: i === 0 ? "600" : "400" }}>
          {l}
        </text>
      ))}
    </g>
  );
}
