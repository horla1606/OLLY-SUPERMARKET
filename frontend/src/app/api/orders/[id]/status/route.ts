import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
import { sendEmail, orderReadyEmailHtml, orderCompletedEmailHtml } from '@/lib/email-server';
export const dynamic = 'force-dynamic';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const { status } = await req.json();
    const validStatuses = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];

    if (!status || !validStatuses.includes(status)) {
      return Response.json(
        { message: `status must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const { data: updatedOrder, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Send customer email for status changes they care about (best-effort, non-fatal)
    if (status === 'ready' || status === 'completed') {
      try {
        const order = updatedOrder as {
          customer_id: string;
          pickup_code: string;
          pickup_time: string;
          total_amount: number;
          items: Array<{ product_name: string; quantity: number; price: number }>;
        };

        const { data: customer } = await supabase
          .from('users')
          .select('name, email')
          .eq('id', order.customer_id)
          .single();

        if (customer?.email) {
          const pickupTime = new Date(order.pickup_time).toLocaleString('en-NG', {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          });

          if (status === 'ready') {
            await sendEmail({
              to: customer.email,
              subject: `Your order ${order.pickup_code} is ready for pickup!`,
              html: orderReadyEmailHtml({
                customerName:  customer.name,
                customerEmail: customer.email,
                pickupCode:    order.pickup_code,
                items:         order.items,
                pickupTime,
              }),
            });
          } else {
            await sendEmail({
              to: customer.email,
              subject: `Thank you for your order — OLLY Supermarket`,
              html: orderCompletedEmailHtml({
                customerName:  customer.name,
                customerEmail: customer.email,
                pickupCode:    order.pickup_code,
                totalAmount:   Number(order.total_amount),
              }),
            });
          }
        }
      } catch (emailErr) {
        console.error('send order status email:', emailErr);
      }
    }

    return Response.json(updatedOrder);
  } catch (err) {
    console.error('update order status:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
