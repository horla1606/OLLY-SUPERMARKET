'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { adminStaffApi, adminAnalyticsApi } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { Staff, StaffPerformance } from '@/types';

// ─── Utilities ────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ══════════════════════════════════════════════════════════════════════════════
// Duty Calendar
// ══════════════════════════════════════════════════════════════════════════════
function MonthCalendar({
  year, month, duties, busy,
  onToggle, onPrev, onNext,
}: {
  year: number; month: number;
  duties: string[]; busy: boolean;
  onToggle: (d: string) => void;
  onPrev: () => void; onNext: () => void;
}) {
  const firstDow    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayISO    = new Date().toISOString().split('T')[0];

  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { iso, day };
  });

  return (
    <div>
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={onPrev}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-gray-700">
          {MONTH_NAMES[month]} {year}
        </span>
        <button
          onClick={onNext}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="text-center text-xs text-gray-400 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-0.5">
        {Array(firstDow).fill(null).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map(({ iso, day }) => {
          const onDuty  = duties.includes(iso);
          const isToday = iso === todayISO;
          return (
            <button
              key={iso}
              disabled={busy}
              onClick={() => onToggle(iso)}
              title={onDuty ? 'Click to remove duty' : 'Click to assign duty'}
              className={`h-9 w-9 mx-auto rounded-full text-xs font-medium transition-colors disabled:opacity-50 ${
                onDuty
                  ? 'bg-primary text-white hover:bg-primary/80'
                  : isToday
                  ? 'ring-2 ring-primary text-primary'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-400 mt-3 text-center">
        Green = on duty · Click to toggle
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Staff list
// ══════════════════════════════════════════════════════════════════════════════
function StaffListSection({
  staff, loading,
  onEdit, onDelete,
}: {
  staff: Staff[]; loading: boolean;
  onEdit: (s: Staff) => void;
  onDelete: (id: string) => void;
}) {
  if (loading) return (
    <div className="animate-pulse space-y-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
    </div>
  );

  if (staff.length === 0) return (
    <p className="text-center text-gray-400 py-12 text-sm">No staff members yet. Add one below.</p>
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="pb-2 pr-4">Name</th>
            <th className="pb-2 pr-4 hidden sm:table-cell">Email</th>
            <th className="pb-2 pr-4 hidden md:table-cell">Phone</th>
            <th className="pb-2 pr-4 hidden lg:table-cell">Hire Date</th>
            <th className="pb-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s) => (
            <tr key={s.id} className="border-b border-gray-50 last:border-0">
              <td className="py-2.5 pr-4 font-medium text-gray-800">{s.name}</td>
              <td className="py-2.5 pr-4 text-gray-500 text-xs hidden sm:table-cell">{s.email}</td>
              <td className="py-2.5 pr-4 text-gray-500 hidden md:table-cell">{s.phone ?? '—'}</td>
              <td className="py-2.5 pr-4 text-gray-500 hidden lg:table-cell">{s.hire_date}</td>
              <td className="py-2.5 text-right">
                <button
                  onClick={() => onEdit(s)}
                  className="text-primary hover:underline text-xs mr-4"
                >
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${s.name}?`)) onDelete(s.id);
                  }}
                  className="text-red-500 hover:underline text-xs"
                >
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Staff add / edit form
// ══════════════════════════════════════════════════════════════════════════════
function StaffForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: Staff | null;
  onSave: (id: string | null, data: Partial<Staff>) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name:      initial?.name      ?? '',
    email:     initial?.email     ?? '',
    phone:     initial?.phone     ?? '',
    hire_date: initial?.hire_date ?? new Date().toISOString().split('T')[0],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(initial?.id ?? null, {
        name:      form.name.trim(),
        email:     form.email.trim(),
        phone:     form.phone.trim() || undefined,
        hire_date: form.hire_date,
      });
      if (!initial) {
        setForm({ name: '', email: '', phone: '', hire_date: new Date().toISOString().split('T')[0] });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Save failed. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  const field = (
    key: keyof typeof form, label: string,
    type = 'text', required = true,
  ) => (
    <div>
      <label className="block text-xs text-gray-500 mb-1">
        {label}{!required && <span className="text-gray-400"> (optional)</span>}
      </label>
      <input
        type={type} required={required} className="input-field"
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field('name',      'Full Name')}
        {field('email',     'Email Address', 'email')}
        {field('phone',     'Phone',         'tel', false)}
        {field('hire_date', 'Hire Date',     'date')}
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="btn-primary px-6 py-2">
          {saving ? 'Saving…' : initial ? 'Update Staff' : 'Add Staff Member'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">
          Cancel
        </button>
      </div>
    </form>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Duty assignment tab
// ══════════════════════════════════════════════════════════════════════════════
function DutyTab({ staff }: { staff: Staff[] }) {
  const now = new Date();
  const [selectedId, setSelectedId]   = useState('');
  const [year, setYear]               = useState(now.getFullYear());
  const [month, setMonth]             = useState(now.getMonth());
  const [duties, setDuties]           = useState<string[]>([]);
  const [loadingDuties, setLoadingDuties] = useState(false);
  const [toggling, setToggling]       = useState(false);
  const [checkDate, setCheckDate]     = useState(now.toISOString().split('T')[0]);
  const [onDutyStaff, setOnDutyStaff] = useState<Array<{ staff?: { name: string } }>>([]);
  const [checked, setChecked]         = useState(false);

  const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  const loadDuties = useCallback(async () => {
    if (!selectedId) { setDuties([]); return; }
    setLoadingDuties(true);
    try {
      const { data } = await adminStaffApi.getDuties(selectedId, monthKey);
      setDuties((data as Array<{ date: string }>).map((d) => d.date));
    } finally {
      setLoadingDuties(false);
    }
  }, [selectedId, monthKey]);

  useEffect(() => { loadDuties(); }, [loadDuties]);

  async function toggleDuty(dateStr: string) {
    if (!selectedId || toggling) return;
    const action: 'assign' | 'remove' = duties.includes(dateStr) ? 'remove' : 'assign';
    setToggling(true);
    setDuties((prev) =>
      action === 'assign' ? [...prev, dateStr] : prev.filter((d) => d !== dateStr)
    );
    try {
      await adminStaffApi.assignDuty(selectedId, dateStr, action);
    } catch {
      await loadDuties(); // revert on error
    } finally {
      setToggling(false);
    }
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
  }

  async function checkWhoOnDuty() {
    const { data } = await adminStaffApi.getDutyByDate(checkDate);
    setOnDutyStaff(data as Array<{ staff?: { name: string } }>);
    setChecked(true);
  }

  const selectedStaff = staff.find((s) => s.id === selectedId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Calendar panel */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Assign Duty Dates</h3>

        <div className="mb-4">
          <label className="block text-xs text-gray-500 mb-1">Staff Member</label>
          <select
            className="input-field"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            <option value="">— select a staff member —</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {selectedStaff && (
          <div className="mb-3 px-3 py-2 bg-primary/5 rounded-xl text-xs text-primary font-medium">
            Managing duties for: {selectedStaff.name}
            {loadingDuties && <span className="ml-2 text-gray-400">Loading…</span>}
          </div>
        )}

        {selectedId ? (
          <MonthCalendar
            year={year} month={month}
            duties={duties} busy={loadingDuties || toggling}
            onToggle={toggleDuty}
            onPrev={prevMonth} onNext={nextMonth}
          />
        ) : (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">📅</p>
            <p className="text-gray-400 text-sm">Select a staff member to manage their duty schedule.</p>
          </div>
        )}
      </div>

      {/* Who's on duty panel */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Who&apos;s On Duty</h3>
        <div className="flex gap-3 mb-4">
          <input
            type="date"
            className="input-field flex-1"
            value={checkDate}
            onChange={(e) => { setCheckDate(e.target.value); setChecked(false); }}
          />
          <button onClick={checkWhoOnDuty} className="btn-primary px-4 py-2 shrink-0">
            Check
          </button>
        </div>

        {checked && onDutyStaff.length === 0 && (
          <div className="text-center py-8">
            <p className="text-2xl mb-2">📭</p>
            <p className="text-sm text-gray-400">No staff assigned for this date.</p>
          </div>
        )}

        {onDutyStaff.length > 0 && (
          <ul className="space-y-2">
            {onDutyStaff.map((d, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-100 rounded-xl">
                <span className="text-green-600 font-bold text-lg">✓</span>
                <span className="font-medium text-gray-800 text-sm">{d.staff?.name ?? 'Unknown'}</span>
              </li>
            ))}
          </ul>
        )}

        {!checked && (
          <p className="text-sm text-gray-400 text-center pt-6">
            Pick a date and click Check to see the duty roster.
          </p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Performance tab
// ══════════════════════════════════════════════════════════════════════════════
function PerformanceTab() {
  const [data, setData]       = useState<StaffPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const MEDALS = ['🥇', '🥈', '🥉'];

  useEffect(() => {
    adminAnalyticsApi.getStaffPerformance()
      .then(({ data: d }) => setData(d as StaffPerformance[]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="animate-pulse space-y-6">
      <div className="h-64 bg-gray-100 rounded-2xl" />
      <div className="h-48 bg-gray-100 rounded-2xl" />
    </div>
  );

  if (data.length === 0) return (
    <div className="card text-center py-16">
      <p className="text-3xl mb-3">📊</p>
      <p className="text-gray-400 text-sm">
        No performance data yet.
        <br />Log analytics entries with a staff_id to track performance.
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Bar chart */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Revenue by Staff — Last 30 Days</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 8)} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis
                tickFormatter={(v: number) => `₦${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
              />
              <Tooltip formatter={(v: number) => [fmt(v), 'Revenue']} />
              <Bar dataKey="revenue" fill="#1F7E5F" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rankings */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Top Performers</h3>
        <div className="space-y-3">
          {data.map((s, i) => (
            <div
              key={s.staff_id}
              className={`flex items-center gap-4 p-3 rounded-xl ${
                i < 3 ? 'bg-accent/10 border border-accent/20' : 'bg-gray-50'
              }`}
            >
              <span className="text-xl w-8 text-center shrink-0">
                {MEDALS[i] ?? <span className="text-sm font-bold text-gray-400">#{i + 1}</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{s.name}</p>
                <p className="text-xs text-gray-400 truncate">{s.email}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-primary text-sm">{fmt(s.revenue)}</p>
                <p className="text-xs text-gray-400">{s.sales_count} sales</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// PAGE SHELL
// ══════════════════════════════════════════════════════════════════════════════
type StaffTabKey = 'list' | 'duties' | 'performance';

const TABS: { key: StaffTabKey; label: string }[] = [
  { key: 'list',        label: 'Staff List'       },
  { key: 'duties',      label: 'Duty Assignment'  },
  { key: 'performance', label: 'Performance'      },
];

function StaffContent() {
  const [tab, setTab]       = useState<StaffTabKey>('list');
  const [staff, setStaff]   = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing]   = useState<Staff | null>(null);
  const [showForm, setShowForm] = useState(false);

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminStaffApi.getAll();
      setStaff(data as Staff[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStaff(); }, [loadStaff]);

  async function handleSave(id: string | null, data: Partial<Staff>) {
    if (id) {
      await adminStaffApi.update(id, data);
      setEditing(null);
    } else {
      await adminStaffApi.create(data);
      setShowForm(false);
    }
    await loadStaff();
  }

  function handleEdit(s: Staff) {
    setEditing(s);
    setShowForm(false);
  }

  function cancelForm() {
    setEditing(null);
    setShowForm(false);
  }

  return (
    <div className="flex flex-col gap-0 -mx-4 sm:-mx-6">
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
      <div className="px-4 sm:px-6 py-6 space-y-6">

        {/* ── Staff List tab ── */}
        {tab === 'list' && (
          <>
            <div className="card">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-semibold text-gray-800">
                  Staff Members
                  <span className="ml-2 text-gray-400 font-normal text-sm">({staff.length})</span>
                </h2>
                <button
                  onClick={() => { setShowForm((v) => !v); setEditing(null); }}
                  className="btn-primary text-sm px-4 py-2"
                >
                  {showForm ? 'Cancel' : '+ Add Staff'}
                </button>
              </div>
              <StaffListSection
                staff={staff} loading={loading}
                onEdit={handleEdit}
                onDelete={async (id) => {
                  await adminStaffApi.delete(id);
                  await loadStaff();
                }}
              />
            </div>

            {(showForm || editing) && (
              <div className="card">
                <h3 className="font-semibold text-gray-800 mb-4">
                  {editing ? `Edit: ${editing.name}` : 'Add New Staff Member'}
                </h3>
                <StaffForm
                  initial={editing}
                  onSave={handleSave}
                  onCancel={cancelForm}
                />
              </div>
            )}
          </>
        )}

        {/* ── Duty Assignment tab ── */}
        {tab === 'duties' && <DutyTab staff={staff} />}

        {/* ── Performance tab ── */}
        {tab === 'performance' && <PerformanceTab />}
      </div>
    </div>
  );
}

export default function StaffPage() {
  return (
    <ProtectedRoute requiredRole="manager">
      <StaffContent />
    </ProtectedRoute>
  );
}
