// =====================================================================
// UniCare Local AI Engine (Rule-based, ทำงานในเครื่องทั้งหมด)
// - ไม่ส่งข้อมูลระบุตัวตนผู้ป่วยออกไปยัง AI ภายนอก (PDPA)
// - ผลลัพธ์ทั้งหมดเป็น "ข้อเสนอแนะ" ผู้ตัดสินใจคือเจ้าหน้าที่
// =====================================================================

// ---------- 1) กลุ่มยา สำหรับตรวจการแพ้ยาข้ามกลุ่ม (Cross-reactivity) ----------
export const DRUG_FAMILIES: Record<string, string[]> = {
  'Penicillins': ['penicillin', 'amoxicillin', 'ampicillin', 'cloxacillin', 'dicloxacillin'],
  'NSAIDs': ['ibuprofen', 'aspirin', 'diclofenac', 'naproxen', 'mefenamic', 'piroxicam'],
  'Sulfonamides': ['sulfa', 'sulfamethoxazole', 'co-trimoxazole', 'bactrim'],
  'Antihistamines': ['chlorpheniramine', 'cpm', 'cetirizine', 'loratadine'],
  'Povidone-iodine': ['betadine', 'povidone', 'iodine'],
  'Paracetamol': ['paracetamol', 'acetaminophen'],
};

export const DRUG_FAMILY_OPTIONS = [...Object.keys(DRUG_FAMILIES), 'อื่นๆ / ไม่ทราบกลุ่ม'];

const findFamilies = (text: string) => {
  const t = text.toLowerCase();
  return Object.entries(DRUG_FAMILIES)
    .filter(([family, members]) => t.includes(family.toLowerCase()) || members.some(m => t.includes(m)))
    .map(([family]) => family);
};

/**
 * ตรวจสอบว่ายาที่จะจ่าย ขัดกับประวัติแพ้ยาหรือไม่
 * คืนค่า null ถ้าปลอดภัย หรือ object อธิบายเหตุผลถ้าพบความเสี่ยง
 */
export function checkDrugAllergy(medName: string, allergies: string[] = []) {
  const med = medName.toLowerCase();
  const medFamilies = findFamilies(medName);
  for (const allergy of allergies) {
    const a = allergy.toLowerCase().trim();
    if (!a) continue;
    if (med.includes(a)) {
      return { allergy, type: 'direct', message: `ผู้ป่วยแพ้ "${allergy}" โดยตรง` };
    }
    const allergyFamilies = findFamilies(allergy);
    const shared = medFamilies.filter(f => allergyFamilies.includes(f));
    if (shared.length > 0) {
      return { allergy, type: 'family', message: `ยาอยู่ในกลุ่ม ${shared.join(', ')} เดียวกับ "${allergy}" ที่ผู้ป่วยแพ้ (เสี่ยงแพ้ข้ามกลุ่ม)` };
    }
  }
  return null;
}

// ---------- 2) สถานะสต็อก / วันหมดอายุ ----------
export function getStockStatus(m: { stock: number; min: number }) {
  if (m.stock <= m.min * 0.3) return 'วิกฤต';
  if (m.stock <= m.min) return 'เหลือน้อย';
  return 'ปกติ';
}

export function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / 86400000);
}

// ---------- 3) กฎการจับคู่อาการ ----------
export const SYMPTOM_RULES = [
  { label: 'ไข้ / ติดเชื้อ', keywords: ['ไข้', 'fever'], dx: 'ภาวะไข้ สงสัยติดเชื้อทางเดินหายใจส่วนบน (URI)', meds: ['Paracetamol 500mg'], advice: 'เช็ดตัวลดไข้ ดื่มน้ำมากๆ วัดไข้ซ้ำทุก 4 ชม.' },
  { label: 'ปวดศีรษะ', keywords: ['ปวดศีรษะ', 'ปวดหัว', 'ไมเกรน', 'headache'], dx: 'Tension headache / Migraine', meds: ['Paracetamol 500mg'], advice: 'พักในที่เงียบ แสงน้อย หลีกเลี่ยงหน้าจอ' },
  { label: 'เจ็บคอ / ไอ / หวัด', keywords: ['เจ็บคอ', 'ไอ', 'น้ำมูก', 'cough', 'cold'], dx: 'Common cold / Pharyngitis', meds: ['Chlorpheniramine (CPM) 4mg', 'Paracetamol 500mg'], advice: 'ดื่มน้ำอุ่น สวมหน้ากากอนามัย พักผ่อนให้เพียงพอ' },
  { label: 'ปวดท้อง / กรดไหลย้อน', keywords: ['ปวดท้อง', 'กรดไหลย้อน', 'gerd', 'abdominal'], dx: 'Dyspepsia / Acute gastritis', meds: ['Antacid Suspension 240ml'], advice: 'ทานอาหารอ่อน ตรงเวลา งดอาหารรสจัด' },
  { label: 'คลื่นไส้ / อาเจียน', keywords: ['คลื่นไส้', 'อาเจียน', 'nausea'], dx: 'Nausea / Gastroenteritis', meds: ['Antacid Suspension 240ml'], advice: 'จิบน้ำทีละน้อย สังเกตภาวะขาดน้ำ' },
  { label: 'ท้องเสีย', keywords: ['ท้องเสีย', 'ถ่ายเหลว', 'diarrhea'], dx: 'Acute diarrhea', meds: [], advice: 'ดื่มสารละลายเกลือแร่ (ORS) หากถ่ายเป็นมูกเลือดให้ส่งต่อ' },
  { label: 'ผื่น / ภูมิแพ้', keywords: ['ผื่น', 'ลมพิษ', 'ภูมิแพ้', 'rash', 'allergy'], dx: 'Urticaria / Allergic reaction', meds: ['Chlorpheniramine (CPM) 4mg'], advice: 'หลีกเลี่ยงสิ่งกระตุ้น สังเกตอาการปากบวม หายใจลำบาก' },
  { label: 'แผล / อุบัติเหตุ', keywords: ['แผล', 'อุบัติเหตุ', 'หกล้ม', 'wound', 'injury'], dx: 'Abrasion wound', meds: ['Normal Saline 0.9% 500ml', 'Betadine Solution 30ml'], advice: 'ล้างแผลด้วย NSS ทำแผลวันละ 1-2 ครั้ง ระวังแผลโดนน้ำ' },
  { label: 'ปวดกล้ามเนื้อ', keywords: ['ปวดกล้ามเนื้อ', 'ออฟฟิศซินโดรม', 'ปวดหลัง', 'myalgia'], dx: 'Myalgia / Office syndrome', meds: ['Ibuprofen 400mg'], advice: 'ประคบร้อน ยืดเหยียดกล้ามเนื้อ ปรับท่านั่ง' },
  { label: 'เวียนศีรษะ / เป็นลม', keywords: ['เวียนศีรษะ', 'หน้ามืด', 'เป็นลม', 'dizziness'], dx: 'Dizziness / Vasovagal syncope', meds: [], advice: 'นอนพักยกขาสูง วัดความดันโลหิตและน้ำตาลในเลือด' },
  { label: 'แน่นหน้าอก / หอบหืด', keywords: ['แน่นหน้าอก', 'หอบ', 'asthma', 'chest'], dx: 'Chest tightness / Asthma exacerbation (ต้องประเมินโดยบุคลากรทันที)', meds: [], advice: 'ให้ผู้ป่วยนั่งพัก เตรียมออกซิเจน พิจารณาส่งต่อโรงพยาบาลทันที', redFlag: true },
];

export function categorizeSymptoms(text: string) {
  const t = (text || '').toLowerCase();
  return SYMPTOM_RULES.filter(r => r.keywords.some(k => t.includes(k.toLowerCase())));
}

// ---------- 4) AI ซักประวัติอาการ (Symptom Interview) ----------
export const INTERVIEW_QUESTIONS = [
  { id: 'duration', q: 'มีอาการมานานเท่าไรแล้ว?', options: ['น้อยกว่า 1 วัน', '1–3 วัน', 'มากกว่า 3 วัน'] },
  { id: 'temp', q: 'อุณหภูมิร่างกายที่วัดได้?', options: ['ไม่มีไข้ (< 37.5°C)', '37.5–38.9°C', '≥ 39°C'] },
  { id: 'pain', q: 'ระดับความเจ็บปวด (Pain score 0–10)?', options: ['0–3 เล็กน้อย', '4–6 ปานกลาง', '7–10 รุนแรง'] },
  { id: 'breath', q: 'มีอาการหายใจลำบาก หรือแน่นหน้าอกร่วมด้วยหรือไม่?', options: ['ไม่มี', 'มีเล็กน้อย', 'มีชัดเจน'] },
  { id: 'conscious', q: 'ระดับความรู้สึกตัวของผู้ป่วย?', options: ['รู้สึกตัวดี', 'ซึม / อ่อนเพลียมาก', 'สับสน / เกือบหมดสติ'] },
];

export function assessTriage(answers: Record<string, string>, symptoms: string[] = []) {
  const reasons: string[] = [];
  const rules = categorizeSymptoms(symptoms.join(' '));
  let level: 'ปกติ' | 'ด่วน' | 'ฉุกเฉิน' = 'ปกติ';

  if (answers.breath === 'มีชัดเจน') reasons.push('หายใจลำบาก/แน่นหน้าอกชัดเจน');
  if (answers.conscious === 'สับสน / เกือบหมดสติ') reasons.push('ระดับความรู้สึกตัวลดลง');
  if (rules.some(r => r.redFlag) && answers.breath !== 'ไม่มี') reasons.push('มีอาการกลุ่มเสี่ยง (แน่นหน้าอก/หอบ)');
  if (reasons.length > 0) return { level: 'ฉุกเฉิน' as const, reasons };

  if (answers.temp === '≥ 39°C') reasons.push('ไข้สูง ≥ 39°C');
  if (answers.pain === '7–10 รุนแรง') reasons.push('ปวดรุนแรง');
  if (answers.breath === 'มีเล็กน้อย') reasons.push('หายใจลำบากเล็กน้อย');
  if (answers.conscious === 'ซึม / อ่อนเพลียมาก') reasons.push('ซึม/อ่อนเพลียมาก');
  if (answers.duration === 'มากกว่า 3 วัน' && answers.temp !== 'ไม่มีไข้ (< 37.5°C)') reasons.push('มีไข้ต่อเนื่องเกิน 3 วัน');
  if (reasons.length > 0) level = 'ด่วน';
  else reasons.push('ไม่พบสัญญาณอันตราย');
  return { level, reasons };
}

// ---------- 5) PII Shield: ลบข้อมูลระบุตัวตนก่อนประมวลผล ----------
export function anonymizeText(text: string) {
  return (text || '')
    .replace(/\b\d{8,10}\b/g, '[รหัสถูกลบ]')
    .replace(/0\d{1,2}-?\d{3}-?\d{4}/g, '[เบอร์โทรถูกลบ]')
    .replace(/(นาย|นางสาว|นาง|น\.ส\.)\s*\S+(\s+\S+)?/g, '[ชื่อถูกลบ]');
}

// ---------- 6) วิเคราะห์อาการ + แนะนำยา (กรองยาที่แพ้/หมดสต็อก) ----------
export function analyzeSymptoms(params: {
  symptoms: string[];
  note: string;
  allergies: string[];
  medicines: any[];
  answers?: Record<string, string>;
}) {
  const { symptoms, note, allergies, medicines, answers = {} } = params;
  const safeNote = anonymizeText(note);
  const rules = categorizeSymptoms([...symptoms, safeNote].join(' '));

  const medNames = Array.from(new Set(rules.flatMap(r => r.meds)));
  const suggestedMeds = medNames.map(name => {
    const med = medicines.find(m => m.name === name);
    const allergy = checkDrugAllergy(name, allergies);
    return {
      name,
      allergy,
      outOfStock: !med || med.stock <= 0,
      stock: med ? med.stock : 0,
      unit: med ? med.unit : '',
    };
  });

  const triage = Object.keys(answers).length > 0 ? assessTriage(answers, symptoms) : null;

  // payload ที่ "จะส่ง" ให้ AI (แสดงให้เห็นว่าไม่มีข้อมูลระบุตัวตน)
  const anonymizedPayload = {
    symptoms: symptoms.map(s => s.split(' (')[0]),
    note: safeNote || '-',
    allergyFlags: allergies.length,
    interview: answers,
  };

  return {
    diagnoses: rules.length ? rules.map(r => r.dx) : ['ข้อมูลไม่เพียงพอสำหรับการจัดกลุ่มอาการ — โปรดประเมินเพิ่มเติม'],
    advice: rules.length ? rules.map(r => r.advice) : ['สังเกตอาการ และซักประวัติเพิ่มเติม'],
    redFlag: rules.some(r => r.redFlag),
    suggestedMeds,
    triage,
    anonymizedPayload,
  };
}

// ---------- 7) สถิติ ----------
export function computeStats(visits: any[], students: any[]) {
  const countBy = (arr: string[]) =>
    Object.entries(arr.reduce((acc: Record<string, number>, k) => { acc[k] = (acc[k] || 0) + 1; return acc; }, {}))
      .sort((a, b) => b[1] - a[1]);

  const symptomCounts = countBy(visits.flatMap(v => categorizeSymptoms(v.symptom).map(r => r.label)));
  const facultyCounts = countBy(visits.map(v => v.faculty));
  const triageCounts = countBy(visits.map(v => v.triage));
  const hourCounts = countBy(visits.map(v => {
    const h = parseInt((v.time || '').split(':')[0], 10);
    return isNaN(h) ? 'ไม่ระบุ' : `${String(h).padStart(2, '0')}:00`;
  })).sort((a, b) => a[0].localeCompare(b[0]));
  const medCounts = countBy(visits.flatMap(v => v.meds || []));
  const allergenCounts = countBy(students.flatMap(s => s.allergies || []));

  return { total: visits.length, symptomCounts, facultyCounts, triageCounts, hourCounts, medCounts, allergenCounts };
}

// ---------- 8) AI Assistant: ตอบคำถามจากข้อมูลในระบบ ----------
export const SUGGESTED_QUESTIONS = [
  'สรุปสถิติวันนี้',
  'ยาอะไรใกล้หมดบ้าง',
  'ยาใกล้หมดอายุ',
  'เตียงว่างกี่เตียง',
  'อาการที่พบบ่อยที่สุด',
  'คณะไหนมาใช้บริการมากสุด',
  'สถิติการแพ้ยา',
];

export function answerQuestion(question: string, ctx: { students: any[]; medicines: any[]; visits: any[]; beds: any[] }) {
  const q = question.toLowerCase().trim();
  const { students, medicines, visits, beds } = ctx;
  const stats = computeStats(visits, students);
  const has = (...words: string[]) => words.some(w => q.includes(w));

  // --- ป้องกันการขอข้อมูลระบุตัวตน (PDPA) ---
  if (/\d{8}/.test(q) || has('เบอร์', 'โทร', 'ที่อยู่', 'ชื่ออะไร', 'ใครบ้าง', 'ชื่อใคร', 'ผู้ป่วยคนไหน')) {
    return '🔒 ขออภัย AI Assistant ไม่สามารถเปิดเผยข้อมูลระบุตัวตนรายบุคคล (ชื่อ รหัส เบอร์โทร) ได้ตามนโยบาย PDPA\n\nหากต้องการดูประวัติรายบุคคล กรุณาใช้เมนู "ข้อมูลนักศึกษา & แพ้ยา" ซึ่งต้องใช้สิทธิ์เจ้าหน้าที่';
  }

  // --- ขอให้แนะนำยา ---
  if (has('ควรจ่าย', 'แนะนำยา', 'กินยาอะไร', 'ใช้ยาอะไร')) {
    const rules = categorizeSymptoms(q);
    const lines = rules.length
      ? rules.map(r => `• ${r.label}: ${r.meds.length ? r.meds.join(', ') : 'ไม่แนะนำยา — ' + r.advice}`).join('\n')
      : '• ยังไม่พบอาการที่ระบุในคำถาม ลองระบุอาการ เช่น "มีไข้ ควรจ่ายยาอะไร"';
    return `💊 ข้อเสนอแนะเบื้องต้นตามแนวทางห้องพยาบาล:\n${lines}\n\n⚠️ นี่เป็นเพียง "ข้อเสนอแนะ" ผู้ตัดสินใจจ่ายยาคือพยาบาล/เจ้าหน้าที่ และต้องตรวจสอบประวัติแพ้ยาก่อนทุกครั้ง (ใช้หน้า "บันทึกเข้าใช้บริการ" เพื่อให้ระบบตรวจแพ้ยาอัตโนมัติ)`;
  }

  // --- หมดอายุ ---
  if (has('หมดอายุ', 'expire', 'exp')) {
    const soon = medicines
      .map(m => ({ ...m, days: daysUntil(m.expiry) }))
      .filter(m => m.days <= 90)
      .sort((a, b) => a.days - b.days);
    if (!soon.length) return '✅ ไม่มียาที่จะหมดอายุภายใน 90 วัน';
    return `⏰ ยาที่หมดอายุแล้ว/จะหมดอายุภายใน 90 วัน (${soon.length} รายการ):\n` +
      soon.map(m => `• ${m.name} (${m.lot}) — ${m.days < 0 ? 'หมดอายุแล้ว' : `อีก ${m.days} วัน`} (${m.expiry})`).join('\n') +
      '\n\nแนะนำ: นำยาล็อตนี้ออกใช้ก่อน (FEFO) หรือแยกเก็บเพื่อทำลาย';
  }

  // --- สต็อก ---
  if (has('สต็อก', 'stock', 'ใกล้หมด', 'สั่งซื้อ', 'เหลือน้อย', 'ขาด')) {
    const low = medicines.filter(m => m.stock <= m.min).sort((a, b) => a.stock / a.min - b.stock / b.min);
    if (!low.length) return '✅ สต็อกยาทุกรายการอยู่ในระดับปกติ';
    return `⚠️ ยาที่ต่ำกว่าจุดสั่งซื้อ (${low.length} รายการ):\n` +
      low.map(m => `• ${m.name}: เหลือ ${m.stock}/${m.min} ${m.unit} [${getStockStatus(m)}] → แนะนำสั่งเพิ่ม ${m.min * 2 - m.stock} ${m.unit}`).join('\n');
  }

  // --- เตียง ---
  if (has('เตียง', 'bed', 'นอนพัก')) {
    const free = beds.filter(b => b.status === 'available');
    const used = beds.filter(b => b.status === 'occupied');
    return `🛏️ เตียงว่าง ${free.length}/${beds.length} เตียง\n` +
      (free.length ? `ว่าง: ${free.map(b => b.name).join(', ')}\n` : 'ไม่มีเตียงว่าง — พิจารณาจำหน่ายผู้ป่วยที่อาการดีขึ้น\n') +
      (used.length ? `ใช้งานอยู่: ${used.map(b => `${b.name} (${b.symptom}, เข้า ${b.timeIn})`).join(', ')}` : '');
  }

  // --- แพ้ยา ---
  if (has('แพ้ยา', 'แพ้', 'allergy')) {
    const withAllergy = students.filter(s => s.allergies.length > 0).length;
    const severe = students.filter(s => s.severeAllergies).length;
    return `🛡️ สถิติการแพ้ยา (ข้อมูลรวม ไม่ระบุตัวตน):\n• นักศึกษาที่มีประวัติแพ้ยา ${withAllergy}/${students.length} คน\n• แพ้รุนแรง (Anaphylaxis risk) ${severe} คน\n• สารที่แพ้บ่อย: ${stats.allergenCounts.slice(0, 5).map(([k, v]) => `${k} (${v})`).join(', ') || '-'}`;
  }

  // --- อาการ ---
  if (has('อาการ', 'โรค', 'พบบ่อย', 'symptom')) {
    return `🩺 กลุ่มอาการที่พบบ่อย:\n` + stats.symptomCounts.slice(0, 5).map(([k, v], i) => `${i + 1}. ${k} — ${v} ครั้ง`).join('\n');
  }

  // --- คณะ ---
  if (has('คณะ', 'faculty')) {
    return `🏫 จำนวนผู้ใช้บริการแยกตามคณะ:\n` + stats.facultyCounts.map(([k, v]) => `• ${k}: ${v} ครั้ง`).join('\n');
  }

  // --- ฉุกเฉิน / ส่งต่อ ---
  if (has('ฉุกเฉิน', 'ส่งต่อ', 'โรงพยาบาล', 'ด่วน', 'triage')) {
    return `🚑 ระดับความเร่งด่วน:\n` + stats.triageCounts.map(([k, v]) => `• ${k}: ${v} ราย`).join('\n') +
      `\n• ส่งต่อโรงพยาบาล: ${visits.filter(v => v.status.includes('ส่งตัว')).length} ราย`;
  }

  // --- ชื่อยาเฉพาะ ---
  const med = medicines.find(m => q.includes(m.name.toLowerCase().split(' ')[0]));
  if (med) {
    return `💊 ${med.name}\n• คงเหลือ ${med.stock} ${med.unit} (จุดสั่งซื้อ ${med.min})\n• สถานะ: ${getStockStatus(med)}\n• Lot ${med.lot} หมดอายุ ${med.expiry} (อีก ${daysUntil(med.expiry)} วัน)`;
  }

  // --- สรุปภาพรวม ---
  if (has('สรุป', 'สถิติ', 'วันนี้', 'กี่คน', 'ภาพรวม', 'รายงาน')) {
    const low = medicines.filter(m => m.stock <= m.min).length;
    return `📊 สรุปภาพรวมวันนี้:\n• ผู้รับบริการ ${stats.total} ครั้ง\n• ความเร่งด่วน: ${stats.triageCounts.map(([k, v]) => `${k} ${v}`).join(' / ')}\n• อาการพบบ่อย: ${stats.symptomCounts.slice(0, 3).map(([k]) => k).join(', ')}\n• ช่วงเวลาคนเยอะสุด: ${[...stats.hourCounts].sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}\n• เตียงว่าง ${beds.filter(b => b.status === 'available').length}/${beds.length}\n• ยาต่ำกว่าจุดสั่งซื้อ ${low} รายการ`;
  }

  return 'ขออภัย ยังไม่เข้าใจคำถาม 🙏 ลองถามเกี่ยวกับ:\n• สรุปสถิติวันนี้\n• ยาอะไรใกล้หมด / ยาใกล้หมดอายุ\n• เตียงว่างกี่เตียง\n• อาการที่พบบ่อย / คณะที่มาใช้บริการ\n• สถิติการแพ้ยา\n• "มีไข้ ควรจ่ายยาอะไร" (ข้อเสนอแนะ)';
}
