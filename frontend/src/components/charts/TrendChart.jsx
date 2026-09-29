import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, CHART } from './chartTheme';
import ChartTooltip from './ChartTooltip';

/** Change over time: 2px line with a 10% wash and a crosshair tooltip. data: [{ label, value }]. */
export default function TrendChart({ data, valueLabel = 'Count', formatLabel = (l) => l, height = 240 }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -16 }}>
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" tickFormatter={formatLabel} tick={axisTick} axisLine={{ stroke: CHART.axis }}
                 tickLine={false} minTickGap={24} />
          <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ stroke: CHART.axis, strokeWidth: 1 }}
                   content={<ChartTooltip valueLabel={valueLabel} formatLabel={formatLabel} />} />
          <Area type="monotone" dataKey="value" stroke={CHART.series} strokeWidth={2} fill={CHART.seriesWash}
                dot={false} activeDot={{ r: 4, fill: CHART.series, stroke: CHART.surface, strokeWidth: 2 }}
                isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
