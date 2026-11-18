import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'unicare_supabase_url';
const STORAGE_KEY_KEY = 'unicare_supabase_anon_key';

// ค่าเริ่มต้นสำหรับ Production บนคลาวด์ มหาวิทยาลัยกาฬสินธุ์
export const DEFAULT_SUPABASE_URL = 'https://sjdnvqosivwyxhsqbftd.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_8Zs82KhXLJP7IjMbSDhl6w_uIicmNFD';

export function getSupabaseConfig(): { url: string; key: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  const savedUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
  const savedKey = localStorage.getItem(STORAGE_KEY_KEY) || '';
  return {
    url: savedUrl || envUrl || DEFAULT_SUPABASE_URL,
    key: savedKey || envKey || DEFAULT_SUPABASE_ANON_KEY
  };
}

export function saveSupabaseConfig(url: string, key: string) {
  if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
  else localStorage.removeItem(STORAGE_KEY_URL);

  if (key) localStorage.setItem(STORAGE_KEY_KEY, key.trim());
  else localStorage.removeItem(STORAGE_KEY_KEY);
}

let cachedClient: SupabaseClient | null = null;
let lastUrl = '';
let lastKey = '';

export function getSupabase(): SupabaseClient | null {
  const { url, key } = getSupabaseConfig();
  if (!url || !key) return null;
  if (cachedClient && lastUrl === url && lastKey === key) {
    return cachedClient;
  }
  try {
    cachedClient = createClient(url, key);
    lastUrl = url;
    lastKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Failed to create Supabase client:', err);
    return null;
  }
}

export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, message: 'ยังไม่ได้ระบุ Supabase Project URL หรือ Anon Key' };
  }
  try {
    // ลอง query เบาๆ ตรวจสอบการเชื่อมต่อ
    const { error } = await supabase.from('medicines').select('id').limit(1);
    if (error) {
      if (error.code === '42P01') {
        return { success: false, message: 'เชื่อมต่อ Supabase ได้แล้ว แต่ยังไม่ได้สร้างตารางข้อมูล (กรุณากดคัดลอก SQL Script ไปรันใน SQL Editor)' };
      }
      return { success: false, message: `ข้อผิดพลาดจาก Supabase: ${error.message}` };
    }
    return { success: true, message: 'เชื่อมต่อฐานข้อมูลคลาวด์ Supabase สำเร็จเรียบร้อยแล้ว' };
  } catch (err: any) {
    return { success: false, message: `เชื่อมต่อไม่สำเร็จ: ${err?.message || 'Network Error'}` };
  }
}

// อัปโหลดข้อมูลจาก Local ขึ้น Supabase Cloud
export async function syncLocalToSupabase(data: {
  students: any[];
  medicines: any[];
  visits: any[];
  beds: any[];
}): Promise<{ success: boolean; message: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { success: false, message: 'กรุณาตั้งค่า Supabase URL และ Anon Key ก่อนซิงค์' };
  }
  try {
    if (data.medicines && data.medicines.length > 0) {
      const { error } = await supabase.from('medicines').upsert(data.medicines.map(m => ({
        id: m.id,
        name: m.name,
        category: m.category,
        stock: m.stock,
        min: m.min,
        unit: m.unit,
        lot: m.lot,
        expiry: m.expiry,
        status: m.status
      })));
      if (error) throw error;
    }

    if (data.beds && data.beds.length > 0) {
      const { error } = await supabase.from('beds').upsert(data.beds.map(b => ({
        id: b.id,
        name: b.name,
        status: b.status,
        student_id: b.studentId,
        student_name: b.studentName,
        symptom: b.symptom,
        time_in: b.timeIn
      })));
      if (error) throw error;
    }

    if (data.students && data.students.length > 0) {
      const { error } = await supabase.from('students').upsert(data.students.map(s => ({
        id: s.id,
        role: s.role || 'นักศึกษา',
        name: s.name,
        first_name: s.firstName || '',
        last_name: s.lastName || '',
        faculty: s.faculty || '',
        department: s.department || '',
        year: s.year || '',
        blood: s.blood || '',
        phone: s.phone || '',
        allergies: s.allergies || [],
        allergy_reaction: s.allergyReaction || '',
        severe_allergies: !!s.severeAllergies,
        visits_count: s.visitsCount || 0
      })));
      if (error) throw error;
    }

    if (data.visits && data.visits.length > 0) {
      const { error } = await supabase.from('visits').upsert(data.visits.map(v => ({
        id: v.id,
        time: v.time,
        patient_id: v.patientId || v.studentId,
        student_id: v.studentId,
        student_name: v.studentName,
        patient_role: v.patientRole || 'นักศึกษา',
        faculty: v.faculty,
        department: v.department,
        symptom: v.symptom,
        triage: v.triage,
        status: v.status,
        diagnosis: v.diagnosis,
        meds: v.meds || [],
        bed_id: v.bedId,
        allergies: v.allergies || [],
        allergy_reaction: v.allergyReaction || ''
      })));
      if (error) throw error;
    }

    return { success: true, message: 'ซิงค์ข้อมูลขึ้น Supabase Cloud สำเร็จเรียบร้อยแล้ว' };
  } catch (err: any) {
    return { success: false, message: `เกิดข้อผิดพลาดในการซิงค์: ${err?.message || 'Database error'}` };
  }
}

// SQL Script สำหรับสร้างตารางบน Supabase SQL Editor
export const SUPABASE_SCHEMA_SQL = `-- ========================================================
-- UniCare Intelligent Infirmary System: Supabase SQL Schema
-- มหาวิทยาลัยกาฬสินธุ์ (Kalasin University)
-- ========================================================

-- 1. ตารางทะเบียนผู้รับบริการ (นักศึกษา, อาจารย์, เจ้าหน้าที่, บุคลากร)
CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  role TEXT DEFAULT 'นักศึกษา',
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  faculty TEXT,
  department TEXT,
  year TEXT,
  blood TEXT,
  phone TEXT,
  allergies JSONB DEFAULT '[]'::jsonb,
  allergy_reaction TEXT,
  severe_allergies BOOLEAN DEFAULT FALSE,
  emergency_contact TEXT,
  visits_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ตารางคลังยาและเวชภัณฑ์
CREATE TABLE IF NOT EXISTS medicines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  stock INTEGER DEFAULT 0,
  min INTEGER DEFAULT 0,
  unit TEXT,
  lot TEXT,
  expiry TEXT,
  status TEXT DEFAULT 'ปกติ',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ตารางประวัติการเข้ารับบริการและการจ่ายยา
CREATE TABLE IF NOT EXISTS visits (
  id TEXT PRIMARY KEY,
  time TEXT,
  patient_id TEXT,
  student_id TEXT,
  student_name TEXT,
  patient_role TEXT,
  faculty TEXT,
  department TEXT,
  symptom TEXT,
  triage TEXT,
  status TEXT,
  diagnosis TEXT,
  meds JSONB DEFAULT '[]'::jsonb,
  bed_id TEXT,
  allergies JSONB DEFAULT '[]'::jsonb,
  allergy_reaction TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ตารางผังเตียงพักฟื้น
CREATE TABLE IF NOT EXISTS beds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'available',
  student_id TEXT,
  student_name TEXT,
  symptom TEXT,
  time_in TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. เพิ่มคอลัมน์ชื่อภาษาอังกฤษของยา
ALTER TABLE medicines ADD COLUMN IF NOT EXISTS en TEXT;

-- 6. ตารางคำขอจากนักศึกษา/บุคลากร (จองเตียง, ขอยา, แจ้งแพ้ยา, เรียกฉุกเฉิน)
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'รอดำเนินการ',
  requester_email TEXT,
  requester_name TEXT,
  requester_role TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิด Row Level Security (RLS) ให้อ่าน/เขียนได้สำหรับโครงงาน
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access students') THEN
    CREATE POLICY "Allow public access students" ON students FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access medicines') THEN
    CREATE POLICY "Allow public access medicines" ON medicines FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access visits') THEN
    CREATE POLICY "Allow public access visits" ON visits FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access beds') THEN
    CREATE POLICY "Allow public access beds" ON beds FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public access requests') THEN
    CREATE POLICY "Allow public access requests" ON requests FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

// ---------- ซิงค์เตียง/ยาอัตโนมัติ (ให้พอร์ทัลผู้ใช้อ่านข้ามเครื่องได้) ----------
export async function pushBeds(beds: any[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || beds.length === 0) return false;
  try {
    const { error } = await sb.from('beds').upsert(beds.map(b => ({
      id: b.id, name: b.name, status: b.status, student_id: b.studentId || null,
      student_name: b.studentName || null, symptom: b.symptom || null, time_in: b.timeIn || null,
    })));
    if (error) return false;
    const ids = beds.map(b => b.id);
    await sb.from('beds').delete().not('id', 'in', '(' + ids.map(i => '"' + i + '"').join(',') + ')');
    return true;
  } catch { return false; }
}

export async function pushMedicines(meds: any[]): Promise<boolean> {
  const sb = getSupabase();
  if (!sb || meds.length === 0) return false;
  const rows = (withEn: boolean) => meds.map(m => ({
    id: m.id, name: m.name, category: m.category, stock: m.stock, min: m.min, unit: m.unit,
    lot: m.lot, expiry: m.expiry, status: m.status, ...(withEn ? { en: m.en || '' } : {}),
  }));
  try {
    let { error } = await sb.from('medicines').upsert(rows(true));
    if (error) ({ error } = await sb.from('medicines').upsert(rows(false)));
    return !error;
  } catch { return false; }
}

export async function fetchBeds(): Promise<any[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('beds').select('*').order('id');
    if (error || !data || data.length === 0) return null;
    return data.map((b: any) => ({ id: b.id, name: b.name, status: b.status, studentId: b.student_id, studentName: b.student_name, symptom: b.symptom, timeIn: b.time_in }));
  } catch { return null; }
}

export async function fetchMedicines(): Promise<any[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('medicines').select('*').order('id');
    if (error || !data || data.length === 0) return null;
    return data.map((m: any) => ({ id: m.id, name: m.name, en: m.en || '', category: m.category, stock: m.stock, min: m.min, unit: m.unit, lot: m.lot, expiry: m.expiry, status: m.status }));
  } catch { return null; }
}