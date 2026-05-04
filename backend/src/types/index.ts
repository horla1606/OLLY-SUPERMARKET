export type UserRole = 'customer' | 'admin' | 'staff';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  role: UserRole;
  password_hash: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  expiry_date?: string | null;
  image_url?: string | null;
  created_at: string;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  customer_id: string;
  items: OrderItem[];
  total_amount: number;
  pickup_time: string;
  status: OrderStatus;
  pickup_code?: string | null;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
}

export interface Cart {
  id: string;
  customer_id: string;
  items: CartItem[];
  updated_at: string;
}

export interface Staff {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  hire_date: string;
  created_at: string;
}

export type MessageType = 'inquiry' | 'complaint' | 'feedback' | 'support';
export type MessageStatus = 'unread' | 'read' | 'replied' | 'closed';

export interface Message {
  id: string;
  customer_id: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  created_at: string;
}
