'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import { adminAnalyticsApi, productsApi } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import type {
  AnalyticsDashboardData, ProductPerformance,
  RevenuePoint, StaffPerformance, Product,
} from '@/types';

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const todayStr = () => new Date().toISOString().split('T')[0];

function exportCSV(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  const csv  = [
    keys.join(','),
    ...rows.map((r) => keys.map((k) => JSON.stringify(r[k] ?? '')).join(',')),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const a   = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Shared components ────────────────────────────────────────────────────────
function ChartTip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name === 'revenue' || p.name === 'Revenue'
            ? `Revenue: ${fmt(Number(p.value))}`
            : `Sales: ${p.value}`}
        </p>
      ))}
    </div>
  );
}

function Kpi({
  label, value, sub, trend,
}: {
  label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="card p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-secondary truncate">{value}</p>
      {sub && (
        <p className={`text-xs mt-1 font-medium ${
          trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-400'
        }`}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ChartSkeleton() {
  return <div className="h-64 animate-pulse bg-gray-100 rounded-xl" />;
}

function EmptyChart({ msg = 'No data yet.' }: { msg?: string }) {
  return (
    <div className="h-64 flex items-center justify-center">
      <p className="text-gray-400 text-sm">{msg}</p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const [data, setData]         = useState<AnalyticsDashboardData | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [entry, setEntry]       = useState({
    product_id: '', date: todayStr(), sales_count: '', revenue: '',
  });
  const [saving, setSaving]     = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    Promise.all([adminAnalyticsApi.getDashboard(), productsApi.getAll()])
      .then(([{ data: d }, { data: p }]) => {
        setData(d as AnalyticsDashboardData);
        setProducts(p as Product[]);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleEntry(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await adminAnalyticsApi.manualEntry({
        product_id:  entry.product_id || undefined,
        date:        entry.date,
        sales_count: Number(entry.sales_count),
        revenue:     Number(entry.revenue),
      });
      setFeedback('Entry saved successfully!');
      setEntry({ product_id: '', date: todayStr(), sales_count: '', revenue: '' });
    } catch {
      setFeedback('Failed to save entry. Please try again.');
    } finally {
      setSaving(false);
      setTimeout(() => setFeedback(''), 4000);
    }
  }

  if (loading) return (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl" />)}
      </div>
      <div className="h-72 bg-gray-100 rounded-2xl" />
    </div>
  );

  if (!data) return <p className="text-center text-gray-400 py-16">Failed to load analytics.</p>;

  const momPct  = data.mom_change_pct;
  const momSub  = momPct === null
    ? 'No prior month data'
    : `${momPct >= 0 ? '+' : ''}${momPct}% vs last month`;
  const trend   = momPct === null ? 'neutral' : momPct >= 0 ? 'up' : 'down';

  return (
    <div className="space-y-8">
      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="All-time Revenue"  value={fmt(data.all_time_revenue)} />
        <Kpi label="All-time Sales"    value={data.all_time_sales.toLocaleString()} />
        <Kpi label="This Month"        value={fmt(data.this_month_revenue)} sub={momSub} trend={trend} />
        <Kpi label="Last Month"        value={fmt(data.last_month_revenue)} />
      </div>

      {/* Top 5 products bar chart */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Top Products — Last 30 Days</h3>
          <button
            onClick={() => exportCSV(data.top_products_30d as unknown as Record<string, unknown>[], 'top-products-30d.csv')}
            className="text-xs text-primary hover:underline"
          >
            Export CSV
          </button>
        </div>
        {data.top_products_30d.length === 0 ? (
          <EmptyChart msg="No product analytics data yet. Add manual entries below." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_products_30d} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTip />} />
                <Legend />
                <Bar dataKey="revenue"     name="Revenue"    fill="#1F7E5F" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales_count" name="Sales"      fill="#FFB84D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Manual entry form */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Manual Sales Entry</h3>
        {feedback && (
          <div className={`mb-4 p-3 rounded-xl text-sm ${
            feedback.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}>
            {feedback}
          </div>
        )}
        <form onSubmit={handleEntry} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Product (optional)</label>
            <select
              className="input-field"
              value={entry.product_id}
              onChange={(e) => setEntry((f) => ({ ...f, product_id: e.target.value }))}
            >
              <option value="">— none —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Date *</label>
            <input
              type="date" required className="input-field"
              value={entry.date}
              onChange={(e) => setEntry((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Sales Count *</label>
            <input
              type="number" min="0" required className="input-field" placeholder="0"
              value={entry.sales_count}
              onChange={(e) => setEntry((f) => ({ ...f, sales_count: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Revenue (₦) *</label>
            <input
              type="number" min="0" step="0.01" required className="input-field" placeholder="0.00"
              value={entry.revenue}
              onChange={(e) => setEntry((f) => ({ ...f, revenue: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" disabled={saving} className="btn-primary px-8 py-2.5">
              {saving ? 'Saving…' : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: REVENUE
// ══════════════════════════════════════════════════════════════════════════════
function RevenueTab() {
  const [period, setPeriod]   = useState<'daily' | 'monthly' | 'yearly'>('monthly');
  const [data, setData]       = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    adminAnalyticsApi.getRevenue({ period })
      .then(({ data: d }) => setData(d as RevenuePoint[]))
      .finally(() => setLoading(false));
  }, [period]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['daily', 'monthly', 'yearly'] as const).map((p) => (
            <button
              key={p} onClick={() => setPeriod(p)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium capitalize transition-colors ${
                period === p
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-primary hover:text-primary'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
        <button
          onClick={() => exportCSV(data as unknown as Record<string, unknown>[], `revenue-${period}.csv`)}
          className="text-sm text-primary hover:underline"
        >
          Export CSV
        </button>
      </div>

      {/* Line chart */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4 capitalize">{period} Revenue Trend</h3>
        {loading ? <ChartSkeleton /> : data.length === 0 ? (
          <EmptyChart msg="No revenue data for this period." />
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTip />} />
                <Legend />
                <Line
                  type="monotone" dataKey="revenue" name="Revenue"
                  stroke="#1F7E5F" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#1F7E5F' }}
                />
                <Line
                  type="monotone" dataKey="sales_count" name="Sales"
                  stroke="#FFB84D" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#FFB84D' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Data table */}
      {!loading && data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 pr-8">Period</th>
                <th className="pb-2 pr-8">Revenue</th>
                <th className="pb-2">Sales Count</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.label} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-8 font-mono text-gray-600 text-xs">{row.label}</td>
                  <td className="py-2.5 pr-8 font-semibold text-primary">{fmt(row.revenue)}</td>
                  <td className="py-2.5 text-gray-500">{row.sales_count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold text-gray-700">
                <td className="pt-2 pr-8">Total</td>
                <td className="pt-2 pr-8 text-primary">{fmt(data.reduce((s, r) => s + r.revenue, 0))}</td>
                <td className="pt-2">{data.reduce((s, r) => s + r.sales_count, 0)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: PRODUCTS
// ══════════════════════════════════════════════════════════════════════════════
function ProductsTab() {
  const [data, setData]       = useState<ProductPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart]     = useState('');
  const [end, setEnd]         = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminAnalyticsApi
      .getProducts({ start: start || undefined, end: end || undefined })
      .then(({ data: d }) => setData(d as ProductPerformance[]))
      .finally(() => setLoading(false));
  }, [start, end]);

  // Initial load only — user clicks Apply to re-filter
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" className="input-field w-44" value={start}
            onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" className="input-field w-44" value={end}
            onChange={(e) => setEnd(e.target.value)} />
        </div>
        <button onClick={load} className="btn-primary px-6 py-2.5">Apply</button>
        <button
          onClick={() => exportCSV(data as unknown as Record<string, unknown>[], 'product-analytics.csv')}
          className="text-sm text-primary hover:underline self-end mb-0.5"
        >
          Export CSV
        </button>
      </div>

      {/* Horizontal bar chart */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Product Revenue (Top 10)</h3>
        {loading ? <ChartSkeleton /> : data.length === 0 ? (
          <EmptyChart />
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.slice(0, 10)}
                layout="vertical"
                margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 10 }}
                />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={110} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#1F7E5F" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Table */}
      {!loading && data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="pb-2 pr-4 w-8">#</th>
                <th className="pb-2 pr-4">Product</th>
                <th className="pb-2 pr-4 hidden sm:table-cell">Category</th>
                <th className="pb-2 pr-4">Revenue</th>
                <th className="pb-2">Sales</th>
              </tr>
            </thead>
            <tbody>
              {data.map((p, i) => (
                <tr key={p.product_id} className="border-b border-gray-50 last:border-0">
                  <td className="py-2.5 pr-4 text-gray-400 font-mono text-xs">{i + 1}</td>
                  <td className="py-2.5 pr-4 font-medium text-gray-800">{p.name}</td>
                  <td className="py-2.5 pr-4 text-gray-500 hidden sm:table-cell">{p.category}</td>
                  <td className="py-2.5 pr-4 font-semibold text-primary">{fmt(p.revenue)}</td>
                  <td className="py-2.5 text-gray-500">{p.sales_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: STAFF PERFORMANCE
// ══════════════════════════════════════════════════════════════════════════════
function StaffPerfTab() {
  const [data, setData]       = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart]     = useState('');
  const [end, setEnd]         = useState('');
  const MEDALS = ['🥇', '🥈', '🥉'];

  const load = useCallback(() => {
    setLoading(true);
    adminAnalyticsApi
      .getStaffPerformance({ start: start || undefined, end: end || undefined })
      .then(({ data: d }) => setData(d as StaffPerformance[]))
      .finally(() => setLoading(false));
  }, [start, end]);

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input type="date" className="input-field w-44" value={start}
            onChange={(e) => setStart(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input type="date" className="input-field w-44" value={end}
            onChange={(e) => setEnd(e.target.value)} />
        </div>
        <button onClick={load} className="btn-primary px-6 py-2.5">Apply</button>
        <button
          onClick={() => exportCSV(data as unknown as Record<string, unknown>[], 'staff-performance.csv')}
          className="text-sm text-primary hover:underline self-end mb-0.5"
        >
          Export CSV
        </button>
      </div>

      {/* Bar chart */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Revenue by Staff Member</h3>
        {loading ? <ChartSkeleton /> : data.length === 0 ? (
          <EmptyChart msg="No staff performance data. Assign staff_id in analytics entries to track." />
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.slice(0, 10)} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#2D5A3D" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top performers ranking */}
      {!loading && data.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Top Performers Ranking</h3>
          <div className="space-y-3">
            {data.map((s, i) => (
              <div
                key={s.staff_id}
                className={`flex items-center gap-4 p-3 rounded-xl ${
                  i < 3 ? 'bg-accent/10 border border-accent/20' : 'bg-gray-50'
                }`}
              >
                <span className="text-xl w-8 text-center shrink-0">
                  {MEDALS[i] ?? <span className="text-gray-400 text-sm font-bold">#{i + 1}</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-400 truncate">{s.email}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-primary">{fmt(s.revenue)}</p>
                  <p className="text-xs text-gray-400">{s.sales_count} sales</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE SHELL
// ══════════════════════════════════════════════════════════════════════════════
type AnalyticsTab = 'overview' | 'revenue' | 'products' | 'staff';

const TABS: { key: AnalyticsTab; label: string }[] = [
  { key: 'overview', label: 'Overview'          },
  { key: 'revenue',  label: 'Revenue'            },
  { key: 'products', label: 'Product Analysis'   },
  { key: 'staff',    label: 'Staff Performance'  },
];

function AnalyticsContent() {
  const [tab, setTab] = useState<AnalyticsTab>('overview');

  return (
    <div className="flex flex-col gap-0 -mx-4 sm:-mx-6 -mt-6">
      {/* Tab nav */}
      <nav className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex px-4 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <div className="px-4 sm:px-6 py-6">
        {tab === 'overview'  && <OverviewTab />}
        {tab === 'revenue'   && <RevenueTab />}
        {tab === 'products'  && <ProductsTab />}
        {tab === 'staff'     && <StaffPerfTab />}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute requiredRole="manager">
      <AnalyticsContent />
    </ProtectedRoute>
  );
}
