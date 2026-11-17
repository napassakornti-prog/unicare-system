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

const LOCAL_USER_KEY = 'unicare_local_auth_user';

export function getLocalAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function signInWithEmailDirect(emailInput: string, customName?: string): { success: boolean; error?: string; user?: AuthUser } {
  const email = emailInput.trim().toLowerCase();
  if (!email) return { success: false, error: 'กรุณากรอกอีเมลมหาวิทยาลัย' };
  if (!isUniversityEmail(email)) {
    return { success: false, error: `อีเมลต้องลงท้ายด้วย @${ALLOWED_DOMAIN} เท่านั้น (เช่น napssakorn.ti@${ALLOWED_DOMAIN})` };
  }
  const prefix = email.split('@')[0];
  const name = customName || (getAdminEmails().includes(email) ? 'ผู้ดูแลระบบ (' + prefix + ')' : 'นักศึกษา / บุคลากร (' + prefix + ')');
  const user: AuthUser = {
    email,
    name,
    role: getAdminEmails().includes(email) ? 'admin' : 'user',
  };
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
  return { success: true, user };
}

// ฟังสถานะการล็อกอิน (รวมถึงตอนกลับมาจากหน้า Google) และตรวจโดเมนอีเมลทุกครั้ง
export function initAuth(onUser: (u: AuthUser | null) => void, onError: (msg: string) => void): () => void {
  const local = getLocalAuthUser();
  if (local) {
    onUser(local);
  }

  const sb = getSupabase();
  if (!sb) {
    if (!local) onUser(null);
    return () => {};
  }
  const handle = async (session: any) => {
    if (!session?.user) {
      const curLocal = getLocalAuthUser();
      if (curLocal) onUser(curLocal);
      else onUser(null);
      return;
    }
    const email = (session.user.email || '').toLowerCase();
    if (!isUniversityEmail(email)) {
      await sb.auth.signOut();
      localStorage.removeItem(LOCAL_USER_KEY);
      onError(`อีเมล ${email || '(ไม่ทราบ)'} ไม่ใช่อีเมลมหาวิทยาลัย กรุณาเข้าสู่ระบบด้วยอีเมล @${ALLOWED_DOMAIN} เท่านั้น`);
      onUser(null);
      return;
    }
    const meta = session.user.user_metadata || {};
    const u: AuthUser = {
      email,
      name: meta.full_name || meta.name || email.split('@')[0],
      avatar: meta.avatar_url || meta.picture,
      role: getAdminEmails().includes(email) ? 'admin' : 'user',
    };
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(u));
    onUser(u);
  };
  sb.auth.getSession().then(({ data }) => handle(data.session)).catch(() => {
    const curLocal = getLocalAuthUser();
    if (curLocal) onUser(curLocal);
    else onUser(null);
  });
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
  localStorage.removeItem(LOCAL_USER_KEY);
  const sb = getSupabase();
  if (sb) {
    try { await sb.auth.signOut(); } catch {}
  }
}
