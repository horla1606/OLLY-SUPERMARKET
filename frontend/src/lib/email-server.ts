import nodemailer from 'nodemailer';

const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM, FRONTEND_URL } =
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

export function productNotificationHtml(opts: {
  title: string;
  content: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#16a34a">OLLY Supermarket</h2>
      <h3>${opts.title}</h3>
      <p>${opts.content.replace(/\n/g, '<br>')}</p>
      <p style="margin-top:24px">
        <a href="${FRONTEND_URL || 'http://localhost:3000'}/shop"
           style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
          Shop Now
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">OLLY Supermarket &bull; Fresh &amp; Fast Pickup</p>
    </div>
  `;
}
