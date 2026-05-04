'use client';

import { useState, useEffect, useCallback } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { adminMessagingApi, adminSocialApi, productsApi } from '@/lib/api';
import {
  MessageWithCustomer,
  SocialPost,
  Notification,
  Product,
  SocialPlatform,
} from '@/types';

// ─── Shared helpers ───────────────────────────────────────────────────────────
function Badge({ status }: { status: string }) {
  const map: Record<string, string> = {
    unread:    'bg-red-100 text-red-700',
    read:      'bg-gray-100 text-gray-600',
    replied:   'bg-green-100 text-green-700',
    closed:    'bg-slate-100 text-slate-500',
    inquiry:   'bg-blue-100 text-blue-700',
    complaint: 'bg-orange-100 text-orange-700',
    feedback:  'bg-purple-100 text-purple-700',
    support:   'bg-yellow-100 text-yellow-700',
    draft:     'bg-gray-100 text-gray-600',
    scheduled: 'bg-blue-100 text-blue-700',
    posted:    'bg-green-100 text-green-700',
    failed:    'bg-red-100 text-red-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  );
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PLATFORM_ICONS: Record<SocialPlatform, string> = {
  facebook:  '🟦',
  instagram: '📷',
  twitter:   '🐦',
};

// ─── Support Tickets Tab ──────────────────────────────────────────────────────
function TicketsTab() {
  const [tickets, setTickets]         = useState<MessageWithCustomer[]>([]);
  const [selected, setSelected]       = useState<MessageWithCustomer | null>(null);
  const [reply, setReply]             = useState('');
  const [generating, setGenerating]   = useState(false);
  const [sending, setSending]         = useState(false);
  const [filterStatus, setFilter]     = useState('all');
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [loading, setLoading]         = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await adminMessagingApi.getMessages();
      setTickets(res.data as MessageWithCustomer[]);
    } catch {
      setError('Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectTicket = async (t: MessageWithCustomer) => {
    setSelected(t);
    setReply(t.reply ?? '');
    setError('');
    setSuccess('');
    if (t.status === 'unread') {
      try {
        await adminMessagingApi.updateMessageStatus(t.id, 'read');
        setTickets(prev => prev.map(x => x.id === t.id ? { ...x, status: 'read' } : x));
      } catch { /* best-effort */ }
    }
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    setError('');
    try {
      const res = await adminMessagingApi.generateMessage(
        `Write a professional reply to this customer ${selected.type} message: "${selected.content}"`
      );
      setReply((res.data as { text: string }).text);
    } catch {
      setError('Failed to generate reply');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    setError('');
    try {
      await adminMessagingApi.replyToMessage(selected.id, reply.trim());
      setSuccess('Reply sent successfully');
      setTickets(prev => prev.map(x =>
        x.id === selected.id ? { ...x, status: 'replied', reply: reply.trim() } : x
      ));
      setSelected(prev => prev ? { ...prev, status: 'replied', reply: reply.trim() } : null);
    } catch {
      setError('Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleClose = async (id: string) => {
    try {
      await adminMessagingApi.updateMessageStatus(id, 'closed');
      setTickets(prev => prev.map(x => x.id === id ? { ...x, status: 'closed' } : x));
      if (selected?.id === id) setSelected(prev => prev ? { ...prev, status: 'closed' } : null);
    } catch {
      setError('Failed to close ticket');
    }
  };

  const filtered = filterStatus === 'all'
    ? tickets
    : tickets.filter(t => t.status === filterStatus);

  return (
    <div className="flex gap-4 h-[calc(100vh-220px)]">
      {/* Ticket list */}
      <div className="w-80 flex-shrink-0 flex flex-col">
        <div className="mb-3">
          <select
            value={filterStatus}
            onChange={e => setFilter(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All tickets</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="replied">Replied</option>
            <option value="closed">Closed</option>
          </select>
        </div>
        <div className="flex-1 overflow-y-auto space-y-2">
          {loading && <p className="text-sm text-gray-500 text-center py-8">Loading…</p>}
          {!loading && filtered.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No tickets found</p>
          )}
          {filtered.map(t => (
            <button
              key={t.id}
              onClick={() => selectTicket(t)}
              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                selected?.id === t.id
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white hover:border-green-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="font-medium text-sm truncate">{t.users?.name ?? 'Customer'}</span>
                <Badge status={t.status} />
              </div>
              <div className="flex items-center gap-2 mb-1">
                <Badge status={t.type} />
                <span className="text-xs text-gray-400">{fmt(t.created_at)}</span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2">{t.content}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Ticket detail + reply */}
      <div className="flex-1 flex flex-col">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">✉️</div>
              <p>Select a ticket to view and reply</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col bg-white rounded-xl border border-gray-200 p-5 overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{selected.users?.name ?? 'Customer'}</h3>
                  <Badge status={selected.status} />
                  <Badge status={selected.type} />
                </div>
                <p className="text-xs text-gray-500">{selected.users?.email} • {fmt(selected.created_at)}</p>
              </div>
              {selected.status !== 'closed' && (
                <button
                  onClick={() => handleClose(selected.id)}
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  Close ticket
                </button>
              )}
            </div>

            {/* Original message */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Customer Message</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.content}</p>
            </div>

            {/* Previous reply */}
            {selected.reply && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-2">
                  Reply sent {selected.replied_at ? fmt(selected.replied_at) : ''}
                </p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">{selected.reply}</p>
              </div>
            )}

            {/* Reply form */}
            {selected.status !== 'closed' && (
              <div className="mt-auto">
                {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                {success && <p className="text-sm text-green-600 mb-2">{success}</p>}
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  rows={5}
                  placeholder="Type your reply…"
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-3"
                />
                <div className="flex gap-3">
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50 disabled:opacity-50"
                  >
                    {generating ? 'Generating…' : '✨ AI Draft'}
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={sending || !reply.trim()}
                    className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {sending ? 'Sending…' : 'Send Reply'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────
function NotificationsTab() {
  const [notifications, setNotifications]   = useState<Notification[]>([]);
  const [products, setProducts]             = useState<Product[]>([]);
  const [title, setTitle]                   = useState('');
  const [content, setContent]               = useState('');
  const [productId, setProductId]           = useState('');
  const [promptText, setPromptText]         = useState('');
  const [generating, setGenerating]         = useState(false);
  const [sending, setSending]               = useState(false);
  const [error, setError]                   = useState('');
  const [success, setSuccess]               = useState('');
  const [loading, setLoading]               = useState(true);

  const load = useCallback(async () => {
    try {
      const [notifRes, prodRes] = await Promise.all([
        adminMessagingApi.getNotifications(),
        productsApi.getAll(),
      ]);
      setNotifications(notifRes.data as Notification[]);
      setProducts(prodRes.data as Product[]);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleGenerate = async () => {
    if (!promptText.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const res = await adminMessagingApi.generateMessage(
        promptText,
        'Write a promotional notification for OLLY Supermarket customers. Keep it under 3 sentences, friendly and action-oriented.'
      );
      setContent((res.data as { text: string }).text);
    } catch {
      setError('Failed to generate message');
    } finally {
      setGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await adminMessagingApi.sendProductNotification({
        title: title.trim(),
        content: content.trim(),
        product_id: productId || undefined,
      });
      const notif = res.data as Notification;
      setSuccess(`Notification sent to ${notif.sent_count} customer(s)`);
      setNotifications(prev => [notif, ...prev]);
      setTitle('');
      setContent('');
      setProductId('');
      setPromptText('');
    } catch {
      setError('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Compose */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Send Notification to All Customers</h3>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {success && <p className="text-sm text-green-600 mb-3">{success}</p>}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Subject / Title *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Weekend Deals Now Live!"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Link to Product (optional)</label>
            <select
              value={productId}
              onChange={e => setProductId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">— No specific product —</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">AI Prompt (optional)</label>
            <div className="flex gap-2">
              <input
                value={promptText}
                onChange={e => setPromptText(e.target.value)}
                placeholder="e.g. Announce a 20% discount on fresh vegetables"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !promptText.trim()}
                className="px-3 py-2 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50 disabled:opacity-50 whitespace-nowrap"
              >
                {generating ? '…' : '✨ Generate'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Message Content *</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={5}
              placeholder="Type or generate your message…"
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>

          <button
            onClick={handleSend}
            disabled={sending || !title.trim() || !content.trim()}
            className="w-full bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {sending ? 'Sending…' : '📧 Send to All Customers'}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Notification History</h3>
        {loading && <p className="text-sm text-gray-500 text-center py-8">Loading…</p>}
        {!loading && notifications.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">No notifications sent yet</p>
        )}
        <div className="space-y-3 overflow-y-auto max-h-96">
          {notifications.map(n => (
            <div key={n.id} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex items-start justify-between mb-1">
                <p className="font-medium text-sm text-gray-900">{n.title}</p>
                <span className="text-xs text-gray-400 whitespace-nowrap ml-2">{fmt(n.sent_at)}</span>
              </div>
              <p className="text-xs text-gray-600 line-clamp-2 mb-1">{n.content}</p>
              <p className="text-xs text-gray-400">
                {n.products ? `Product: ${n.products.name} • ` : ''}
                Sent to {n.sent_count} customer{n.sent_count !== 1 ? 's' : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Social Media Tab ─────────────────────────────────────────────────────────
function SocialTab() {
  const [posts, setPosts]                 = useState<SocialPost[]>([]);
  const [products, setProducts]           = useState<Product[]>([]);
  const [activePlatform, setActivePlat]   = useState<SocialPlatform>('facebook');
  const [content, setContent]             = useState('');
  const [imageUrl, setImageUrl]           = useState('');
  const [scheduledDate, setScheduled]     = useState('');
  const [productId, setProductId]         = useState('');
  const [promptText, setPromptText]       = useState('');
  const [generating, setGenerating]       = useState(false);
  const [saving, setSaving]               = useState(false);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');
  const [loading, setLoading]             = useState(true);

  const platforms: SocialPlatform[] = ['facebook', 'instagram', 'twitter'];

  const load = useCallback(async () => {
    try {
      const [postsRes, prodRes] = await Promise.all([
        adminSocialApi.getAll(),
        productsApi.getAll(),
      ]);
      setPosts(postsRes.data as SocialPost[]);
      setProducts(prodRes.data as Product[]);
    } catch {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredPosts = posts.filter(p => p.platform === activePlatform);

  const handleGenerate = async () => {
    if (!promptText.trim()) return;
    setGenerating(true);
    setError('');
    try {
      const res = await adminMessagingApi.generateMessage(
        promptText,
        `Write a short, engaging ${activePlatform} post for OLLY Supermarket. Max 2-3 sentences. Include relevant hashtags.`
      );
      setContent((res.data as { text: string }).text);
    } catch {
      setError('Failed to generate post');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!content.trim()) {
      setError('Post content is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await adminSocialApi.create({
        platform:       activePlatform,
        content:        content.trim(),
        image_url:      imageUrl.trim() || undefined,
        scheduled_date: scheduledDate || undefined,
        product_id:     productId || undefined,
      });
      setPosts(prev => [res.data as SocialPost, ...prev]);
      setSuccess('Post saved!');
      setContent('');
      setImageUrl('');
      setScheduled('');
      setProductId('');
      setPromptText('');
    } catch {
      setError('Failed to save post');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post?')) return;
    try {
      await adminSocialApi.delete(id);
      setPosts(prev => prev.filter(p => p.id !== id));
    } catch {
      setError('Failed to delete post');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      const res = await adminSocialApi.update(id, { status });
      setPosts(prev => prev.map(p => p.id === id ? { ...p, ...res.data } : p));
    } catch {
      setError('Failed to update post status');
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform tabs */}
      <div className="flex gap-2">
        {platforms.map(p => (
          <button
            key={p}
            onClick={() => setActivePlat(p)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activePlatform === p
                ? 'bg-green-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:border-green-400'
            }`}
          >
            {PLATFORM_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Compose */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            {PLATFORM_ICONS[activePlatform]} New {activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)} Post
          </h3>

          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {success && <p className="text-sm text-green-600 mb-3">{success}</p>}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">AI Prompt (optional)</label>
              <div className="flex gap-2">
                <input
                  value={promptText}
                  onChange={e => setPromptText(e.target.value)}
                  placeholder={`e.g. Promote our fresh avocados on ${activePlatform}`}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  onClick={handleGenerate}
                  disabled={generating || !promptText.trim()}
                  className="px-3 py-2 border border-green-600 text-green-700 rounded-lg text-sm hover:bg-green-50 disabled:opacity-50 whitespace-nowrap"
                >
                  {generating ? '…' : '✨ Generate'}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Post Content *</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={5}
                placeholder="Type or generate your post…"
                className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
              {activePlatform === 'twitter' && (
                <p className={`text-xs mt-1 ${content.length > 280 ? 'text-red-600' : 'text-gray-400'}`}>
                  {content.length}/280 characters
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Image URL (optional)</label>
              <input
                value={imageUrl}
                onChange={e => setImageUrl(e.target.value)}
                placeholder="https://…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Schedule Date (optional)</label>
                <input
                  type="datetime-local"
                  value={scheduledDate}
                  onChange={e => setScheduled(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Linked Product (optional)</label>
                <select
                  value={productId}
                  onChange={e => setProductId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">— None —</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={saving || !content.trim()}
              className="w-full bg-green-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : scheduledDate ? '🗓️ Schedule Post' : '💾 Save as Draft'}
            </button>
          </div>
        </div>

        {/* Posts list */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4">
            {PLATFORM_ICONS[activePlatform]} {activePlatform.charAt(0).toUpperCase() + activePlatform.slice(1)} Posts
          </h3>
          {loading && <p className="text-sm text-gray-500 text-center py-8">Loading…</p>}
          {!loading && filteredPosts.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-8">No posts yet for this platform</p>
          )}
          <div className="space-y-3 overflow-y-auto max-h-[480px]">
            {filteredPosts.map(p => (
              <div key={p.id} className="p-3 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge status={p.status} />
                  <div className="flex items-center gap-2">
                    <select
                      value={p.status}
                      onChange={e => handleStatusChange(p.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none"
                    >
                      <option value="draft">draft</option>
                      <option value="scheduled">scheduled</option>
                      <option value="posted">posted</option>
                      <option value="failed">failed</option>
                    </select>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-800 whitespace-pre-wrap mb-2">{p.content}</p>
                {p.products && (
                  <p className="text-xs text-gray-400">Product: {p.products.name}</p>
                )}
                {p.scheduled_date && (
                  <p className="text-xs text-gray-400">
                    Scheduled: {new Date(p.scheduled_date).toLocaleString('en-GB')}
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">Created {fmt(p.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const TABS = ['tickets', 'notifications', 'social'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  tickets:       '🎫 Support Tickets',
  notifications: '📧 Notifications',
  social:        '📱 Social Media',
};

export default function CommunicationsPage() {
  const [tab, setTab] = useState<Tab>('tickets');

  return (
    <ProtectedRoute requiredRole="manager">
      <div>
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Communications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Support tickets, customer notifications, and social media</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-green-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === 'tickets'       && <TicketsTab />}
        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'social'        && <SocialTab />}
      </div>
    </ProtectedRoute>
  );
}
