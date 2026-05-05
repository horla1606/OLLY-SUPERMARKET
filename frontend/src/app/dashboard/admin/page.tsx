'use client';

import { useState, useEffect, useRef, ChangeEvent, FormEvent } from 'react';
import { adminApi, ordersApi, messagesApi } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import type {
  AdminDashboard, OrderWithCustomer, ExpiringProduct,
  Product, Order, Message, OrderStatus,
} from '@/types';

// ─── Entry point ──────────────────────────────────────────────────────────────
export default function AdminPage() {
  return (
    <ProtectedRoute requiredRole="manager">
      <AdminDashboardContent />
    </ProtectedRoute>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Tab = 'overview' | 'products' | 'orders' | 'inventory' | 'alerts' | 'messages';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview',   label: 'Overview',       icon: '📊' },
  { key: 'products',   label: 'Products',        icon: '🛍️' },
  { key: 'orders',     label: 'Orders',          icon: '📦' },
  { key: 'inventory',  label: 'Inventory',       icon: '📋' },
  { key: 'alerts',     label: 'Expiry Alerts',   icon: '⚠️' },
  { key: 'messages',   label: 'Messages',        icon: '💬' },
];

const CATEGORIES = ['Fresh Produce', 'Dairy & Eggs', 'Bakery', 'Beverages', 'Snacks', 'Household'];

// ─── Status colours ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:   'bg-yellow-100 text-yellow-700 border-yellow-200',
    confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
    ready:     'bg-green-100 text-green-700 border-green-200',
    completed: 'bg-gray-100 text-gray-600 border-gray-200',
    cancelled: 'bg-red-100 text-red-500 border-red-200',
    unread:    'bg-red-100 text-red-600 border-red-200',
    read:      'bg-gray-100 text-gray-500 border-gray-200',
    replied:   'bg-green-100 text-green-600 border-green-200',
    closed:    'bg-gray-100 text-gray-400 border-gray-200',
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${map[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {status}
    </span>
  );
}

// ─── Main dashboard component ─────────────────────────────────────────────────
function AdminDashboardContent() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="flex flex-col gap-0 -mx-4 sm:-mx-6 -mt-6">
      {/* ── Tab bar ── */}
      <nav className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex px-4 sm:px-6">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ── Content ── */}
      <div className="px-4 sm:px-6 py-6">
        {tab === 'overview'  && <OverviewTab />}
        {tab === 'products'  && <ProductsTab />}
        {tab === 'orders'    && <OrdersTab />}
        {tab === 'inventory' && <InventoryTab />}
        {tab === 'alerts'    && <ExpiryAlertsTab />}
        {tab === 'messages'  && <MessagesTab />}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: OVERVIEW
// ══════════════════════════════════════════════════════════════════════════════
function OverviewTab() {
  const [data, setData]     = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState('');

  useEffect(() => {
    adminApi.getDashboard()
      .then(({ data: d }) => setData(d as AdminDashboard))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton rows={5} />;
  if (error)   return <ErrorMsg msg={error} />;
  if (!data)   return null;

  const kpis = [
    { label: 'Total Customers',    value: data.customers.toLocaleString(),    icon: '👥', color: 'bg-blue-50 text-blue-700' },
    { label: 'Orders (30 days)',   value: data.orders_30d.toLocaleString(),   icon: '📦', color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Revenue (30 days)',  value: `₦${data.revenue_30d.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, icon: '💰', color: 'bg-green-50 text-green-700' },
    { label: 'Pending Orders',     value: data.pending_orders.length.toString(), icon: '⏳', color: 'bg-orange-50 text-orange-700' },
    { label: 'Low-Stock Products', value: data.low_stock.toString(),          icon: '⚠️', color: 'bg-red-50 text-red-700' },
  ];

  return (
    <div className="space-y-8">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="card text-center p-4">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-xl text-xl mb-3 ${k.color}`}>
              {k.icon}
            </div>
            <p className="text-2xl font-bold text-gray-800">{k.value}</p>
            <p className="text-xs text-gray-500 mt-1 leading-tight">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Active orders board */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          ⏳ Active Pending Orders
          <span className="bg-yellow-100 text-yellow-700 text-xs px-2 py-0.5 rounded-full font-medium">
            {data.pending_orders.length}
          </span>
        </h2>

        {data.pending_orders.length === 0 ? (
          <div className="card text-center py-12 text-gray-400">
            <p className="text-3xl mb-2">✅</p>
            No pending orders right now
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.pending_orders.map((order) => (
              <ActiveOrderCard key={order.id} order={order} onUpdate={() => {
                adminApi.getDashboard().then(({ data: d }) => setData(d as AdminDashboard)).catch(() => {});
              }} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── Active order card with inline status controls ─────────────────────────────
function ActiveOrderCard({ order, onUpdate }: { order: OrderWithCustomer; onUpdate: () => void }) {
  const [busy, setBusy] = useState(false);
  const items = order.items as Array<{ product_name: string; quantity: number; price: number }>;

  async function updateStatus(status: OrderStatus) {
    setBusy(true);
    try {
      await adminApi.updateOrderStatus(order.id, status);
      onUpdate();
    } finally {
      setBusy(false);
    }
  }

  const pickupStr = new Date(order.pickup_time).toLocaleString('en-NG', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="card border-l-4 border-yellow-400">
      <div className="flex justify-between items-start mb-3">
        <span className="font-mono text-2xl font-black text-primary tracking-wider">
          {order.pickup_code}
        </span>
        <StatusBadge status={order.status} />
      </div>

      <p className="font-semibold text-gray-800 text-sm">{order.users?.name ?? 'Customer'}</p>
      <p className="text-xs text-gray-500">{order.users?.phone ?? order.users?.email}</p>

      <div className="mt-2 space-y-0.5">
        {items.slice(0, 3).map((item, i) => (
          <p key={i} className="text-xs text-gray-600">
            {item.product_name} × {item.quantity}
          </p>
        ))}
        {items.length > 3 && (
          <p className="text-xs text-gray-400">+{items.length - 3} more items</p>
        )}
      </div>

      <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-dark">
        <span className="text-xs text-gray-500">📅 {pickupStr}</span>
        <span className="font-bold text-primary text-sm">₦{Number(order.total_amount).toLocaleString()}</span>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => updateStatus('confirmed')}
          disabled={busy}
          className="flex-1 text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          Confirm
        </button>
        <button
          onClick={() => updateStatus('ready')}
          disabled={busy}
          className="flex-1 text-xs bg-green-100 text-green-700 hover:bg-green-200 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          Ready ✓
        </button>
        <button
          onClick={() => updateStatus('cancelled')}
          disabled={busy}
          className="text-xs bg-red-50 text-red-500 hover:bg-red-100 px-2 py-1.5 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: PRODUCTS
// ══════════════════════════════════════════════════════════════════════════════
function ProductsTab() {
  const [products, setProducts]     = useState<Product[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [error, setError]           = useState('');

  const load = () => {
    setLoading(true);
    // Get all products including out-of-stock ones for admin view
    fetch('/api/products?sort=name', {
      headers: { Authorization: `Bearer ${localStorage.getItem('olly_auth_token')}` },
    })
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .catch(() => setError('Failed to load products'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await adminApi.deleteProduct(id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('Failed to delete product');
    } finally {
      setDeleting(null);
    }
  }

  function openEdit(product: Product) {
    setEditProduct(product);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditProduct(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Products</h2>
        <button
          onClick={() => { setEditProduct(null); setShowForm(true); }}
          className="btn-primary px-4 py-2 text-sm"
        >
          + Add Product
        </button>
      </div>

      {error && <ErrorMsg msg={error} />}

      {/* Slide-in product form */}
      {showForm && (
        <ProductForm
          product={editProduct}
          onSave={() => { closeForm(); load(); }}
          onCancel={closeForm}
        />
      )}

      {/* Products table */}
      {loading ? (
        <Skeleton rows={6} />
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left w-12"></th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Stock</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Expiry</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-dark">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    No products yet. Click &ldquo;+ Add Product&rdquo; to get started.
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p.id} className="hover:bg-neutral transition-colors group">
                    <td className="px-4 py-3">
                      <div className="w-10 h-10 rounded-lg bg-neutral-dark overflow-hidden flex items-center justify-center shrink-0">
                        {p.image_url
                          ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                          : <span className="text-lg">🛍️</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{p.category}</td>
                    <td className="px-4 py-3 text-right font-medium">₦{p.price.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={p.stock < 10 ? 'text-red-600 font-bold' : 'text-gray-700'}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 hidden lg:table-cell text-xs">
                      {p.expiry_date ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          disabled={deleting === p.id}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 disabled:opacity-50"
                        >
                          {deleting === p.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Product form (add + edit) ──────────────────────────────────────────────────
interface ProductFormProps {
  product: Product | null;
  onSave: () => void;
  onCancel: () => void;
}

function ProductForm({ product, onSave, onCancel }: ProductFormProps) {
  const [form, setForm] = useState({
    name:        product?.name ?? '',
    category:    product?.category ?? CATEGORIES[0],
    price:       product?.price.toString() ?? '',
    stock:       product?.stock.toString() ?? '0',
    expiry_date: product?.expiry_date ?? '',
  });
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(product?.image_url ?? null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const fileRef                       = useRef<HTMLInputElement>(null);

  function handleImageChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const fd = new FormData();
      fd.append('name',     form.name);
      fd.append('category', form.category);
      fd.append('price',    form.price);
      fd.append('stock',    form.stock);
      if (form.expiry_date) fd.append('expiry_date', form.expiry_date);
      if (imageFile)        fd.append('image', imageFile);

      if (product) {
        await adminApi.updateProduct(product.id, fd);
      } else {
        await adminApi.createProduct(fd);
      }
      onSave();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Save failed. Please try again.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card border-2 border-primary/20 bg-primary-50/30">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-gray-800 text-base">
          {product ? `Edit: ${product.name}` : 'Add New Product'}
        </h3>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
      </div>

      {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Image picker */}
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
            <div className="flex items-center gap-4">
              <div
                onClick={() => fileRef.current?.click()}
                className="w-20 h-20 rounded-xl border-2 border-dashed border-neutral-dark hover:border-primary cursor-pointer overflow-hidden flex items-center justify-center bg-white transition-colors"
              >
                {imagePreview
                  ? <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                  : <span className="text-2xl text-gray-300">📷</span>
                }
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-sm text-primary hover:underline font-medium"
                >
                  {imagePreview ? 'Change image' : 'Upload image'}
                </button>
                <p className="text-xs text-gray-400 mt-0.5">PNG, JPG up to 5 MB</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              className="input-field"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Organic Tomatoes"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              className="input-field"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price (₦) <span className="text-red-500">*</span>
            </label>
            <input
              required
              type="number"
              min="0"
              step="0.01"
              className="input-field"
              value={form.price}
              onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          {/* Stock */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock</label>
            <input
              type="number"
              min="0"
              step="1"
              className="input-field"
              value={form.stock}
              onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
            />
          </div>

          {/* Expiry date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiry Date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              className="input-field"
              value={form.expiry_date}
              onChange={(e) => setForm((f) => ({ ...f, expiry_date: e.target.value }))}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary px-8 py-2.5 flex items-center gap-2"
          >
            {saving && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {saving ? 'Saving…' : product ? 'Save Changes' : 'Add Product'}
          </button>
          <button type="button" onClick={onCancel} className="btn-outline px-6 py-2.5">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: ORDERS
// ══════════════════════════════════════════════════════════════════════════════
function OrdersTab() {
  const [orders, setOrders]   = useState<OrderWithCustomer[]>([]);
  const [filter, setFilter]   = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    ordersApi.getAll()
      .then(({ data }) => setOrders(data as OrderWithCustomer[]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: OrderStatus) {
    setUpdating(id);
    try {
      await adminApi.updateOrderStatus(id, status);
      setOrders((prev) => prev.map((o) => o.id === id ? { ...o, status } : o));
    } finally {
      setUpdating(null);
    }
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);
  const counts   = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'].map((s) => ({
    status: s,
    count:  orders.filter((o) => o.status === s).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-gray-800">All Orders</h2>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-3 py-1.5 rounded-xl font-medium ${filter === 'all' ? 'bg-primary text-white' : 'bg-white border border-neutral-dark text-gray-600 hover:border-primary'}`}
          >
            All ({orders.length})
          </button>
          {counts.map(({ status, count }) => count > 0 && (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium capitalize ${filter === status ? 'bg-primary text-white' : 'bg-white border border-neutral-dark text-gray-600 hover:border-primary'}`}
            >
              {status} ({count})
            </button>
          ))}
        </div>
      </div>

      {loading ? <Skeleton rows={5} /> : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left hidden sm:table-cell">Customer</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Items</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-left hidden lg:table-cell">Pickup</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-dark">
              {filtered.map((order) => {
                const items = order.items as Array<{ product_name: string; quantity: number }>;
                return (
                  <tr key={order.id} className="hover:bg-neutral transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-primary">{order.pickup_code}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <p className="font-medium text-gray-800">{order.users?.name ?? '—'}</p>
                      <p className="text-xs text-gray-400">{order.users?.phone}</p>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs max-w-[180px]">
                      {items.slice(0, 2).map((i, idx) => (
                        <span key={idx}>{i.product_name} ×{i.quantity}{idx < Math.min(items.length, 2) - 1 ? ', ' : ''}</span>
                      ))}
                      {items.length > 2 && ` +${items.length - 2}`}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">₦{Number(order.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">
                      {new Date(order.pickup_time).toLocaleString('en-NG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3 text-right">
                      {order.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => updateStatus(order.id, 'confirmed')} disabled={updating === order.id}
                            className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-200 disabled:opacity-50">
                            Confirm
                          </button>
                          <button onClick={() => updateStatus(order.id, 'cancelled')} disabled={updating === order.id}
                            className="text-xs bg-red-50 text-red-500 px-2 py-1 rounded-lg hover:bg-red-100 disabled:opacity-50">
                            Cancel
                          </button>
                        </div>
                      )}
                      {order.status === 'confirmed' && (
                        <button onClick={() => updateStatus(order.id, 'ready')} disabled={updating === order.id}
                          className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-lg hover:bg-green-200 disabled:opacity-50">
                          Mark Ready
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button onClick={() => updateStatus(order.id, 'completed')} disabled={updating === order.id}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-lg hover:bg-gray-200 disabled:opacity-50">
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: INVENTORY
// ══════════════════════════════════════════════════════════════════════════════
function InventoryTab() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [edits, setEdits]       = useState<Record<string, string>>({});
  const [saving, setSaving]     = useState<string | null>(null);
  const [msg, setMsg]           = useState<{ id: string; ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch('/api/products?sort=name', {
      headers: { Authorization: `Bearer ${localStorage.getItem('olly_auth_token')}` },
    })
      .then((r) => r.json())
      .then((d) => setProducts(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  async function saveStock(id: string, name: string) {
    const raw = edits[id];
    if (raw === undefined) return;
    const stock = parseInt(raw, 10);
    if (isNaN(stock) || stock < 0) {
      setMsg({ id, ok: false, text: 'Invalid stock value' });
      return;
    }
    setSaving(id);
    try {
      await adminApi.updateStock(id, stock);
      setProducts((prev) => prev.map((p) => p.id === id ? { ...p, stock } : p));
      setEdits((prev) => { const e = { ...prev }; delete e[id]; return e; });
      setMsg({ id, ok: true, text: '✓ Saved' });
      setTimeout(() => setMsg(null), 2000);
    } catch {
      setMsg({ id, ok: false, text: 'Save failed' });
    } finally {
      setSaving(null);
    }
  }

  const lowStock = products.filter((p) => p.stock < 10);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Inventory Management</h2>
        {lowStock.length > 0 && (
          <span className="text-xs bg-red-100 text-red-600 border border-red-200 px-3 py-1 rounded-full font-medium">
            ⚠️ {lowStock.length} item{lowStock.length !== 1 ? 's' : ''} low on stock
          </span>
        )}
      </div>

      {loading ? <Skeleton rows={6} /> : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-center w-32">Current Stock</th>
                <th className="px-4 py-3 text-center w-40">Update Stock</th>
                <th className="px-4 py-3 text-left w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-dark">
              {products.map((p) => {
                const edited     = edits[p.id] !== undefined;
                const feedback   = msg?.id === p.id ? msg : null;
                const stockLevel = p.stock === 0 ? 'text-red-600 font-bold' : p.stock < 10 ? 'text-orange-500 font-semibold' : 'text-gray-700';

                return (
                  <tr key={p.id} className="hover:bg-neutral transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 max-w-[180px] truncate">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{p.category}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-base font-bold ${stockLevel}`}>{p.stock}</span>
                      {p.stock === 0 && <span className="block text-xs text-red-500">Out of stock</span>}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className={`w-full text-center input-field py-1.5 text-sm ${edited ? 'border-primary ring-1 ring-primary' : ''}`}
                        value={edits[p.id] ?? p.stock}
                        onChange={(e) => setEdits((prev) => ({ ...prev, [p.id]: e.target.value }))}
                        onKeyDown={(e) => e.key === 'Enter' && saveStock(p.id, p.name)}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {feedback ? (
                        <span className={`text-xs font-medium ${feedback.ok ? 'text-green-600' : 'text-red-500'}`}>
                          {feedback.text}
                        </span>
                      ) : edited ? (
                        <button
                          onClick={() => saveStock(p.id, p.name)}
                          disabled={saving === p.id}
                          className="text-xs btn-primary px-3 py-1.5"
                        >
                          {saving === p.id ? '…' : 'Save'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: EXPIRY ALERTS
// ══════════════════════════════════════════════════════════════════════════════
function ExpiryAlertsTab() {
  const [products, setProducts] = useState<ExpiringProduct[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    adminApi.getExpiringProducts()
      .then(({ data }) => setProducts(data as ExpiringProduct[]))
      .finally(() => setLoading(false));
  }, []);

  function urgencyConfig(days: number) {
    if (days < 0)  return { label: 'Expired',     cls: 'bg-red-600 text-white',          row: 'bg-red-50 border-red-200' };
    if (days <= 7) return { label: '≤ 7 days',    cls: 'bg-red-100 text-red-700 border border-red-200',    row: 'bg-red-50/50' };
    if (days <= 30) return { label: '≤ 30 days',  cls: 'bg-orange-100 text-orange-700 border border-orange-200', row: 'bg-orange-50/30' };
    return              { label: '≤ 90 days',     cls: 'bg-yellow-100 text-yellow-700 border border-yellow-200', row: '' };
  }

  const expired  = products.filter((p) => p.days_until_expiry < 0);
  const critical = products.filter((p) => p.days_until_expiry >= 0 && p.days_until_expiry <= 7);
  const warning  = products.filter((p) => p.days_until_expiry > 7 && p.days_until_expiry <= 30);
  const notice   = products.filter((p) => p.days_until_expiry > 30);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Expiry Alerts</h2>
        <span className="text-xs text-gray-500">{products.length} product{products.length !== 1 ? 's' : ''} expiring within 90 days</span>
      </div>

      {/* Summary banner */}
      {(expired.length > 0 || critical.length > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            {expired.length > 0 && (
              <p className="text-red-700 font-semibold text-sm">
                {expired.length} product{expired.length !== 1 ? 's' : ''} already expired — remove from shelves immediately.
              </p>
            )}
            {critical.length > 0 && (
              <p className="text-orange-700 text-sm mt-0.5">
                {critical.length} product{critical.length !== 1 ? 's' : ''} expiring within 7 days.
              </p>
            )}
          </div>
        </div>
      )}

      {loading ? <Skeleton rows={6} /> : products.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">✅</p>
          No products expiring in the next 90 days.
        </div>
      ) : (
        <div className="card p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-neutral text-xs text-gray-500 uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Product</th>
                <th className="px-4 py-3 text-left hidden md:table-cell">Category</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Stock</th>
                <th className="px-4 py-3 text-left">Expiry Date</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-dark">
              {[...expired, ...critical, ...warning, ...notice].map((p) => {
                const { label, cls, row } = urgencyConfig(p.days_until_expiry);
                return (
                  <tr key={p.id} className={`transition-colors ${row}`}>
                    <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500 hidden md:table-cell text-xs">{p.category}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell text-gray-700">{p.stock}</td>
                    <td className="px-4 py-3 font-mono text-sm">{p.expiry_date}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
                        {p.days_until_expiry < 0
                          ? `Expired ${Math.abs(p.days_until_expiry)}d ago`
                          : p.days_until_expiry === 0 ? 'Expires today'
                          : `${p.days_until_expiry}d · ${label}`
                        }
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: MESSAGES
// ══════════════════════════════════════════════════════════════════════════════
function MessagesTab() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const load = () => {
    messagesApi.getAll()
      .then(({ data }) => setMessages(data as Message[]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  async function changeStatus(id: string, status: string) {
    setUpdating(id);
    try {
      await messagesApi.updateStatus(id, status);
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, status: status as Message['status'] } : m));
    } finally {
      setUpdating(null);
    }
  }

  const unread = messages.filter((m) => m.status === 'unread');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-gray-800">Customer Messages</h2>
        {unread.length > 0 && (
          <span className="text-xs bg-red-100 text-red-600 border border-red-200 px-3 py-1 rounded-full font-medium">
            {unread.length} unread
          </span>
        )}
      </div>

      {loading ? <Skeleton rows={4} /> : messages.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">No messages yet.</div>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`card ${m.status === 'unread' ? 'border-l-4 border-red-400' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 leading-relaxed">{m.content}</p>
                  <p className="text-xs text-gray-400 mt-1.5">
                    {new Date(m.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full border border-blue-200">
                    {m.type}
                  </span>
                  <StatusBadge status={m.status} />
                </div>
              </div>

              {m.status !== 'closed' && (
                <div className="flex gap-2 mt-3 pt-3 border-t border-neutral-dark">
                  {m.status === 'unread' && (
                    <button onClick={() => changeStatus(m.id, 'read')} disabled={updating === m.id}
                      className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-xl hover:bg-gray-200 disabled:opacity-50">
                      Mark Read
                    </button>
                  )}
                  {m.status !== 'replied' && (
                    <button onClick={() => changeStatus(m.id, 'replied')} disabled={updating === m.id}
                      className="text-xs text-green-700 bg-green-100 px-3 py-1.5 rounded-xl hover:bg-green-200 disabled:opacity-50">
                      Mark Replied
                    </button>
                  )}
                  <button onClick={() => changeStatus(m.id, 'closed')} disabled={updating === m.id}
                    className="text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-xl hover:bg-gray-100 disabled:opacity-50">
                    Close
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────
function Skeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3">
      {[...Array(rows)].map((_, i) => (
        <div key={i} className="h-12 bg-neutral-dark rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return (
    <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
      {msg}
    </div>
  );
}
