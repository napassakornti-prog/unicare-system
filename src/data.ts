export const INITIAL_STUDENTS = [
  { 
    id: '66010012', 
    name: 'นายธนกฤต วิทยานุสรณ์', 
    faculty: 'วิศวกรรมศาสตร์', 
    year: 'ชั้นปีที่ 2', 
    blood: 'AB+', 
    phone: '081-234-5678', 
    allergies: ['Penicillin', 'Aspirin'], 
    severeAllergies: true,
    emergencyContact: 'มารดา (089-111-2222)',
    visitsCount: 4
  },
  { 
    id: '65040188', 
    name: 'นางสาวณิชชา วงศ์สวัสดิ์', 
    faculty: 'บริหารธุรกิจ', 
    year: 'ชั้นปีที่ 3', 
    blood: 'O+', 
    phone: '082-987-6543', 
    allergies: ['Sulfa'], 
    severeAllergies: false,
    emergencyContact: 'บิดา (088-333-4444)',
    visitsCount: 2
  },
  { 
    id: '67020045', 
    name: 'นายปพณ ลิขิตวรการ', 
    faculty: 'สถาปัตยกรรมศาสตร์', 
    year: 'ชั้นปีที่ 1', 
    blood: 'B+', 
    phone: '086-555-7788', 
    allergies: [], 
    severeAllergies: false,
    emergencyContact: 'พี่ชาย (087-999-0000)',
    visitsCount: 1
  },
  { 
    id: '64010512', 
    name: 'นางสาวกานต์ดา ศิริโชติ', 
    faculty: 'แพทยศาสตร์', 
    year: 'ชั้นปีที่ 4', 
    blood: 'A+', 
    phone: '084-444-1122', 
    allergies: [], 
    severeAllergies: false,
    emergencyContact: 'มารดา (085-222-3311)',
    visitsCount: 3
  },
  { 
    id: '66030921', 
    name: 'นายภานุวัฒน์ เดชะกุล', 
    faculty: 'วิทยาศาสตร์', 
    year: 'ชั้นปีที่ 2', 
    blood: 'O-', 
    phone: '083-777-8899', 
    allergies: ['Ibuprofen', 'Seafood'], 
    severeAllergies: true,
    emergencyContact: 'มารดา (081-000-1122)',
    visitsCount: 5
  }
];

export const INITIAL_MEDICINES = [
  { id: 'MED-001', name: 'Paracetamol 500mg', category: 'ยารับประทาน', stock: 420, min: 200, unit: 'เม็ด', lot: 'LOT-2026A', expiry: '2027-12-15', status: 'ปกติ' },
  { id: 'MED-002', name: 'Amoxicillin 500mg', category: 'ยารับประทาน', stock: 25, min: 100, unit: 'แคปซูล', lot: 'LOT-2025C', expiry: '2027-08-20', status: 'วิกฤต' },
  { id: 'MED-003', name: 'Ibuprofen 400mg', category: 'ยารับประทาน', stock: 75, min: 150, unit: 'เม็ด', lot: 'LOT-2026B', expiry: '2027-10-10', status: 'เหลือน้อย' },
  { id: 'MED-004', name: 'Chlorpheniramine (CPM) 4mg', category: 'ยารับประทาน', stock: 310, min: 100, unit: 'เม็ด', lot: 'LOT-2026D', expiry: '2028-05-05', status: 'ปกติ' },
  { id: 'MED-005', name: 'Antacid Suspension 240ml', category: 'ยารับประทาน', stock: 12, min: 50, unit: 'ขวด', lot: 'LOT-2025X', expiry: '2026-11-12', status: 'วิกฤต' },
  { id: 'MED-006', name: 'Normal Saline 0.9% 500ml', category: 'เวชภัณฑ์/อุปกรณ์', stock: 55, min: 30, unit: 'ขวด', lot: 'LOT-2026S', expiry: '2028-01-01', status: 'ปกติ' },
  { id: 'MED-007', name: 'Betadine Solution 30ml', category: 'ยาภายนอก/ยาทา', stock: 38, min: 20, unit: 'ขวด', lot: 'LOT-2026T', expiry: '2028-06-18', status: 'ปกติ' },
  { id: 'MED-008', name: 'Alcohol 70% 450ml', category: 'ยาภายนอก/ยาทา', stock: 18, min: 40, unit: 'ขวด', lot: 'LOT-2026AL', expiry: '2028-09-30', status: 'เหลือน้อย' }
];

export const INITIAL_VISITS = [
  { id: 'VST-1004', time: '10:25 น.', studentId: '66010012', studentName: 'นายธนกฤต วิทยานุสรณ์', faculty: 'วิศวกรรมศาสตร์', symptom: 'มีไข้สูง ปวดศีรษะ ไอแห้ง', triage: 'ด่วน', status: 'รอพบพยาบาล', diagnosis: '-', meds: [] },
  { id: 'VST-1003', time: '09:50 น.', studentId: '65040188', studentName: 'นางสาวณิชชา วงศ์สวัสดิ์', faculty: 'บริหารธุรกิจ', symptom: 'ปวดท้องเกร็ง คลื่นไส้', triage: 'ปกติ', status: 'รักษาแล้ว', diagnosis: 'Acute Gastritis', meds: ['Antacid Suspension 240ml'] },
  { id: 'VST-1002', time: '09:15 น.', studentId: '67020045', studentName: 'นายปพณ ลิขิตวรการ', faculty: 'สถาปัตยกรรมศาสตร์', symptom: 'มีแผลถลอกที่ข้อศอกซ้าย (หกล้ม)', triage: 'ปกติ', status: 'รักษาแล้ว', diagnosis: 'Abrasion Wound', meds: ['Betadine Solution 30ml'] },
  { id: 'VST-1001', time: '08:40 น.', studentId: '66030921', studentName: 'นายภานุวัฒน์ เดชะกุล', faculty: 'วิทยาศาสตร์', symptom: 'แน่นหน้าอก หายใจหอบเฉียบพลัน', triage: 'ฉุกเฉิน', status: 'ส่งตัวต่อโรงพยาบาล', diagnosis: 'Severe Asthma Attack', meds: [] },
  { id: 'VST-0998', time: '08:20 น.', studentId: '64010512', studentName: 'นางสาวกานต์ดา ศิริโชติ', faculty: 'แพทยศาสตร์', symptom: 'ปวดศีรษะ ไมเกรน', triage: 'ปกติ', status: 'รักษาแล้ว', diagnosis: 'Migraine', meds: ['Paracetamol 500mg'] },
  { id: 'VST-0997', time: '08:12 น.', studentId: '66010012', studentName: 'นายธนกฤต วิทยานุสรณ์', faculty: 'วิศวกรรมศาสตร์', symptom: 'เจ็บคอ มีน้ำมูก', triage: 'ปกติ', status: 'รักษาแล้ว', diagnosis: 'Common Cold', meds: ['Chlorpheniramine (CPM) 4mg'] },
  { id: 'VST-0996', time: '08:05 น.', studentId: '65040188', studentName: 'นางสาวณิชชา วงศ์สวัสดิ์', faculty: 'บริหารธุรกิจ', symptom: 'มีไข้ ปวดศีรษะ', triage: 'ด่วน', status: 'รักษาแล้ว', diagnosis: 'Fever / URI', meds: ['Paracetamol 500mg'] },
  { id: 'VST-0995', time: '07:55 น.', studentId: '67020045', studentName: 'นายปพณ ลิขิตวรการ', faculty: 'สถาปัตยกรรมศาสตร์', symptom: 'ปวดกล้ามเนื้อ หลัง', triage: 'ปกติ', status: 'รักษาแล้ว', diagnosis: 'Myalgia', meds: ['Paracetamol 500mg'] },
  { id: 'VST-0994', time: '07:48 น.', studentId: '66030921', studentName: 'นายภานุวัฒน์ เดชะกุล', faculty: 'วิทยาศาสตร์', symptom: 'ผื่นคัน ลมพิษ', triage: 'ปกติ', status: 'รักษาแล้ว', diagnosis: 'Urticaria', meds: ['Chlorpheniramine (CPM) 4mg'] },
  { id: 'VST-0993', time: '07:40 น.', studentId: '64010512', studentName: 'นางสาวกานต์ดา ศิริโชติ', faculty: 'แพทยศาสตร์', symptom: 'ท้องเสีย คลื่นไส้', triage: 'ปกติ', status: 'รักษาแล้ว', diagnosis: 'Acute Diarrhea', meds: [] },
  { id: 'VST-0992', time: '07:30 น.', studentId: '66010012', studentName: 'นายธนกฤต วิทยานุสรณ์', faculty: 'วิศวกรรมศาสตร์', symptom: 'มีไข้ ไอ', triage: 'ด่วน', status: 'รักษาแล้ว', diagnosis: 'URI', meds: ['Paracetamol 500mg'] }
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

export const INITIAL_BEDS = [
  { id: 'BED-01', name: 'เตียง 1 (โซนชาย)', status: 'occupied', studentId: '66030921', studentName: 'นายภานุวัฒน์ เดชะกุล', symptom: 'แน่นหน้าอก หอบหืด', timeIn: '08:40 น.' },
  { id: 'BED-02', name: 'เตียง 2 (โซนชาย)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-03', name: 'เตียง 3 (โซนหญิง)', status: 'occupied', studentId: '65040188', studentName: 'นางสาวณิชชา วงศ์สวัสดิ์', symptom: 'ปวดท้องเกร็ง คลื่นไส้', timeIn: '09:50 น.' },
  { id: 'BED-04', name: 'เตียง 4 (โซนหญิง)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-05', name: 'เตียง 5 (สำรองฉุกเฉิน)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null },
  { id: 'BED-06', name: 'เตียง 6 (สำรองฉุกเฉิน)', status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null }
];

