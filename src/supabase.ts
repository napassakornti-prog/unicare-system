import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEY_URL = 'unicare_supabase_url';
const STORAGE_KEY_KEY = 'unicare_supabase_anon_key';

export function getSupabaseConfig(): { url: string; key: string } {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';
  const savedUrl = localStorage.getItem(STORAGE_KEY_URL) || '';
  const savedKey = localStorage.getItem(STORAGE_KEY_KEY) || '';
  return {
    url: savedUrl || envUrl,
    key: savedKey || envKey
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

-- เปิด Row Level Security (RLS) ให้อ่าน/เขียนได้สำหรับโครงงาน
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE beds ENABLE ROW LEVEL SECURITY;

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
END $$;
`;
