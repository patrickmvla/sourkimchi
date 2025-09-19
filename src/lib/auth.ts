// lib/auth.ts
import { currentUser } from '@clerk/nextjs/server';

const ADMIN_EMAILS = new Set([process.env.ADMIN_EMAIL!]);

export async function requireAdmin() {
  const user = await currentUser();
  if (!user || !user.emailAddresses?.some(e => ADMIN_EMAILS.has(e.emailAddress))) {
    throw new Error('Not authorized');
  }
  return user;
}   