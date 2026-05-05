'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cartApi, ordersApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { Cart, CartItem, Order } from '@/types';

export default function CheckoutPage() {
  return (
    <ProtectedRoute>
      <CheckoutContent />
    </ProtectedRoute>
  );
}

// Minimum pickup time is 1 hour from now
function defaultPickupTime(): string {
  const t = new Date(Date.now() + 60 * 60 * 1000);
  t.setMinutes(0, 0, 0);
  return t.toISOString().slice(0, 16);
}

function minPickupTime(): string {
  return new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16);
}

function CheckoutContent() {
  const router        = useRouter();
  const { user }      = useAuth();

  const [cart, setCart]         = useState<Cart | null>(null);
  const [pickupTime, setPickupTime] = useState(defaultPickupTime());
  const [loading, setLoading]   = useState(true);
  const [placing, setPlacing]   = useState(false);
  const [error, setError]       = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  useEffect(() => {
    cartApi.get()
      .then(({ data }) => {
        const c = data as Cart;
        if (!c?.items?.length) {
          router.replace('/cart');
          return;
        }
        setCart(c);
      })
      .catch(() => router.replace('/cart'))
      .finally(() => setLoading(false));
  }, [router]);

  const items    = ((cart?.items ?? []) as CartItem[]);
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  async function placeOrder() {
    if (!cart || !pickupTime) return;
    setError('');
    setPlacing(true);

    try {
      const { data } = await ordersApi.create({
        items:       items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        pickup_time: new Date(pickupTime).toISOString(),
      });

      // Clear cart after successful order
      await cartApi.clear().catch(() => {});
      const placed = data as Order;

      // Cache order in localStorage so dashboard shows it immediately
      try {
        const prev = JSON.parse(localStorage.getItem('olly_recent_orders') ?? '[]') as Order[];
        const merged = [placed, ...prev.filter((o) => o.id !== placed.id)].slice(0, 20);
        localStorage.setItem('olly_recent_orders', JSON.stringify(merged));
      } catch { /* ignore */ }

      setConfirmedOrder(placed);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Failed to place order. Please try again.'
      );
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral">
      {/* Navbar */}
      <nav className="bg-secondary shadow-md">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="text-2xl font-bold text-white">
            OLLY <span className="text-accent">Supermarket</span>
          </Link>
          <Link href="/cart" className="text-white/80 hover:text-white text-sm">
            ← Back to Cart
          </Link>
        </div>
      </nav>

      {/* Progress breadcrumb */}
      <div className="bg-white border-b border-neutral-dark">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-2 text-sm">
          <Link href="/shop" className="text-gray-400 hover:text-primary">Shop</Link>
          <span className="text-gray-300">›</span>
          <Link href="/cart" className="text-gray-400 hover:text-primary">Cart</Link>
          <span className="text-gray-300">›</span>
          <span className="text-primary font-medium">Checkout</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-8">Checkout</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        <div className="grid lg:grid-cols-5 gap-8">
          {/* ── Left: Pickup details ─────────────────────────────────────── */}
          <div className="lg:col-span-3 space-y-6">
            {/* Customer info */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary text-white rounded-full text-xs flex items-center justify-center font-bold">1</span>
                Your Details
              </h2>
              <div className="bg-neutral rounded-xl p-4 text-sm space-y-1">
                <p className="font-semibold text-gray-800">{user?.name}</p>
                <p className="text-gray-500">{user?.email}</p>
                {user?.phone && <p className="text-gray-500">{user.phone}</p>}
              </div>
            </div>

            {/* Pickup time picker */}
            <div className="card">
              <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary text-white rounded-full text-xs flex items-center justify-center font-bold">2</span>
                Choose Pickup Time
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                Select when you&apos;ll come to OLLY Supermarket to pick up your order.
              </p>
              <input
                type="datetime-local"
                className="input-field"
                value={pickupTime}
                min={minPickupTime()}
                onChange={(e) => setPickupTime(e.target.value)}
              />
              {pickupTime && (
                <p className="text-sm text-primary mt-2 font-medium">
                  📅 {new Date(pickupTime).toLocaleString('en-NG', {
                    weekday: 'long', day: 'numeric', month: 'long',
                    hour: '2-digit', minute: '2-digit',
                  })}
                </p>
              )}
            </div>
          </div>

          {/* ── Right: Order summary ──────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="card sticky top-6">
              <h2 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
                <span className="w-6 h-6 bg-primary text-white rounded-full text-xs flex items-center justify-center font-bold">3</span>
                Order Summary
              </h2>
              <p className="text-xs text-gray-400 mb-4">{itemCount} item{itemCount !== 1 ? 's' : ''}</p>

              <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.product_id} className="flex justify-between text-sm">
                    <span className="text-gray-700 truncate pr-2">
                      {item.product_name}
                      <span className="text-gray-400 ml-1">×{item.quantity}</span>
                    </span>
                    <span className="text-gray-800 font-medium shrink-0">
                      ₦{(item.price * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-neutral-dark pt-3 mb-6 space-y-1">
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Subtotal</span>
                  <span>₦{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Delivery</span>
                  <span className="text-green-600">Free (pickup)</span>
                </div>
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>Total</span>
                  <span className="text-primary">₦{subtotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={placeOrder}
                disabled={placing || !pickupTime}
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
              >
                {placing ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Placing order…
                  </>
                ) : (
                  'Place Order 🛒'
                )}
              </button>

              <p className="text-xs text-gray-400 text-center mt-3">
                You can cancel before the order is confirmed.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Thank you modal ─────────────────────────────────────────────────── */}
      {confirmedOrder && <PickupModal order={confirmedOrder} />}
    </div>
  );
}

// ── Pickup code modal ──────────────────────────────────────────────────────
function PickupModal({ order }: { order: Order }) {
  const router = useRouter();

  const pickupDate = new Date(order.pickup_time).toLocaleString('en-NG', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full overflow-hidden animate-in">
        {/* Green header */}
        <div className="bg-primary px-6 pt-8 pb-6 text-center text-white">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-extrabold">Order Placed!</h2>
          <p className="text-white/80 text-sm mt-1">Your items are being prepared</p>
        </div>

        {/* Pickup code */}
        <div className="px-6 py-6 text-center">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
            Your Pickup Code
          </p>
          <div className="bg-primary-50 border-2 border-dashed border-primary rounded-2xl py-4 px-6 mb-1">
            <span className="font-mono text-5xl font-black tracking-[0.2em] text-primary">
              {order.pickup_code}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-2">Show this code to staff when you arrive</p>
        </div>

        {/* Order details */}
        <div className="px-6 pb-2 space-y-2 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Pickup time</span>
            <span className="font-semibold text-gray-800">{pickupDate}</span>
          </div>
          <div className="flex justify-between">
            <span>Total paid</span>
            <span className="font-bold text-primary">₦{Number(order.total_amount).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className="text-yellow-600 font-medium capitalize">{order.status}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 flex flex-col gap-3">
          <button
            onClick={() => router.push('/dashboard/customer')}
            className="btn-primary w-full py-3"
          >
            View My Orders
          </button>
          <Link
            href="/shop"
            className="text-center text-sm text-primary hover:underline"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  );
}
