import { getSupabase } from './supabase';

// โดเมนอีเมลมหาวิทยาลัยกาฬสินธุ์ ที่อนุญาตให้เข้าสู่ระบบเท่านั้น
export const ALLOWED_DOMAIN = 'ksu.ac.th';

export type LoginRole = 'student' | 'personnel' | 'admin';

export interface AuthUser {
  email: string;
  name: string;
  avatar?: string;
  role: 'admin' | 'user';
  userType: LoginRole;
}

const ADMIN_KEY = 'unicare_admin_emails';
const SELECTED_ROLE_KEY = 'unicare_selected_role';

// ผู้ดูแลระบบ/เจ้าหน้าที่หลัก (ไม่แสดงอีเมลบนหน้าจอ) เพิ่มเติมได้ผ่าน VITE_ADMIN_EMAILS หรือหน้าตั้งค่า
const CORE_ADMINS = ['napassakorn.ti@ksu.ac.th', 'napssakorn.ti@ksu.ac.th'];

export const isUniversityEmail = (email: string) =>
  email.trim().toLowerCase().endsWith('@' + ALLOWED_DOMAIN);

const envAdmins = (): string[] =>
  ((import.meta as any).env?.VITE_ADMIN_EMAILS || '')
    .split(',').map((s: string) => s.trim().toLowerCase()).filter(Boolean);

export function getAdminEmails(): string[] {
  return Array.from(new Set([...CORE_ADMINS, ...envAdmins(), ...getLocalAdminEmails().map(e => e.toLowerCase())]));
}

export function isAdminEmail(email: string): boolean {
  return getAdminEmails().includes(email.trim().toLowerCase());
}

// รายชื่อที่แสดงในหน้าตั้งค่า (ไม่รวมผู้ดูแลหลักที่กำหนดไว้ในระบบ)
export function getVisibleAdminEmails(): string[] {
  return Array.from(new Set([...envAdmins(), ...getLocalAdminEmails().map(e => e.toLowerCase())]));
}

export function getLocalAdminEmails(): string[] {
  try { return JSON.parse(localStorage.getItem(ADMIN_KEY) || '[]'); } catch { return []; }
}

export function saveLocalAdminEmails(list: string[]) {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(Array.from(new Set(list.map(e => e.trim().toLowerCase()).filter(Boolean)))));
}

export function getSelectedLoginRole(): LoginRole | null {
  try {
    const val = localStorage.getItem(SELECTED_ROLE_KEY);
    if (val === 'student' || val === 'personnel' || val === 'admin') return val;
    return null;
  } catch {
    return null;
  }
}

export function setSelectedLoginRole(role: LoginRole) {
  try { localStorage.setItem(SELECTED_ROLE_KEY, role); } catch {}
}

export function getRoleLabel(type?: LoginRole): string {
  if (type === 'admin') return 'เจ้าหน้าที่ห้องพยาบาล';
  if (type === 'personnel') return 'บุคลากรทั่วไป';
  return 'นักศึกษา';
}

export const emailToId = (email: string) => email.split('@')[0].toLowerCase();

// ฟังสถานะการล็อกอิน (รวมถึงตอนกลับมาจากหน้า Google) และตรวจโดเมนอีเมล + สิทธิ์ที่เลือกทุกครั้ง
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

    const chosenRole = getSelectedLoginRole();
    const isStaffEmail = isAdminEmail(email);

    // กรณีเลือกเข้าสู่ระบบในฐานะ "เจ้าหน้าที่ห้องพยาบาล" ต้องเป็นอีเมลเจ้าหน้าที่ที่กำหนดไว้เท่านั้น
    if (chosenRole === 'admin' && !isStaffEmail) {
      await sb.auth.signOut();
      onError('บัญชีนี้ไม่มีสิทธิ์เข้าใช้งานในฐานะ "เจ้าหน้าที่ห้องพยาบาล" กรุณาเลือกสิทธิ์ นักศึกษา หรือ บุคลากรทั่วไป');
      onUser(null);
      return;
    }

    // กำหนดประเภทผู้ใช้ตามที่เลือก หรือตรวจสอบอัตโนมัติหากไม่ได้ระบุไว้
    let finalType: LoginRole;
    if (chosenRole === 'admin' && isStaffEmail) {
      finalType = 'admin';
    } else if (chosenRole === 'student' || chosenRole === 'personnel') {
      finalType = chosenRole;
    } else {
      finalType = isStaffEmail ? 'admin' : /^\d/.test(email) ? 'student' : 'personnel';
    }

    const meta = session.user.user_metadata || {};
    onUser({
      email,
      name: meta.full_name || meta.name || email.split('@')[0],
      avatar: meta.avatar_url || meta.picture,
      role: finalType === 'admin' ? 'admin' : 'user',
      userType: finalType,
    });
  };
  sb.auth.getSession().then(({ data }) => handle(data.session)).catch(() => onUser(null));
  const { data: sub } = sb.auth.onAuthStateChange((_event, session) => { handle(session); });
  return () => sub.subscription.unsubscribe();
}

export async function signInWithGoogle(selectedRole: LoginRole = 'student'): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
  setSelectedLoginRole(selectedRole);
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
  if (sb) {
    try { await sb.auth.signOut(); } catch {}
  }
}
