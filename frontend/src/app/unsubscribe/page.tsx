'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Suspense } from 'react';

function UnsubscribeContent() {
  const params = useSearchParams();
  const status = params.get('status');
  const email  = params.get('email') ?? '';

  const views = {
    success: {
      icon: '✅',
      title: 'You have been unsubscribed',
      body: email
        ? `${email} will no longer receive promotional notifications from OLLY Supermarket.`
        : 'You will no longer receive promotional notifications from OLLY Supermarket.',
      note: 'You will still receive emails about your own orders (ready for pickup, order complete).',
    },
    invalid: {
      icon: '⚠️',
      title: 'Invalid unsubscribe link',
      body: 'This link is not valid or has already been used.',
      note: 'If you still want to unsubscribe, please contact us on WhatsApp.',
    },
    error: {
      icon: '❌',
      title: 'Something went wrong',
      body: 'We could not process your request right now.',
      note: 'Please try again later or contact us on WhatsApp.',
    },
  };

  const view = views[(status as keyof typeof views) ?? 'invalid'] ?? views.invalid;

  return (
    <div className="min-h-screen bg-neutral flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
        <p className="text-5xl mb-4">{view.icon}</p>
        <h1 className="text-xl font-bold text-gray-800 mb-2">{view.title}</h1>
        <p className="text-gray-600 text-sm mb-3">{view.body}</p>
        {view.note && (
          <p className="text-xs text-gray-400 mb-6">{view.note}</p>
        )}
        <Link
          href="/shop"
          className="inline-block bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90"
        >
          Back to Shop
        </Link>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense>
      <UnsubscribeContent />
    </Suspense>
  );
}
