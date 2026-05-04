import nodemailer from 'nodemailer';

const { EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM } = process.env;

const enabled = !!(EMAIL_USER && EMAIL_PASS);

const transporter = enabled
  ? nodemailer.createTransport({
      host:   EMAIL_HOST  || 'smtp.gmail.com',
      port:   Number(EMAIL_PORT) || 587,
      secure: Number(EMAIL_PORT) === 465,
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    })
  : null;

export async function sendEmail(opts: {
  to:      string | string[];
  subject: string;
  html:    string;
}): Promise<void> {
  if (!transporter) return; // silently skip when email not configured
  await transporter.sendMail({
    from: EMAIL_FROM || EMAIL_USER,
    to:   Array.isArray(opts.to) ? opts.to.join(',') : opts.to,
    subject: opts.subject,
    html:    opts.html,
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

export function productNotificationHtml(opts: {
  title:   string;
  content: string;
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
      <h2 style="color:#16a34a">OLLY Supermarket</h2>
      <h3>${opts.title}</h3>
      <p>${opts.content.replace(/\n/g, '<br>')}</p>
      <p style="margin-top:24px">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/shop"
           style="background:#16a34a;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">
          Shop Now
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;margin-top:24px">OLLY Supermarket &bull; Fresh &amp; Fast Pickup</p>
    </div>
  `;
}
