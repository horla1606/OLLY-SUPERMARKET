import { User } from '@/types';

const TOKEN_KEY = 'olly_auth_token';
const USER_KEY  = 'olly_user';

// Cookie helpers — mirrors token into a cookie so Next.js middleware can read it
function setCookie(name: string, value: string, days = 7): void {
  if (typeof document === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
}

export const auth = {
  setToken(token: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, token);
      setCookie('olly_token', token);
    }
  },

  getToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(TOKEN_KEY);
    }
    return null;
  },

  setUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      // Mirror role into a cookie for Next.js edge middleware
      setCookie('olly_role', user.role);
    }
  },

  getUser(): User | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(USER_KEY);
      try {
        return stored ? (JSON.parse(stored) as User) : null;
      } catch {
        return null;
      }
    }
    return null;
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  hasRole(...roles: string[]): boolean {
    const user = this.getUser();
    return !!user && roles.includes(user.role);
  },

  isManager(): boolean {
    return this.hasRole('manager', 'admin', 'staff');
  },

  clear(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('olly_recent_orders');
      localStorage.removeItem('olly_guest_cart');
      deleteCookie('olly_token');
      deleteCookie('olly_role');
    }
  },

  logout(): void {
    this.clear();
    window.location.href = '/login';
  },
};
