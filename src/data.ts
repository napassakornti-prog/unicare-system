export const USER_ROLES = ['นักศึกษา', 'อาจารย์', 'เจ้าหน้าที่', 'บุคลากร'] as const;

export const STANDARD_FACULTIES = [
  'คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม',
  'คณะวิทยาศาสตร์และเทคโนโลยีสุขภาพ',
  'คณะเทคโนโลยีการเกษตร',
  'คณะบริหารศาสตร์',
  'คณะศิลปศาสตร์',
  'สำนักงานอธิการบดี / หน่วยงานกลาง',
  'อื่นๆ'
];

export const INITIAL_STUDENTS: any[] = [];

export const INITIAL_VISITS: any[] = [];

export const INITIAL_BEDS = [
  { id: 'BED-01', name: 'เตียง 1 (โซนชาย)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-02', name: 'เตียง 2 (โซนชาย)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-03', name: 'เตียง 3 (โซนหญิง)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-04', name: 'เตียง 4 (โซนหญิง)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-05', name: 'เตียง 5 (สำรองฉุกเฉิน)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-06', name: 'เตียง 6 (สำรองฉุกเฉิน)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null }
];

export const INITIAL_MEDICINES = [
  { id: 'MED-001', name: 'Paracetamol 500mg', category: 'ยารับประทาน', stock: 500, min: 100, unit: 'เม็ด', lot: 'LOT-2026A', expiry: '2027-12-15', status: 'ปกติ' },
  { id: 'MED-002', name: 'Amoxicillin 500mg', category: 'ยารับประทาน', stock: 200, min: 50, unit: 'แคปซูล', lot: 'LOT-2026C', expiry: '2027-08-20', status: 'ปกติ' },
  { id: 'MED-003', name: 'Ibuprofen 400mg', category: 'ยารับประทาน', stock: 200, min: 50, unit: 'เม็ด', lot: 'LOT-2026B', expiry: '2027-10-10', status: 'ปกติ' },
  { id: 'MED-004', name: 'Chlorpheniramine (CPM) 4mg', category: 'ยารับประทาน', stock: 300, min: 100, unit: 'เม็ด', lot: 'LOT-2026D', expiry: '2028-05-05', status: 'ปกติ' },
  { id: 'MED-005', name: 'Antacid Suspension 240ml', category: 'ยารับประทาน', stock: 100, min: 30, unit: 'ขวด', lot: 'LOT-2026X', expiry: '2027-11-12', status: 'ปกติ' },
  { id: 'MED-006', name: 'Normal Saline 0.9% 500ml', category: 'เวชภัณฑ์/อุปกรณ์', stock: 100, min: 30, unit: 'ขวด', lot: 'LOT-2026S', expiry: '2028-01-01', status: 'ปกติ' },
  { id: 'MED-007', name: 'Betadine Solution 30ml', category: 'ยาภายนอก/ยาทา', stock: 50, min: 20, unit: 'ขวด', lot: 'LOT-2026T', expiry: '2028-06-18', status: 'ปกติ' },
  { id: 'MED-008', name: 'Alcohol 70% 450ml', category: 'ยาภายนอก/ยาทา', stock: 50, min: 20, unit: 'ขวด', lot: 'LOT-2026AL', expiry: '2028-09-30', status: 'ปกติ' }
];

export const STANDARD_SYMPTOMS = [
  'มีไข้สูง (Fever > 38°C)',
  'ปวดศีรษะ / ไมเกรน (Headache / Migraine)',
  'เจ็บคอ / ไอ / มีน้ำมูก (Sore throat / Cough / Cold)',
  'ปวดท้องเกร็ง / กรดไหลย้อน (Abdominal pain / GERD)',
  'คลื่นไส้ / อาเจียน (Nausea / Vomiting)',
  'ท้องเสีย / ถ่ายเหลว (Diarrhea)',
  'ผื่นคัน / ลมพิษ / ภูมิแพ้ (Rash / Urticaria / Allergy)',
  'แผลถลอก / อุบัติเหตุ (Wound / Abrasion / Injury)',
  'ปวดกล้ามเนื้อ / ออฟฟิศซินโดรม (Myalgia / Office syndrome)',
  'เวียนศีรษะ / หน้ามืด / เป็นลม (Dizziness / Fainting)',
  'แน่นหน้าอก / หอบหืดเฉียบพลัน (Chest tightness / Asthma)'
];

// ชุดข้อมูลสำหรับทดสอบการสาธิตระบบ (Demo Data)
export const DEMO_STUDENTS = [
  { 
    id: '66010012', 
    role: 'นักศึกษา',
    name: 'นายธนกฤต วิทยานุสรณ์', 
    firstName: 'ธนกฤต',
    lastName: 'วิทยานุสรณ์',
    faculty: 'คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม', 
    department: 'วิศวกรรมคอมพิวเตอร์',
    year: 'ชั้นปีที่ 2', 
    blood: 'AB+', 
    phone: '081-234-5678', 
    allergies: ['Penicillin', 'Aspirin'], 
    allergyReaction: 'ผื่นคัน ปากบวม แน่นหน้าอก',
    severeAllergies: true,
    emergencyContact: 'มารดา (089-111-2222)',
    visitsCount: 1
  },
  { 
    id: 'T-1002', 
    role: 'อาจารย์',
    name: 'ผศ.ดร.สมชาย เจริญสุข', 
    firstName: 'สมชาย',
    lastName: 'เจริญสุข',
    faculty: 'คณะวิทยาศาสตร์และเทคโนโลยีสุขภาพ', 
    department: 'วิทยาศาสตร์สุขภาพ',
    blood: 'O+', 
    phone: '082-987-6543', 
    allergies: ['Sulfa'], 
    allergyReaction: 'ลมพิษเฉียบพลัน คลื่นไส้',
    severeAllergies: false,
    emergencyContact: 'ภรรยา (088-333-4444)',
    visitsCount: 1
  },
  { 
    id: 'STF-501', 
    role: 'เจ้าหน้าที่',
    name: 'นางปราณี วงศ์สว่าง', 
    firstName: 'ปราณี',
    lastName: 'วงศ์สว่าง',
    faculty: 'สำนักงานอธิการบดี / หน่วยงานกลาง', 
    department: 'กองบริการการศึกษา',
    blood: 'B+', 
    phone: '086-555-7788', 
    allergies: [], 
    allergyReaction: '',
    severeAllergies: false,
    emergencyContact: 'สามี (087-999-0000)',
    visitsCount: 1
  }
];

export const DEMO_VISITS = [
  { 
    id: 'VST-1001', 
    time: '09:30 น.', 
    patientId: '66010012', 
    studentId: '66010012', 
    studentName: 'นายธนกฤต วิทยานุสรณ์', 
    patientRole: 'นักศึกษา',
    faculty: 'คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม', 
    department: 'วิศวกรรมคอมพิวเตอร์',
    symptom: 'มีไข้สูง, ปวดศีรษะ', 
    triage: 'ด่วน', 
    status: 'นอนพักเตียง', 
    diagnosis: 'Acute URI / Fever', 
    meds: ['Paracetamol 500mg'],
    bedId: 'BED-01',
    allergies: ['Penicillin', 'Aspirin'],
    allergyReaction: 'ผื่นคัน แน่นหน้าอก'
  }
];

export const DEMO_BEDS = [
  { id: 'BED-01', name: 'เตียง 1 (โซนชาย)', status: 'occupied', studentId: '66010012', studentName: 'นายธนกฤต วิทยานุสรณ์', symptom: 'มีไข้สูง, ปวดศีรษะ', timeIn: '09:30 น.' },
  { id: 'BED-02', name: 'เตียง 2 (โซนชาย)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-03', name: 'เตียง 3 (โซนหญิง)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-04', name: 'เตียง 4 (โซนหญิง)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-05', name: 'เตียง 5 (สำรองฉุกเฉิน)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-06', name: 'เตียง 6 (สำรองฉุกเฉิน)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null }
];
