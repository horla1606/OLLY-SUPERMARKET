'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ordersApi, cartApi } from '@/lib/api';
import type { Order, Cart } from '@/types';

type Tab = 'orders' | 'cart';

const STATUS_STEPS = ['pending', 'confirmed', 'ready', 'completed'];

export default function CustomerDashboardPage() {
  const router    = useRouter();
  const { user, logout, isAuthenticated, loading: authLoading } = useAuth();
  const [tab, setTab]         = useState<Tab>('orders');
  const [orders, setOrders]   = useState<Order[]>([]);
  const [cart, setCart]       = useState<Cart | null>(null);
  const [loading, setLoading]       = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [feedback, setFeedback]     = useState('');
  const [ordersError, setOrdersError] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    loadTab(tab);
  }, [tab, isAuthenticated, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTab(t: Tab, force = false) {
    setOrdersError('');

    if (t === 'orders') {
      // Always show cache immediately (force mode skips this to show the spinner)
      if (!force) {
        try {
          const cached = JSON.parse(localStorage.getItem('olly_recent_orders') ?? '[]') as Order[];
          if (cached.length > 0) setOrders(cached);
        } catch { /* ignore */ }
      }

      setRefreshing(true);
      try {
        const { data } = await ordersApi.getMyOrders();
        const apiOrders = Array.isArray(data) ? (data as Order[]) : [];

        // Always merge API + cache — locally placed orders may not yet have
        // the current customer_id linked in the database
        try {
          const cached = JSON.parse(localStorage.getItem('olly_recent_orders') ?? '[]') as Order[];
          const apiIds = new Set(apiOrders.map((o) => o.id));

          if (apiOrders.length > 0) {
            const merged = [...apiOrders, ...cached.filter((o) => !apiIds.has(o.id))];
            setOrders(merged);
            try { localStorage.setItem('olly_recent_orders', JSON.stringify(merged)); } catch { /* ignore */ }
          } else if (force) {
            // Force refresh but API returned nothing — keep cache with warning
            if (cached.length > 0) {
              setOrders(cached);
              setOrdersError('Could not fetch latest orders. Showing cached orders — try again shortly.');
            } else {
              setOrders([]);
            }
          }
          // non-force with empty API: cache was already shown above
        } catch {
          if (apiOrders.length > 0) setOrders(apiOrders);
        }
      } catch {
        // API failed — keep showing cached orders, only show error if nothing to display
        try {
          const cached = JSON.parse(localStorage.getItem('olly_recent_orders') ?? '[]') as Order[];
          setOrders(cached);
          if (cached.length === 0) setOrdersError('Could not load orders. Tap Refresh to try again.');
        } catch {
          setOrdersError('Could not load orders. Tap Refresh to try again.');
        }
      } finally {
        setRefreshing(false);
      }
      return;
    }

    // Cart tab
    setLoading(true);
    try {
      if (t === 'cart') {
        const { data } = await cartApi.get();
        setCart(data as Cart);
      }
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Failed to load. Please try again.';
      setFeedback(msg);
    } finally {
      setLoading(false);
    }
  }

  async function cancelOrder(orderId: string) {
    setCancellingId(orderId);
    try {
      const { data } = await ordersApi.cancel(orderId);
      const updated = data as Order;
      setOrders((prev) => {
        const next = prev.map((o) => o.id === orderId ? { ...o, status: updated.status } : o);
        try { localStorage.setItem('olly_recent_orders', JSON.stringify(next)); } catch { /* ignore */ }
        return next;
      });
    } catch {
      setFeedback('Could not cancel order. Please try again.');
      setTimeout(() => setFeedback(''), 3000);
    } finally {
      setCancellingId(null);
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
    <div className="min-h-screen bg-neutral">
      {/* Header */}
      <header className="bg-secondary text-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">My Account</h1>
          <p className="text-white/60 text-sm">Welcome back, {user?.name ?? 'Customer'}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/shop" className="text-white/80 hover:text-white text-sm">Shop</Link>
          <a href="https://wa.me/2349012037678" target="_blank" rel="noopener noreferrer" className="text-white/80 hover:text-white text-sm hidden sm:block">Support</a>
          <Link href="/dashboard/profile" className="text-white/80 hover:text-white text-sm">Profile</Link>
          <button onClick={logout} className="text-white/70 hover:text-white text-sm">Sign Out</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {(['orders', 'cart'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                tab === t ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-neutral-dark'
              }`}
            >
              {t}
            </button>
          ))}
          <a
            href="https://wa.me/2349012037678"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-green-500 text-white hover:bg-green-600 transition-colors"
          >
            WhatsApp Support
          </a>
        </div>

        {loading && <div className="text-center py-20 text-gray-400">Loading…</div>}

        {/* Orders */}
        {tab === 'orders' && (
          <div className="space-y-4">
            <div className="flex items-center justify-end gap-3">
              {refreshing && <span className="text-xs text-gray-400">Refreshing…</span>}
              <button
                onClick={() => loadTab('orders', true)}
                className="text-xs text-primary hover:underline"
              >
                ↻ Refresh
              </button>
            </div>
            {ordersError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {ordersError}
              </div>
            )}
            {!ordersError && orders.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                No orders yet.{' '}
                <Link href="/shop" className="text-primary hover:underline">Start shopping</Link>
              </div>
            ) : !ordersError && (
              orders.map((order) => (
                <div key={order.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <p className="text-xs text-gray-400">Pickup Code</p>
                      <p className="font-mono text-xl font-bold text-primary">{order.pickup_code}</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor[order.status]}`}>
                      {order.status}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {order.status !== 'cancelled' && (
                    <div className="flex items-center gap-1 mb-4">
                      {STATUS_STEPS.map((step, i) => (
                        <div key={step} className="flex items-center flex-1">
                          <div className={`h-2 flex-1 rounded-full ${
                            STATUS_STEPS.indexOf(order.status) >= i ? 'bg-primary' : 'bg-neutral-dark'
                          }`} />
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1 text-sm">
                    {(order.items as Array<{ product_name: string; quantity: number; price: number }>)
                      .map((item, i) => (
                        <div key={i} className="flex justify-between text-gray-600">
                          <span>{item.product_name} × {item.quantity}</span>
                          <span>₦{(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                  </div>
                  <div className="flex justify-between items-center mt-3 pt-3 border-t border-neutral-dark">
                    <span className="text-sm text-gray-500">
                      Pickup: {new Date(order.pickup_time).toLocaleString()}
                    </span>
                    <span className="font-bold text-secondary">₦{Number(order.total_amount).toFixed(2)}</span>
                  </div>
                  {!['ready', 'completed', 'cancelled'].includes(order.status) && (
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => cancelOrder(order.id)}
                        disabled={cancellingId === order.id}
                        className="text-xs px-3 py-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        {cancellingId === order.id ? 'Cancelling…' : 'Cancel Order'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* Cart */}
        {!loading && tab === 'cart' && (
          <div className="card">
            {!cart || (cart.items as unknown[]).length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                Your cart is empty.{' '}
                <Link href="/shop" className="text-primary hover:underline">Shop now</Link>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {(cart.items as Array<{ product_name: string; quantity: number; price: number }>)
                    .map((item, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b border-neutral-dark">
                        <span className="text-gray-800">{item.product_name} × {item.quantity}</span>
                        <span className="font-semibold">₦{(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                </div>
                <div className="flex justify-between mt-4 pt-4 font-bold text-lg">
                  <span>Total</span>
                  <span className="text-primary">
                    ₦{(cart.items as Array<{ price: number; quantity: number }>)
                      .reduce((s, i) => s + i.price * i.quantity, 0)
                      .toFixed(2)}
                  </span>
                </div>
                <Link href="/checkout" className="btn-primary w-full text-center mt-4 block py-3">
                  Proceed to Checkout
                </Link>
              </>
            )}
          </div>
        )}

        {feedback && (
          <div className="p-3 mb-4 rounded-xl text-sm bg-red-50 text-red-700">{feedback}</div>
        )}
      </div>
    </div>
  );
}
