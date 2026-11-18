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

// ตรวจว่า session นี้ล็อกอินผ่าน Google (OAuth) จริงหรือไม่ จาก claim `amr` ใน JWT ที่ Supabase ออกให้
// (ไม่ได้มาจากค่าที่ผู้ใช้กรอก) ใช้ยืนยันความเป็นเจ้าของอีเมลสำหรับสิทธิ์เจ้าหน้าที่
function isOAuthSession(session: any): boolean {
  try {
    const part = String(session?.access_token || '').split('.')[1];
    if (part) {
      const payload = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
      if (Array.isArray(payload.amr)) {
        return payload.amr.some((a: any) => (a?.method || a) === 'oauth');
      }
    }
  } catch {}
  return session?.user?.app_metadata?.provider === 'google';
}

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

    // สิทธิ์เจ้าหน้าที่ต้องยืนยันตัวตนผ่าน Google เท่านั้น (กันการสมัครด้วยรหัสผ่านโดยใช้อีเมลเจ้าหน้าที่ที่ไม่ใช่ของตน)
    if (isStaffEmail && chosenRole === 'admin' && !isOAuthSession(session)) {
      await sb.auth.signOut();
      onError('เจ้าหน้าที่ห้องพยาบาลต้องเข้าสู่ระบบด้วยปุ่ม Google เท่านั้น');
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
      finalType = isStaffEmail && isOAuthSession(session) ? 'admin' : /^\d/.test(email) ? 'student' : 'personnel';
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

const thaiAuthError = (msg: string): string => {
  const m = (msg || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  if (m.includes('email not confirmed')) return 'ยังไม่ได้ยืนยันอีเมล กรุณาตรวจสอบกล่องจดหมายและกดลิงก์ยืนยันก่อน';
  if (m.includes('already registered') || m.includes('already been registered')) return 'อีเมลนี้สมัครสมาชิกไว้แล้ว กรุณาเข้าสู่ระบบ';
  if (m.includes('rate limit') || m.includes('too many')) return 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่';
  if (m.includes('password') && m.includes('characters')) return 'รหัสผ่านสั้นเกินไป (ขั้นต่ำ 6 ตัวอักษร)';
  return msg || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
};

// เข้าสู่ระบบด้วยอีเมล + รหัสผ่าน (ใช้ Supabase Auth เดิม การตรวจโดเมน/สิทธิ์ทำใน initAuth)
export async function signInWithPassword(email: string, password: string, selectedRole: LoginRole): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
  setSelectedLoginRole(selectedRole);
  const { error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return error ? thaiAuthError(error.message) : null;
}

// สมัครสมาชิก คืนค่า { error, needsConfirm }
export async function signUpWithPassword(
  fullName: string, email: string, password: string, selectedRole: LoginRole
): Promise<{ error: string | null; needsConfirm: boolean }> {
  const sb = getSupabase();
  if (!sb) return { error: 'ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ', needsConfirm: false };
  // การสมัครสมาชิกรองรับเฉพาะนักศึกษา/บุคลากรทั่วไป — ไม่เปิดให้กำหนดสิทธิ์เจ้าหน้าที่เอง
  const safeRole: LoginRole = selectedRole === 'personnel' ? 'personnel' : 'student';
  if (isAdminEmail(email)) {
    return { error: 'อีเมลนี้เป็นบัญชีเจ้าหน้าที่ ไม่สามารถสมัครสมาชิกได้ กรุณาเข้าสู่ระบบด้วยปุ่ม Google', needsConfirm: false };
  }
  setSelectedLoginRole(safeRole);
  const { data, error } = await sb.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: { data: { full_name: fullName.trim() }, emailRedirectTo: window.location.origin + '/' },
  });
  if (error) return { error: thaiAuthError(error.message), needsConfirm: false };
  // อีเมลที่สมัครแล้ว Supabase จะคืน identities ว่าง
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: 'อีเมลนี้สมัครสมาชิกไว้แล้ว กรุณาเข้าสู่ระบบ', needsConfirm: false };
  }
  return { error: null, needsConfirm: !data.session };
}

export async function sendPasswordReset(email: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return 'ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ';
  const { error } = await sb.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: window.location.origin + '/' });
  return error ? thaiAuthError(error.message) : null;
}

export async function signOutUser() {
  const sb = getSupabase();
  if (sb) {
    try { await sb.auth.signOut(); } catch {}
  }
}
