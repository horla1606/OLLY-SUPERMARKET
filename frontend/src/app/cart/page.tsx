'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cartApi } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';
import type { Cart, CartItem } from '@/types';

export default function CartPage() {
  return (
    <ProtectedRoute>
      <CartContent />
    </ProtectedRoute>
  );
}

function CartContent() {
  const router              = useRouter();
  const [cart, setCart]     = useState<Cart | null>(null);
  const [loading, setLoading]   = useState(true);
  const [busyId, setBusyId]     = useState<string | null>(null);
  const [error, setError]       = useState('');

  useEffect(() => { loadCart(); }, []);

  async function loadCart() {
    try {
      const { data } = await cartApi.get();
      setCart(data as Cart);
    } finally {
      setLoading(false);
    }
  }

  const items = ((cart?.items ?? []) as CartItem[]);

  async function updateQty(product_id: string, newQty: number) {
    setBusyId(product_id);
    setError('');
    try {
      if (newQty < 1) {
        // Remove item when quantity drops to 0
        const { data } = await cartApi.remove(product_id);
        setCart(data as Cart);
      } else {
        // Replace cart with updated quantity
        const updated = items.map((i) =>
          i.product_id === product_id ? { ...i, quantity: newQty } : i
        );
        const { data } = await cartApi.upsert(
          updated.map((i) => ({ product_id: i.product_id, quantity: i.quantity }))
        );
        setCart(data as Cart);
      }
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not update cart'
      );
    } finally {
      setBusyId(null);
    }
  }

  async function removeItem(product_id: string) {
    setBusyId(product_id);
    setError('');
    try {
      const { data } = await cartApi.remove(product_id);
      setCart(data as Cart);
    } catch {
      setError('Could not remove item');
    } finally {
      setBusyId(null);
    }
  }

  async function clearCart() {
    if (!confirm('Remove all items from your cart?')) return;
    try {
      await cartApi.clear();
      setCart(null);
    } catch {
      setError('Could not clear cart');
    }
  }

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-neutral">
      {/* Navbar */}
      <nav className="bg-secondary shadow-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="text-2xl font-bold text-white">
            OLLY <span className="text-accent">Supermarket</span>
          </Link>
          <Link href="/shop" className="text-white/80 hover:text-white text-sm">
            ← Continue Shopping
          </Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Shopping Cart
          {itemCount > 0 && (
            <span className="text-base font-normal text-gray-400 ml-2">({itemCount} item{itemCount !== 1 ? 's' : ''})</span>
          )}
        </h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card animate-pulse flex gap-4">
                <div className="w-20 h-20 bg-neutral-dark rounded-xl shrink-0" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-neutral-dark rounded w-1/2" />
                  <div className="h-3 bg-neutral-dark rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          /* ── Empty state ── */
          <div className="card text-center py-20">
            <p className="text-6xl mb-4">🛒</p>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Your cart is empty</h2>
            <p className="text-gray-400 mb-6">Add items from the shop to get started.</p>
            <Link href="/shop" className="btn-primary px-8 py-3">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-8">
            {/* ── Cart items ── */}
            <div className="lg:col-span-2 space-y-3">
              {items.map((item) => (
                <div
                  key={item.product_id}
                  className={`card flex gap-4 transition-opacity ${busyId === item.product_id ? 'opacity-60' : ''}`}
                >
                  {/* Product image */}
                  <div className="w-20 h-20 bg-gradient-to-br from-primary-50 to-neutral-dark rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.product_name} className="w-full h-full object-cover rounded-xl" />
                    ) : (
                      <span className="text-3xl">🛍️</span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 text-sm leading-tight truncate">
                      {item.product_name}
                    </h3>
                    <p className="text-primary font-bold mt-0.5">₦{item.price.toFixed(2)}</p>

                    <div className="flex items-center justify-between mt-3">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-0 border border-neutral-dark rounded-xl overflow-hidden">
                        <button
                          onClick={() => updateQty(item.product_id, item.quantity - 1)}
                          disabled={busyId === item.product_id}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-neutral-dark transition-colors font-bold text-lg disabled:opacity-50"
                        >
                          −
                        </button>
                        <span className="w-10 text-center text-sm font-semibold text-gray-800">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQty(item.product_id, item.quantity + 1)}
                          disabled={busyId === item.product_id}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-neutral-dark transition-colors font-bold text-lg disabled:opacity-50"
                        >
                          +
                        </button>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-secondary">
                          ₦{(item.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeItem(item.product_id)}
                          disabled={busyId === item.product_id}
                          className="text-red-400 hover:text-red-600 text-sm disabled:opacity-50 transition-colors"
                          title="Remove item"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button
                onClick={clearCart}
                className="text-sm text-red-400 hover:text-red-600 transition-colors mt-2"
              >
                Clear cart
              </button>
            </div>

            {/* ── Order summary ── */}
            <div className="lg:col-span-1">
              <div className="card sticky top-24">
                <h2 className="font-bold text-gray-800 mb-4">Order Summary</h2>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  {items.map((item) => (
                    <div key={item.product_id} className="flex justify-between">
                      <span className="truncate pr-2">{item.product_name} × {item.quantity}</span>
                      <span className="shrink-0">₦{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-neutral-dark pt-4 mb-6">
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-primary">₦{subtotal.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Pickup in-store · No delivery fee</p>
                </div>

                <button
                  onClick={() => router.push('/checkout')}
                  className="btn-primary w-full py-3 text-base"
                >
                  Proceed to Checkout →
                </button>

                <Link href="/shop" className="block text-center text-sm text-primary mt-3 hover:underline">
                  ← Continue Shopping
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
