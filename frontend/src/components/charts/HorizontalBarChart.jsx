import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { axisTick, CHART } from './chartTheme';
import ChartTooltip from './ChartTooltip';

/** Magnitude by category, one hue. data: [{ label, value }]. */
export default function HorizontalBarChart({ data, valueLabel = 'Count', formatValue = (v) => v, domain, labelWidth = 130 }) {
  const height = Math.max(160, data.length * 40 + 30);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 4 }} barCategoryGap={10}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} />
          <XAxis type="number" domain={domain || [0, 'auto']} allowDecimals={false} tick={axisTick}
                 axisLine={{ stroke: CHART.axis }} tickLine={false} />
          <YAxis type="category" dataKey="label" width={labelWidth} tick={{ ...axisTick, fill: CHART.ink }}
                 axisLine={{ stroke: CHART.axis }} tickLine={false} />
          <Tooltip cursor={{ fill: CHART.cursor }}
                   content={<ChartTooltip valueLabel={valueLabel} formatValue={formatValue} />} />
          <Bar dataKey="value" fill={CHART.series} barSize={20} radius={[0, 4, 4, 0]} isAnimationActive={false}>
            <LabelList dataKey="value" position="right" formatter={formatValue} fill={CHART.muted} fontSize={12} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
