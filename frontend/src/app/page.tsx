'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

const features = [
  {
    icon: '🛒',
    title: 'Easy Online Shopping',
    desc: 'Browse hundreds of fresh products and add them to your cart in seconds.',
  },
  {
    icon: '⏱️',
    title: 'Fast In-Store Pickup',
    desc: 'Choose your pickup time and collect your order with a unique pickup code.',
  },
  {
    icon: '💚',
    title: 'Always Fresh',
    desc: 'We source fresh produce daily so every product on the shelf is at its best.',
  },
  {
    icon: '📱',
    title: 'Order Tracking',
    desc: 'Follow your order from confirmed to ready — all in real time.',
  },
];

const categories = ['Fresh Produce', 'Dairy & Eggs', 'Bakery', 'Beverages', 'Snacks', 'Household'];

function getGreeting(name: string): string {
  const hour = new Date().getHours();
  const salutation =
    hour < 12 ? 'Good morning' :
    hour < 17 ? 'Good afternoon' :
    'Good evening';
  return `${salutation}, ${name}!`;
}

export default function HomePage() {
  const { user, isAuthenticated, isManager, logout } = useAuth();

  const dashboardHref = isManager ? '/dashboard/admin' : '/dashboard/customer';

  return (
    <div className="min-h-screen">
      {/* Navbar */}
      <nav className="bg-secondary shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <span className="text-2xl font-bold text-white tracking-tight">
            OLLY <span className="text-accent">Supermarket</span>
          </span>
          <div className="flex items-center gap-4">
            <Link href="/shop" className="text-white/80 hover:text-white text-sm transition-colors">
              Shop
            </Link>
            {isAuthenticated && user ? (
              <>
                <span className="text-white/70 text-sm hidden sm:block">
                  {getGreeting(user.name ?? 'there')}
                </span>
                <Link href={dashboardHref} className="btn-accent text-sm px-3 py-1.5">
                  My Account
                </Link>
                <button
                  onClick={() => logout()}
                  className="text-white/70 hover:text-white text-sm transition-colors"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="btn-outline !border-white !text-white hover:!bg-white hover:!text-secondary text-sm px-3 py-1.5">
                  Login
                </Link>
                <Link href="/signup" className="btn-accent text-sm px-3 py-1.5">
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-gradient-to-br from-secondary to-primary text-white py-24 px-4">
        <div className="max-w-4xl mx-auto text-center">
          {isAuthenticated && user ? (
            <>
              <p className="text-accent font-semibold text-lg mb-2">{getGreeting(user.name ?? 'there')}</p>
              <h1 className="text-5xl font-extrabold mb-6 leading-tight">
                Welcome back to<br />
                <span className="text-accent">OLLY Supermarket</span>
              </h1>
              <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                Fresh groceries are waiting. Shop now and pick up at your convenience.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/shop" className="btn-accent text-base px-8 py-3">
                  Shop Now
                </Link>
                <Link href={dashboardHref} className="btn-outline !border-white !text-white hover:!bg-white hover:!text-secondary text-base px-8 py-3">
                  View My Orders
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-5xl font-extrabold mb-6 leading-tight">
                Fresh Products,<br />
                <span className="text-accent">Fast Pickup.</span>
              </h1>
              <p className="text-xl text-white/80 mb-10 max-w-2xl mx-auto">
                Shop your favourite groceries online and pick them up at OLLY Supermarket — no queues, no fuss.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link href="/shop" className="btn-accent text-base px-8 py-3">
                  Shop Now
                </Link>
                <Link href="/signup" className="btn-outline !border-white !text-white hover:!bg-white hover:!text-secondary text-base px-8 py-3">
                  Create Account
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-gray-800 mb-8 text-center">Browse Categories</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => (
            <Link
              key={cat}
              href={`/shop?category=${encodeURIComponent(cat)}`}
              className="card text-center hover:border-primary hover:shadow-md transition-all cursor-pointer p-4"
            >
              <p className="text-sm font-medium text-gray-700">{cat}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-800 mb-12 text-center">Why Choose OLLY?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((f) => (
              <div key={f.title} className="text-center p-6">
                <div className="text-4xl mb-4">{f.icon}</div>
                <h3 className="font-semibold text-gray-800 mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16 px-4 text-center text-white">
        {isAuthenticated ? (
          <>
            <h2 className="text-3xl font-bold mb-4">Ready to restock?</h2>
            <p className="text-white/80 mb-8">Your next order is just a few clicks away.</p>
            <Link href="/shop" className="btn-accent text-base px-10 py-3">
              Browse Products
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold mb-4">Ready to shop smarter?</h2>
            <p className="text-white/80 mb-8">Join thousands of happy OLLY customers today.</p>
            <Link href="/signup" className="btn-accent text-base px-10 py-3">
              Get Started — It&apos;s Free
            </Link>
          </>
        )}
      </section>

      {/* Footer */}
      <footer className="bg-secondary text-white/60 py-8 text-center text-sm">
        <p>&copy; {new Date().getFullYear()} OLLY Supermarket. All rights reserved.</p>
      </footer>
    </div>
  );
}
