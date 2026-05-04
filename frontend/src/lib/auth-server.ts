import { SignJWT, jwtVerify } from 'jose';
import type { NextRequest } from 'next/server';

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET!);
const EXPIRES = process.env.JWT_EXPIRES_IN ?? '7d';

export interface JWTPayload {
  id: string;
  email: string;
  role: string;
}

export async function issueToken(user: {
  id: string;
  email: string;
  role: string;
}): Promise<string> {
  const jwtRole = ['manager', 'admin', 'staff'].includes(user.role)
    ? 'manager'
    : 'customer';
  return new SignJWT({ id: user.id, email: user.email, role: jwtRole })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES)
    .sign(secret());
}

export async function authenticate(req: NextRequest): Promise<JWTPayload | null> {
  const auth = req.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    const { payload } = await jwtVerify(auth.slice(7), secret());
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export function unauthorized(): Response {
  return Response.json({ message: 'No token provided' }, { status: 401 });
}

export function forbidden(): Response {
  return Response.json({ message: 'Forbidden: insufficient permissions' }, { status: 403 });
}

export function guard(
  user: JWTPayload | null,
  ...roles: string[]
): Response | null {
  if (!user) return unauthorized();
  if (roles.length && !roles.includes(user.role)) return forbidden();
  return null;
}
