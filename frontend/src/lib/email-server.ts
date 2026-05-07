import nodemailer from 'nodemailer';
import crypto from 'crypto';

const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM, FRONTEND_URL, JWT_SECRET } =
  process.env;

const enabled = !!(EMAIL_USER && EMAIL_PASS);

const transporter = enabled
  ? nodemailer.createTransport({
      host: EMAIL_HOST || 'smtp.gmail.com',
      port: Number(EMAIL_PORT) || 587,
      secure: Number(EMAIL_PORT) === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    })
  : null;

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  bcc?: string | string[];
}): Promise<void> {
  if (!transporter) return;
  await transporter.sendMail({
    from: EMAIL_FROM || EMAIL_USER,
    to: Array.isArray(opts.to) ? opts.to.join(',') : opts.to,
    bcc: opts.bcc
      ? Array.isArray(opts.bcc) ? opts.bcc.join(',') : opts.bcc
      : undefined,
    subject: opts.subject,
    html: opts.html,
  });
}

// ── Unsubscribe helpers ───────────────────────────────────────────────────────
export function generateUnsubscribeSig(email: string): string {
  return crypto
    .createHmac('sha256', JWT_SECRET || 'olly-unsub-secret')
    .update(email.toLowerCase())
    .digest('hex');
}

export function getUnsubscribeLink(email: string): string {
  const base = FRONTEND_URL || 'http://localhost:3000';
  const sig  = generateUnsubscribeSig(email);
  return `${base}/api/unsubscribe?email=${encodeURIComponent(email)}&sig=${sig}`;
}

const unsubscribeFooter = (email: string) => `
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px">
  <p style="color:#9ca3af;font-size:11px;text-align:center">
    You received this email because you registered with OLLY Supermarket.<br>
    <a href="${getUnsubscribeLink(email)}" style="color:#9ca3af;text-decoration:underline">
      Unsubscribe from notifications
    </a>
  </p>
`;

// ── Templates ─────────────────────────────────────────────────────────────────
export function replyEmailHtml(opts: {
  customerName: string;
  originalMessage: string;
  reply: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#16a34a">OLLY Supermarket — Support Reply</h2>
      <p>Hi ${opts.customerName},</p>
      <p>${opts.reply.replace(/\n/g, '<br>')}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="color:#6b7280;font-size:13px">Your original message:</p>
      <blockquote style="color:#6b7280;font-size:13px;border-left:3px solid #d1fae5;padding-left:12px;margin:0">
        ${opts.originalMessage.replace(/\n/g, '<br>')}
      </blockquote>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">OLLY Supermarket &bull; Fresh &amp; Fast Pickup</p>
    </div>
  `;
}

export function newOrderEmailHtml(opts: {
  pickupCode: string;
  customerName: string;
  customerEmail: string;
  items: Array<{ product_name: string; quantity: number; price: number }>;
  totalAmount: number;
  pickupTime: string;
}): string {
  const rows = opts.items
    .map(
      (i) =>
        `<tr><td style="padding:6px 8px">${i.product_name}</td>` +
        `<td style="padding:6px 8px;text-align:center">×${i.quantity}</td>` +
        `<td style="padding:6px 8px;text-align:right">₦${(i.price * i.quantity).toFixed(2)}</td></tr>`
    )
    .join('');
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#16a34a">OLLY Supermarket — New Order</h2>
      <p>A new order has been placed and is awaiting confirmation.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
        <tr style="background:#f3f4f6">
          <td style="padding:8px;font-weight:bold;width:140px">Pickup Code</td>
          <td style="padding:8px;font-size:22px;font-weight:900;color:#16a34a;font-family:monospace">${opts.pickupCode}</td>
        </tr>
        <tr>
          <td style="padding:8px;font-weight:bold">Customer</td>
          <td style="padding:8px">${opts.customerName} &lt;${opts.customerEmail}&gt;</td>
        </tr>
        <tr style="background:#f3f4f6">
          <td style="padding:8px;font-weight:bold">Pickup Time</td>
          <td style="padding:8px">${opts.pickupTime}</td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead>
          <tr style="background:#f3f4f6">
            <th style="padding:8px;text-align:left">Item</th>
            <th style="padding:8px;text-align:center">Qty</th>
            <th style="padding:8px;text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr style="border-top:2px solid #e5e7eb">
            <td colspan="2" style="padding:8px;font-weight:bold">Total</td>
            <td style="padding:8px;text-align:right;font-weight:bold;color:#16a34a">₦${opts.totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      <p style="margin-top:16px;font-size:13px;color:#374151">
        Log in to the admin dashboard to confirm this order.
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">OLLY Supermarket &bull; Fresh &amp; Fast Pickup</p>
    </div>
  `;
}

export function orderReadyEmailHtml(opts: {
  customerName: string;
  customerEmail: string;
  pickupCode: string;
  items: Array<{ product_name: string; quantity: number }>;
  pickupTime: string;
}): string {
  const itemList = opts.items
    .map((i) => `<li>${i.product_name} × ${i.quantity}</li>`)
    .join('');
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#16a34a">Your order is ready for pickup! 🎉</h2>
      <p>Hi ${opts.customerName},</p>
      <p>Great news — your OLLY Supermarket order is packed and ready. Head to the store and show your pickup code at the counter.</p>
      <div style="text-align:center;margin:24px 0">
        <p style="color:#6b7280;font-size:13px;margin-bottom:6px">Your Pickup Code</p>
        <span style="font-family:monospace;font-size:36px;font-weight:900;color:#16a34a;letter-spacing:4px">
          ${opts.pickupCode}
        </span>
      </div>
      <p style="font-size:14px;color:#374151"><strong>Scheduled pickup:</strong> ${opts.pickupTime}</p>
      <ul style="font-size:14px;color:#374151;margin:12px 0;padding-left:20px">${itemList}</ul>
      <p style="font-size:13px;color:#6b7280;margin-top:16px">
        If you have any issues, contact us on WhatsApp.
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">OLLY Supermarket &bull; Fresh &amp; Fast Pickup</p>
      ${unsubscribeFooter(opts.customerEmail)}
    </div>
  `;
}

export function orderCompletedEmailHtml(opts: {
  customerName: string;
  customerEmail: string;
  pickupCode: string;
  totalAmount: number;
}): string {
  const shopUrl = `${FRONTEND_URL || 'http://localhost:3000'}/shop`;
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#16a34a">Thank you for shopping with us! 🙏</h2>
      <p>Hi ${opts.customerName},</p>
      <p>
        Your order <strong style="font-family:monospace;color:#16a34a">${opts.pickupCode}</strong>
        has been collected successfully. We are so grateful for your patronage!
      </p>
      <p style="font-size:14px;color:#374151">
        <strong>Order total:</strong> ₦${opts.totalAmount.toFixed(2)}
      </p>
      <p style="margin-top:16px;font-size:14px;color:#374151">
        We hope to see you again soon. Fresh produce and great deals are always waiting for you at OLLY Supermarket.
      </p>
      <p style="margin-top:24px">
        <a href="${shopUrl}"
           style="background:#16a34a;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:14px">
          Shop Again
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:32px">OLLY Supermarket &bull; Fresh &amp; Fast Pickup</p>
      ${unsubscribeFooter(opts.customerEmail)}
    </div>
  `;
}

export function productNotificationHtml(opts: {
  title: string;
  content: string;
  recipientEmail?: string;
}): string {
  const shopUrl = `${FRONTEND_URL || 'http://localhost:3000'}/shop`;
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#16a34a">OLLY Supermarket</h2>
      <h3>${opts.title}</h3>
      <p>${opts.content.replace(/\n/g, '<br>')}</p>
      <p style="margin-top:24px">
        <a href="${shopUrl}"
           style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
          Shop Now
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">OLLY Supermarket &bull; Fresh &amp; Fast Pickup</p>
      ${opts.recipientEmail ? unsubscribeFooter(opts.recipientEmail) : ''}
    </div>
  `;
}
