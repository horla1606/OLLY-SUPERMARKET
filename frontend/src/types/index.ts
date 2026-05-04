export type UserRole = 'customer' | 'manager' | 'admin' | 'staff';

export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  expiry_date?: string;
  image_url?: string;
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
  pickup_code?: string;
  created_at: string;
}

export interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  price: number;
  image_url?: string;
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
  phone?: string;
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

export interface Analytics {
  id: string;
  product_id?: string;
  date: string;
  sales_count: number;
  revenue: number;
  staff_id?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
}

export interface DashboardSummary {
  total_revenue: number;
  total_orders: number;
  pending_orders: number;
  low_stock_products: number;
  unread_messages: number;
  recent_orders: Order[];
}

// Admin dashboard response from GET /api/admin/dashboard
export interface AdminDashboard {
  customers:      number;
  orders_30d:     number;
  revenue_30d:    number;
  pending_orders: OrderWithCustomer[];
  low_stock:      number;
}

export interface OrderWithCustomer extends Order {
  users?: {
    name: string;
    email: string;
    phone?: string;
  };
}

export interface ExpiringProduct extends Product {
  days_until_expiry: number;
}

// ─── Analytics ────────────────────────────────────────────────────────────────
export interface ProductPerformance {
  product_id:  string;
  name:        string;
  category:    string;
  revenue:     number;
  sales_count: number;
}

export interface AnalyticsDashboardData {
  all_time_revenue:   number;
  all_time_sales:     number;
  this_month_revenue: number;
  last_month_revenue: number;
  mom_change_pct:     number | null;
  top_products_30d:   ProductPerformance[];
}

export interface RevenuePoint {
  label:       string;
  revenue:     number;
  sales_count: number;
}

export interface StaffPerformance {
  staff_id:    string;
  name:        string;
  email:       string;
  revenue:     number;
  sales_count: number;
}

export interface StaffDuty {
  id:         string;
  staff_id:   string;
  date:       string;
  created_at: string;
  staff?: Pick<Staff, 'id' | 'name' | 'email' | 'phone'>;
}

// ─── Messaging / Communications ───────────────────────────────────────────────
export interface MessageWithCustomer extends Message {
  reply?:       string;
  replied_at?:  string;
  replied_by?:  string;
  users?: {
    id:     string;
    name:   string;
    email:  string;
    phone?: string;
  };
}

export type SocialPlatform = 'facebook' | 'instagram' | 'twitter';
export type SocialPostStatus = 'draft' | 'scheduled' | 'posted' | 'failed';

export interface SocialPost {
  id:             string;
  platform:       SocialPlatform;
  content:        string;
  image_url?:     string;
  scheduled_date?: string;
  status:         SocialPostStatus;
  product_id?:    string;
  created_by?:    string;
  created_at:     string;
  products?: { name: string };
}

export interface Notification {
  id:          string;
  type:        string;
  title:       string;
  content:     string;
  product_id?: string;
  sent_at:     string;
  sent_count:  number;
  created_by?: string;
  products?: { name: string };
}
