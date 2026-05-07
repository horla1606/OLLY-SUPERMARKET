'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { productsApi, cartApi } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import type { Product, CartItem } from '@/types';

const CATEGORIES = ['All', 'Fresh Produce', 'Dairy & Eggs', 'Bakery', 'Beverages', 'Snacks', 'Household'];
const SORT_OPTIONS = [
  { value: 'name',       label: 'Name A–Z'     },
  { value: 'price_asc',  label: 'Price: Low–High' },
  { value: 'price_desc', label: 'Price: High–Low' },
];

// Category emoji decorations
const CATEGORY_ICON: Record<string, string> = {
  'Fresh Produce': '🥦',
  'Dairy & Eggs':  '🥛',
  'Bakery':        '🍞',
  'Beverages':     '🥤',
  'Snacks':        '🍿',
  'Household':     '🧹',
  'All':           '🛒',
};

export default function ShopPage() {
  const router          = useRouter();
  const { isAuthenticated } = useAuth();

  const [products, setProducts]   = useState<Product[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [guestCart, setGuestCart] = useState<CartItem[]>([]);
  const [category, setCategory]   = useState('All');
  const [sort, setSort]           = useState('name');
  const [search, setSearch]       = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading]     = useState(true);
  const [addingId, setAddingId]   = useState<string | null>(null);
  const [toast, setToast]         = useState('');
  const toastTimer                = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load guest cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('olly_guest_cart');
      if (stored) setGuestCart(JSON.parse(stored) as CartItem[]);
    } catch { /* ignore */ }
  }, []);

  // Debounce search input by 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Load products whenever filters/sort change
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params: { category?: string; q?: string; sort?: string } = { sort };
      if (category !== 'All')  params.category = category;
      if (debouncedSearch)     params.q        = debouncedSearch;
      const { data } = await productsApi.getAll(params);
      setProducts(data as Product[]);
    } finally {
      setLoading(false);
    }
  }, [category, debouncedSearch, sort]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Load server cart on mount so count is accurate
  useEffect(() => {
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

  function addToGuestCart(product: Product) {
    setGuestCart((prev) => {
      const existing = prev.find((i) => i.product_id === product.id);
      const updated = existing
        ? prev.map((i) => i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
        : [...prev, { product_id: product.id, product_name: product.name, price: product.price, quantity: 1 }];
      try { localStorage.setItem('olly_guest_cart', JSON.stringify(updated)); } catch { /* ignore */ }
      return updated;
    });
    showToast(`${product.name} added! Sign up to complete your order.`);
  }

  async function handleAddToCart(product: Product) {
    if (!isAuthenticated) {
      addToGuestCart(product);
      return;
    }
    setAddingId(product.id);
    try {
      const { data } = await cartApi.add(product.id, 1);
      setCartItems((data as { items?: CartItem[] }).items ?? []);
      showToast(`${product.name} added to cart`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message ?? 'Could not add to cart';
      showToast(msg);
    } finally {
      setAddingId(null);
    }
  }

  const cartCount = isAuthenticated
    ? cartItems.reduce((s, i) => s + i.quantity, 0)
    : guestCart.reduce((s, i) => s + i.quantity, 0);

  return (
    <div className="min-h-screen bg-neutral">
      {/* ── Sticky navbar ──────────────────────────────────────────────────── */}
      <nav className="bg-secondary shadow-md sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-16">
          <Link href="/" className="text-2xl font-bold text-white shrink-0">
            OLLY <span className="text-accent">Supermarket</span>
          </Link>

          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link
                  href="/dashboard/customer"
                  className="text-white/80 hover:text-white text-sm hidden sm:block"
                >
                  My Orders
                </Link>
                <Link
                  href="/cart"
                  className="relative text-white text-xl"
                  title="View cart"
                >
                  🛒
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-2 bg-accent text-gray-900 text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-0.5">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>
              </>
            ) : (
              <Link href="/login" className="btn-accent text-sm px-3 py-1.5">
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* ── Search + sort bar ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="search"
              className="input-field pl-9"
              placeholder="Search products…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input-field sm:w-44"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* ── Category pills ────────────────────────────────────────────────── */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-all shrink-0 ${
                category === c
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-neutral-dark hover:border-primary hover:text-primary'
              }`}
            >
              <span>{CATEGORY_ICON[c]}</span>
              {c}
            </button>
          ))}
        </div>

        {/* ── Products grid ─────────────────────────────────────────────────── */}
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="card p-0 overflow-hidden animate-pulse">
                <div className="h-40 bg-neutral-dark" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-neutral-dark rounded w-1/3" />
                  <div className="h-4 bg-neutral-dark rounded w-2/3" />
                  <div className="h-8 bg-neutral-dark rounded w-full mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🔍</p>
            <p className="text-gray-500 text-lg">No products found</p>
            {(search || category !== 'All') && (
              <button
                onClick={() => { setSearch(''); setCategory('All'); }}
                className="mt-4 text-primary hover:underline text-sm"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {products.length} product{products.length !== 1 ? 's' : ''} found
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isAdding={addingId === product.id}
                  inCart={cartItems.find((i) => i.product_id === product.id)?.quantity ?? 0}
                  onAdd={() => handleAddToCart(product)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Toast notification ──────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-secondary text-white px-6 py-3 rounded-xl shadow-xl text-sm z-50 whitespace-nowrap animate-fade-in">
          {toast}
        </div>
      )}
    </div>
  );
}

// ── Product card sub-component ──────────────────────────────────────────────
interface CardProps {
  product: Product;
  isAdding: boolean;
  inCart: number;
  onAdd: () => void;
}

function ProductCard({ product, isAdding, inCart, onAdd }: CardProps) {
  const isOutOfStock = product.stock === 0;

  return (
    <div className="card p-0 overflow-hidden flex flex-col hover:shadow-md transition-shadow group">
      {/* Image — tapping navigates to detail page */}
      <Link href={`/shop/${product.id}`} className="relative h-40 bg-gradient-to-br from-primary-50 to-neutral-dark flex items-center justify-center overflow-hidden block">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-5xl">{CATEGORY_ICON[product.category] ?? '🛍️'}</span>
        )}
        {inCart > 0 && (
          <span className="absolute top-2 right-2 bg-accent text-gray-900 text-xs font-bold px-2 py-0.5 rounded-full">
            {inCart} in cart
          </span>
        )}
      </Link>

      {/* Details */}
      <div className="p-3 flex flex-col flex-1">
        <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-0.5">
          {product.category}
        </p>
        <Link href={`/shop/${product.id}`} className="font-semibold text-gray-800 text-sm leading-tight line-clamp-2 flex-1 hover:text-primary transition-colors">
          {product.name}
        </Link>
        <p className="text-xs text-gray-400 mt-1">
          {isOutOfStock ? (
            <span className="text-red-500">Out of stock</span>
          ) : (
            `${product.stock} left`
          )}
        </p>

        <div className="flex items-center justify-between mt-2 gap-2">
          <span className="text-sm font-bold text-secondary">₦{product.price.toFixed(2)}</span>
          <button
            onClick={onAdd}
            disabled={isOutOfStock || isAdding}
            className={`flex-1 text-xs py-2 rounded-xl font-medium transition-all ${
              isOutOfStock
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : isAdding
                ? 'bg-primary-200 text-primary-600 cursor-wait'
                : 'btn-primary'
            }`}
          >
            {isAdding ? '…' : isOutOfStock ? 'Out of stock' : '+ Add'}
          </button>
        </div>
      </div>
    </div>
  );
}
