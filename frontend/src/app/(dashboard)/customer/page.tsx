'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { ordersApi, cartApi, messagesApi } from '@/lib/api';
import type { Order, Cart, Message } from '@/types';

type Tab = 'orders' | 'cart' | 'messages';

const STATUS_STEPS = ['pending', 'confirmed', 'ready', 'completed'];

export default function CustomerDashboardPage() {
  const router    = useRouter();
  const { user, logout, isAuthenticated } = useAuth();
  const [tab, setTab]         = useState<Tab>('orders');
  const [orders, setOrders]   = useState<Order[]>([]);
  const [cart, setCart]       = useState<Cart | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgContent, setMsgContent] = useState('');
  const [msgType, setMsgType]       = useState('inquiry');
  const [loading, setLoading]       = useState(false);
  const [feedback, setFeedback]     = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }
    loadTab(tab);
  }, [tab, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTab(t: Tab) {
    setLoading(true);
    try {
      if (t === 'orders') {
        const { data } = await ordersApi.getMyOrders();
        setOrders(data as Order[]);
      } else if (t === 'cart') {
        const { data } = await cartApi.get();
        setCart(data as Cart);
      } else if (t === 'messages') {
        const { data } = await messagesApi.getMyMessages();
        setMessages(data as Message[]);
      }
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!msgContent.trim()) return;
    try {
      await messagesApi.send({ content: msgContent, type: msgType });
      setMsgContent('');
      setFeedback('Message sent successfully!');
      loadTab('messages');
      setTimeout(() => setFeedback(''), 3000);
    } catch {
      setFeedback('Failed to send message. Please try again.');
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
          <Link href="/support" className="text-white/80 hover:text-white text-sm hidden sm:block">Support</Link>
          <Link href="/dashboard/profile" className="text-white/80 hover:text-white text-sm">Profile</Link>
          <button onClick={logout} className="text-white/70 hover:text-white text-sm">Sign Out</button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-8">
          {(['orders', 'cart', 'messages'] as Tab[]).map((t) => (
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
        </div>

        {loading && <div className="text-center py-20 text-gray-400">Loading…</div>}

        {/* Orders */}
        {!loading && tab === 'orders' && (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="card text-center py-12 text-gray-400">
                No orders yet.{' '}
                <Link href="/shop" className="text-primary hover:underline">Start shopping</Link>
              </div>
            ) : (
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

        {/* Messages */}
        {!loading && tab === 'messages' && (
          <div className="space-y-6">
            {/* Send message form */}
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-4">Send a Message</h3>
              {feedback && (
                <div className={`mb-3 p-3 rounded-xl text-sm ${
                  feedback.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}>
                  {feedback}
                </div>
              )}
              <select
                className="input-field mb-3"
                value={msgType}
                onChange={(e) => setMsgType(e.target.value)}
              >
                <option value="inquiry">Inquiry</option>
                <option value="complaint">Complaint</option>
                <option value="feedback">Feedback</option>
                <option value="support">Support</option>
              </select>
              <textarea
                className="input-field min-h-[100px] resize-none"
                placeholder="Type your message…"
                value={msgContent}
                onChange={(e) => setMsgContent(e.target.value)}
              />
              <button onClick={sendMessage} className="btn-primary mt-3 px-6 py-2">
                Send Message
              </button>
            </div>

            {/* Message history */}
            {messages.map((m) => (
              <div key={m.id} className="card">
                <div className="flex justify-between items-start">
                  <p className="text-sm text-gray-800">{m.content}</p>
                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full ml-3 shrink-0">
                    {m.status}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-2">{new Date(m.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
