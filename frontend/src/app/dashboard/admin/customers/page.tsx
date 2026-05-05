'use client';

import { useState, useEffect } from 'react';
import { adminCustomersApi } from '@/lib/api';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created_at: string;
}

interface CustomerOrder {
  id: string;
  pickup_code: string;
  status: string;
  total_amount: number;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<Customer | null>(null);
  const [detail, setDetail]       = useState<{ customer: Customer; orders: CustomerOrder[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      adminCustomersApi.getAll(search || undefined)
        .then(({ data }) => setCustomers(data as Customer[]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function openCustomer(c: Customer) {
    setSelected(c);
    setDetail(null);
    setDetailLoading(true);
    try {
      const { data } = await adminCustomersApi.getById(c.id);
      setDetail(data as { customer: Customer; orders: CustomerOrder[] });
    } finally {
      setDetailLoading(false);
    }
  }

  const statusColor: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    ready:     'bg-green-100 text-green-700',
    completed: 'bg-gray-100 text-gray-600',
    cancelled: 'bg-red-100 text-red-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-800">Customers</h1>
        <span className="text-sm text-gray-500">{customers.length} total</span>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Customer list */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              {search ? 'No customers match your search.' : 'No customers yet.'}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100 overflow-hidden">
              {customers.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openCustomer(c)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                    selected?.id === c.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-semibold text-sm shrink-0">
                      {c.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate">{c.email}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Customer detail */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
              <p className="text-4xl mb-3">👥</p>
              <p>Select a customer to view details</p>
            </div>
          ) : detailLoading ? (
            <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-400">
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          ) : detail ? (
            <div className="space-y-4">
              {/* Profile card */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-700 font-bold text-lg">
                    {detail.customer.name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{detail.customer.name}</p>
                    <p className="text-sm text-gray-500">{detail.customer.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Phone</p>
                    <p className="font-medium text-gray-700">{detail.customer.phone ?? '—'}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Member since</p>
                    <p className="font-medium text-gray-700">
                      {new Date(detail.customer.created_at).toLocaleDateString('en-NG', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Total orders</p>
                    <p className="font-bold text-gray-800">{detail.orders.length}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">Total spent</p>
                    <p className="font-bold text-green-700">
                      ₦{detail.orders
                        .filter((o) => o.status !== 'cancelled')
                        .reduce((s, o) => s + Number(o.total_amount), 0)
                        .toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Order history */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-800 text-sm">Order History</h3>
                </div>
                {detail.orders.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">No orders yet.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {detail.orders.map((o) => (
                      <div key={o.id} className="px-5 py-3 flex items-center justify-between">
                        <div>
                          <p className="font-mono font-bold text-green-600 text-sm">{o.pickup_code}</p>
                          <p className="text-xs text-gray-400">
                            {new Date(o.created_at).toLocaleDateString('en-NG', {
                              day: 'numeric', month: 'short', year: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-semibold text-sm text-gray-800">
                            ₦{Number(o.total_amount).toLocaleString()}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[o.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {o.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
