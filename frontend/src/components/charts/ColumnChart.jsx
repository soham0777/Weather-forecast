import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, CHART } from './chartTheme';
import ChartTooltip from './ChartTooltip';

/** Counts over ordered periods (e.g. months), one hue. data: [{ label, value }]. */
export default function ColumnChart({ data, valueLabel = 'Count', formatLabel = (l) => l, height = 240 }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -16 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" tickFormatter={formatLabel} tick={axisTick} axisLine={{ stroke: CHART.axis }} tickLine={false} />
          <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: CHART.cursor }}
                   content={<ChartTooltip valueLabel={valueLabel} formatLabel={formatLabel} />} />
          <Bar dataKey="value" fill={CHART.series} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
