'use client';

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// Design token colors
const COLORS = {
  green: '#C5DE8A',
  amber: '#FFCE73',
  red: '#E74C3C',
  primary: '#2D2D2D',
  secondary: '#6B6B6B',
};

function generateMockTimeSeries(days: number, baseValue: number, variance: number) {
  return Array.from({ length: days }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - i));
    return {
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: baseValue + Math.floor(Math.random() * variance * 2 - variance),
    };
  });
}

// Seeded data so it doesn't re-randomize on every render
const fundingData = generateMockTimeSeries(30, 50000, 8000);
const coverageData = generateMockTimeSeries(30, 85, 10).map((d) => ({
  ...d,
  value: Math.min(100, Math.max(40, d.value)),
}));

const volumeData = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() - (29 - i));
  return {
    date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    deposits: Math.floor(Math.random() * 5) + 1,
    withdrawals: Math.floor(Math.random() * 3),
    buys: Math.floor(Math.random() * 8) + 2,
    sells: Math.floor(Math.random() * 6) + 1,
  };
});

const feeData = [
  { name: 'Listing Fees', value: 2400 },
  { name: 'Issuance Fees', value: 4500 },
  { name: 'Liquidity Fees', value: 3200 },
];

const PIE_COLORS = [COLORS.green, COLORS.amber, COLORS.primary];

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] bg-white border border-[var(--color-border)] p-[var(--padding-card)] shadow-[var(--shadow-card)]">
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)] mb-4">
        {title}
      </h3>
      <div className="h-56">{children}</div>
    </div>
  );
}

export function AnalyticsPage() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-6">Analytics</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Funding Balance Over Time */}
        <ChartCard title="Funding Balance Over Time">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={fundingData}>
              <defs>
                <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={COLORS.green} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, 'Balance']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
              />
              <Area type="monotone" dataKey="value" stroke={COLORS.green} fill="url(#gradGreen)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Transaction Volume */}
        <ChartCard title="Transaction Volume">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="deposits" stackId="a" fill={COLORS.green} radius={[0, 0, 0, 0]} />
              <Bar dataKey="withdrawals" stackId="a" fill={COLORS.red} />
              <Bar dataKey="buys" stackId="a" fill={COLORS.amber} />
              <Bar dataKey="sells" stackId="a" fill={COLORS.primary} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Coverage Trend */}
        <ChartCard title="Assurance Coverage Trend">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={coverageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.secondary }} interval={6} />
              <YAxis tick={{ fontSize: 10, fill: COLORS.secondary }} domain={[0, 100]} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                formatter={(value: unknown) => [`${Number(value)}%`, 'Coverage']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
              />
              <Line type="monotone" dataKey="value" stroke={COLORS.amber} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Fee Summary */}
        <ChartCard title="Fee Summary">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={feeData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {feeData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: unknown) => [`$${Number(value).toLocaleString()}`, 'Fees']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #eee' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
