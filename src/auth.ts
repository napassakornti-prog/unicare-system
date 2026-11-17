import { getSupabase } from './supabase';

// โดเมนอีเมลมหาวิทยาลัยกาฬสินธุ์ ที่อนุญาตให้เข้าสู่ระบบเท่านั้น
export const ALLOWED_DOMAIN = 'ksu.ac.th';

export interface AuthUser {
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user';
}

const ADMIN_KEY = 'unicare_admin_emails';
const DEFAULT_ADMINS = ['napssakorn.ti@ksu.ac.th', 'napassakorn.ti@ksu.ac.th'];

export const isUniversityEmail = (email: string) =>
  email.trim().toLowerCase().endsWith('@' + ALLOWED_DOMAIN);

export function getAdminEmails(): string[] {
  const env = ((import.meta as any).env?.VITE_ADMIN_EMAILS || '')
    .split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);
  let local: string[] = [];
  try { local = JSON.parse(localStorage.getItem(ADMIN_KEY) || '[]'); } catch {}
  return Array.from(new Set([...DEFAULT_ADMINS, ...env, ...local.map(e => e.toLowerCase())]));
}

export function getLocalAdminEmails(): string[] {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || '[]'); } catch { return []; }
}

export function saveLocalAdminEmails(list: string[]) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(Array.from(new Set(list.map(e => e.trim().toLowerCase()).filter(Boolean)))));
}

export const emailToId = (email: string) => email.split('@')[0].toLowerCase();

// ฟังสถานะการล็อกอิน (รวมถึงตอนกลับมาจากหน้า Google) และตรวจโดเมนอีเมลทุกครั้ง
export function initAuth(onUser: (u: AuthUser | null) => void, onError: (msg: string) => void): () => void {
  const sb = getSupabase();
  if (!sb) {
    onUser(null);
    return () => {};
  }
  const handle = async (session: any) => {
    if (!session?.user) { onUser(null); return; }
    const email = (session.user.email || '').toLowerCase();
    if (!isUniversityEmail(email)) {
      await sb.auth.signOut();
      onError(`อีเมล ${email || '(ไม่ทราบ)'} ไม่ใช่อีเมลมหาวิทยาลัย กรุณาเข้าสู่ระบบด้วยอีเมล @${ALLOWED_DOMAIN} เท่านั้น`);
      onUser(null);
      return;
    }
    const meta = session.user.user_metadata || {};
    onUser({
      email,
      name: meta.full_name || meta.name || email.split('@')[0],
      avatar: meta.avatar_url || meta.picture,
      role: getAdminEmails().includes(email) ? 'admin' : 'user',
    });
  };
  sb.auth.getSession().then(({ data }) => handle(data.session)).catch(() => onUser(null));
  const { data: sub } = sb.auth.onAuthStateChange((_event, session) => { handle(session); });
  return () => sub.subscription.unsubscribe();
}

export async function signInWithGoogle(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'ยังไม่ได้ตั้งค่า Supabase (Project URL และ Anon Key)';
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/',
      queryParams: { hd: ALLOWED_DOMAIN, prompt: 'select_account' },
    },
  });
  return error ? error.message : null;
}

export async function signOutUser() {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}
