'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productsApi, cartApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Product, CartItem } from '@/types';

const CATEGORY_ICON: Record<string, string> = {
  'Fresh Produce': '🥦',
  'Dairy & Eggs':  '🥛',
  'Bakery':        '🍞',
  'Beverages':     '🥤',
  'Snacks':        '🍿',
  'Household':     '🧹',
};

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const [product, setProduct]     = useState<Product | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [activeImg, setActiveImg] = useState<string | null>(null);
  const [adding, setAdding]       = useState(false);
  const [toast, setToast]         = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestCart, setGuestCart] = useState<CartItem[]>([]);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    productsApi.getById(id)
      .then(({ data }) => {
        const p = data as Product;
        setProduct(p);
        setActiveImg(p.image_url ?? null);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('olly_guest_cart');
      if (stored) setGuestCart(JSON.parse(stored) as CartItem[]);
    } catch { /* ignore */ }
    if (!isAuthenticated) return;
    cartApi.get()
      .then(({ data }) => setCartItems((data as { items?: CartItem[] }).items ?? []))
      .catch(() => {});
  }, [isAuthenticated]);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2500);
  }

  async function handleAdd() {
    if (!product) return;
    if (!isAuthenticated) {
      setGuestCart((prev) => {
        const existing = prev.find((i) => i.product_id === product.id);
        const updated = existing
          ? prev.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
          : [...prev, { product_id: product.id, product_name: product.name, price: product.price, quantity: 1 }];
        try { localStorage.setItem('olly_guest_cart', JSON.stringify(updated)); } catch { /* ignore */ }
        return updated;
      });
      showToast(`${product.name} added! Sign in to complete your order.`);
      return;
    }
    setAdding(true);
    try {
      const { data } = await cartApi.add(product.id, 1);
      setCartItems((data as { items?: CartItem[] }).items ?? []);
      showToast(`${product.name} added to cart`);
    } catch (err: unknown) {
      showToast(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not add to cart'
      );
    } finally {
      setAdding(false);
    }
  }

  const cartCount = isAuthenticated
    ? cartItems.reduce((s, i) => s + i.quantity, 0)
    : guestCart.reduce((s, i) => s + i.quantity, 0);

  const inCart = isAuthenticated
    ? (cartItems.find((i) => i.product_id === id)?.quantity ?? 0)
    : (guestCart.find((i) => i.product_id === id)?.quantity ?? 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-neutral flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-5xl">🔍</p>
        <p className="text-gray-600 text-lg font-medium">Product not found</p>
        <Link href="/shop" className="btn-primary px-6 py-2">Back to Shop</Link>
      </div>
    );
  }

  const isOutOfStock = product.stock === 0;
  const allImages = [product.image_url, ...(product.gallery_images ?? [])].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-neutral">
      {/* Navbar */}
      <nav className="bg-secondary shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14 sm:h-16">
          <Link href="/" className="text-xl sm:text-2xl font-bold text-white shrink-0">
            OLLY <span className="text-accent">Supermarket</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard/customer" className="text-white/80 hover:text-white text-sm hidden sm:block">
                  My Orders
                </Link>
                <Link href="/cart" className="relative text-white text-xl" title="View cart">
                  🛒
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-accent text-gray-900 text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-0.5">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>
              </>
            ) : (
              <Link href="/login" className="btn-accent text-sm px-3 py-1.5">Sign In</Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-4 sm:py-8">
        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-4 sm:mb-6 transition-colors"
        >
          ← Back
        </button>

        <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
          {/* ── Image gallery ─────────────────────────────────── */}
          <div>
            {/* Main image */}
            <div className="aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-primary-50 to-neutral-dark flex items-center justify-center">
              {activeImg ? (
                <img src={activeImg} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-7xl sm:text-8xl">
                  {CATEGORY_ICON[product.category] ?? '🛍️'}
                </span>
              )}
            </div>

            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                {allImages.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(url)}
                    className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      activeImg === url ? 'border-primary' : 'border-transparent opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Product info ───────────────────────────────────── */}
          <div className="flex flex-col">
            <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">
              {product.category}
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 leading-tight">
              {product.name}
            </h1>

            <p className="text-2xl sm:text-3xl font-bold text-secondary mt-2">
              ₦{Number(product.price).toFixed(2)}
            </p>

            <p className={`text-sm mt-1 ${isOutOfStock ? 'text-red-500' : 'text-gray-500'}`}>
              {isOutOfStock ? 'Out of stock' : `${product.stock} available`}
            </p>

            {inCart > 0 && (
              <p className="text-sm text-primary font-medium mt-1">
                {inCart} already in cart
              </p>
            )}

            <button
              onClick={handleAdd}
              disabled={isOutOfStock || adding}
              className={`mt-4 w-full py-3 rounded-xl font-semibold text-base transition-all ${
                isOutOfStock
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : adding
                  ? 'bg-primary/70 text-white cursor-wait'
                  : 'btn-primary'
              }`}
            >
              {adding ? 'Adding…' : isOutOfStock ? 'Out of Stock' : '+ Add to Cart'}
            </button>

            {isAuthenticated && (
              <Link
                href="/cart"
                className="mt-3 text-center text-sm text-primary hover:underline"
              >
                View Cart {cartCount > 0 ? `(${cartCount})` : ''}
              </Link>
            )}

            {product.expiry_date && (
              <p className="mt-4 text-xs text-gray-400">
                Best before: {new Date(product.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}

            {product.description && (
              <div className="mt-5 pt-5 border-t border-neutral-dark">
                <h2 className="font-semibold text-gray-800 mb-2 text-sm">About this product</h2>
                <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-secondary text-white px-6 py-3 rounded-xl shadow-xl text-sm z-50 whitespace-nowrap">
          {toast}
        </div>
      )}
    </div>
  );
}
