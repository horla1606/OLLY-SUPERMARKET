import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase-server';
import { authenticate, guard } from '@/lib/auth-server';
import { sendEmail, productNotificationHtml } from '@/lib/email-server';
export const dynamic = 'force-dynamic';

async function uploadImage(file: File): Promise<string | null> {
  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase();
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error } = await supabase.storage
    .from('product-images')
    .upload(fileName, buffer, { contentType: file.type, upsert: false });

  if (error) {
    console.error('Storage upload error:', error.message);
    return null;
  }

  const { data } = supabase.storage.from('product-images').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function POST(req: NextRequest) {
  const user = await authenticate(req);
  const authErr = guard(user, 'manager');
  if (authErr) return authErr;

  try {
    const formData = await req.formData();
    const name = formData.get('name') as string;
    const category = formData.get('category') as string;
    const price = formData.get('price') as string;
    const stock = formData.get('stock') as string;
    const expiry_date = formData.get('expiry_date') as string | null;
    const imageFile = formData.get('image') as File | null;

    if (!name?.trim() || !category?.trim() || !price) {
      return Response.json({ message: 'name, category, and price are required' }, { status: 400 });
    }

    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock ?? '0', 10);

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      return Response.json({ message: 'price must be a non-negative number' }, { status: 400 });
    }

    const image_url = imageFile && imageFile.size > 0 ? await uploadImage(imageFile) : null;

    const description = formData.get('description') as string | null;
    const galleryExisting: string[] = JSON.parse((formData.get('gallery_existing') as string) ?? '[]');
    const galleryCount = parseInt((formData.get('gallery_count') as string) ?? '0', 10);
    const newGalleryUrls: string[] = [];
    for (let i = 0; i < galleryCount; i++) {
      const gf = formData.get(`gallery_file_${i}`) as File | null;
      if (gf && gf.size > 0) { const u = await uploadImage(gf); if (u) newGalleryUrls.push(u); }
    }
    const gallery_images = [...galleryExisting, ...newGalleryUrls].slice(0, 4);

    const { data, error } = await supabase
      .from('products')
      .insert({
        name: name.trim(),
        category: category.trim(),
        price: parsedPrice,
        stock: isNaN(parsedStock) ? 0 : parsedStock,
        expiry_date: expiry_date?.trim() || null,
        image_url,
        description: description?.trim() || null,
        gallery_images: gallery_images.length ? gallery_images : null,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-notify customers (fire-and-forget)
    const newProduct = data as { id: string; name: string; category: string; price: number };
    void (async () => {
      try {
        const { data: customers } = await supabase.from('users').select('email').eq('role', 'customer');
        const emails = (customers ?? []).map((c) => c.email).filter(Boolean) as string[];
        if (!emails.length) return;

        const title = `New Product: ${newProduct.name}`;
        const content = `${newProduct.name} is now available in our ${newProduct.category} section at â‚¦${newProduct.price.toLocaleString()}. Order now for fast pickup!`;

        await Promise.all([
          sendEmail({ to: emails, subject: title, html: productNotificationHtml({ title, content }) }),
          supabase.from('notifications').insert({
            type: 'product',
            title,
            content,
            product_id: newProduct.id,
            sent_count: emails.length,
          }),
        ]);
      } catch { /* best-effort */ }
    })();

    return Response.json(data, { status: 201 });
  } catch (err) {
    console.error('admin/create product:', err);
    return Response.json({ message: 'Internal server error' }, { status: 500 });
  }
}
