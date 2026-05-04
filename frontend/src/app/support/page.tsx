'use client';

import { useState } from 'react';
import Link from 'next/link';
import { messagesApi } from '@/lib/api';
import ProtectedRoute from '@/components/ProtectedRoute';

const MESSAGE_TYPES = [
  { value: 'inquiry',   label: 'General Inquiry',    icon: '❓', desc: 'Ask a question about our products or service' },
  { value: 'complaint', label: 'Complaint',           icon: '😔', desc: 'Report an issue with your order or experience' },
  { value: 'feedback',  label: 'Feedback',            icon: '💬', desc: 'Share suggestions to help us improve' },
  { value: 'support',   label: 'Order Support',       icon: '📦', desc: 'Get help with a specific order or pickup' },
];

export default function SupportPage() {
  const [type, setType]       = useState('inquiry');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError('Please enter your message');
      return;
    }
    if (content.trim().length < 10) {
      setError('Message must be at least 10 characters');
      return;
    }
    setSending(true);
    setError('');
    try {
      await messagesApi.send({ content: content.trim(), type });
      setSent(true);
    } catch {
      setError('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        {/* Nav */}
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-green-600">OLLY</Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/shop" className="text-gray-600 hover:text-gray-900">Shop</Link>
              <Link href="/dashboard/customer" className="text-gray-600 hover:text-gray-900">Dashboard</Link>
            </nav>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-10">
          {sent ? (
            /* Success state */
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h2>
              <p className="text-gray-600 mb-8">
                Thank you for reaching out. Our team will review your message and reply as soon as possible.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  onClick={() => { setSent(false); setContent(''); setType('inquiry'); }}
                  className="px-6 py-2.5 border border-green-600 text-green-700 rounded-lg text-sm font-medium hover:bg-green-50"
                >
                  Send Another Message
                </button>
                <Link
                  href="/dashboard/customer"
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Support</h1>
                <p className="text-gray-600">
                  Have a question or need help? Send us a message and we&apos;ll get back to you.
                </p>
              </div>

              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <form onSubmit={handleSubmit} noValidate>
                  {/* Type selector */}
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-3">What can we help you with?</label>
                    <div className="grid grid-cols-2 gap-3">
                      {MESSAGE_TYPES.map(t => (
                        <button
                          key={t.value}
                          type="button"
                          onClick={() => setType(t.value)}
                          className={`flex flex-col items-start p-4 rounded-xl border-2 text-left transition-colors ${
                            type === t.value
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-200 hover:border-green-300 bg-white'
                          }`}
                        >
                          <span className="text-2xl mb-1">{t.icon}</span>
                          <span className="font-medium text-sm text-gray-900">{t.label}</span>
                          <span className="text-xs text-gray-500 mt-0.5">{t.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div className="mb-6">
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                      Your Message *
                    </label>
                    <textarea
                      id="message"
                      value={content}
                      onChange={e => { setContent(e.target.value); setError(''); }}
                      rows={6}
                      placeholder={
                        type === 'complaint'
                          ? 'Please describe the issue in detail. Include your order ID if applicable.'
                          : type === 'feedback'
                          ? 'We love hearing from you! Share your thoughts on how we can do better.'
                          : type === 'support'
                          ? 'Please include your order ID and describe what you need help with.'
                          : 'Type your question or message here…'
                      }
                      className={`w-full border rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none transition-colors ${
                        error ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      {error
                        ? <p className="text-xs text-red-600">{error}</p>
                        : <span />
                      }
                      <p className={`text-xs ${content.length < 10 && content.length > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {content.length} characters
                      </p>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-green-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {sending ? 'Sending…' : 'Send Message'}
                  </button>
                </form>
              </div>

              {/* Info cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
                {[
                  { icon: '⚡', title: 'Fast Response', text: 'We aim to reply within 24 hours' },
                  { icon: '📱', title: 'Track Replies', text: 'Check replies in your dashboard' },
                  { icon: '🛡️', title: 'Secure', text: 'Your messages are private and secure' },
                ].map(card => (
                  <div key={card.title} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <p className="font-medium text-sm text-gray-900">{card.title}</p>
                    <p className="text-xs text-gray-500 mt-1">{card.text}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  );
}
