import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, ClipboardPlus, Pill, Upload, Users, BarChart3, Bot, Settings, Activity,
  AlertTriangle, Search, CheckCircle2, AlertCircle, X, Plus, Bed, ShieldCheck,
  FileSpreadsheet as SheetIcon, Sun, Moon, Sparkles, ShieldAlert, RefreshCw, ChevronRight,
  GraduationCap, MessageCircleQuestion, LogOut, Trash2, Clock, RotateCcw, Database,
  UserCheck, Briefcase, Award, HeartHandshake, Check, Bell, Send, Cloud, Copy,
  ArrowRight, ArrowLeft, Stethoscope, User, Lock, ExternalLink
} from 'lucide-react';
import { 
  INITIAL_STUDENTS, INITIAL_MEDICINES, INITIAL_VISITS, STANDARD_SYMPTOMS, 
  INITIAL_BEDS, STANDARD_FACULTIES, USER_ROLES, DEMO_STUDENTS, DEMO_VISITS, DEMO_BEDS,
  MEDICINE_CATEGORIES, MEDICINE_UNITS
} from './data';
import { 
  analyzeSymptoms, checkDrugAllergy, getStockStatus, daysUntil, 
  INTERVIEW_QUESTIONS, assessTriage, DRUG_FAMILY_OPTIONS, answerQuestion 
} from './ai';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
  syncLocalToSupabase,
  SUPABASE_SCHEMA_SQL
} from './supabase';
import AiChat from './components/AiChat';
import Reports from './components/Reports';
import StudentPortal from './components/StudentPortal';

// Key สำหรับเก็บบันทึกลงฐานข้อมูลใน Browser (Local Storage Database)
const DB_KEYS = {
  VISITS: 'unicare_db_v2_visits',
  STUDENTS: 'unicare_db_v2_students',
  BEDS: 'unicare_db_v2_beds',
  MEDICINES: 'unicare_db_v3_medicines',
  PORTAL_ROLE: 'unicare_portal_role'
};

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // ---------- โหมดการเข้าใช้งาน (Role-Based Access / Routing) ----------
  // 'landing' = หน้าแรกเลือกสิทธิ์, 'staff' = สำหรับเจ้าหน้าที่พยาบาล (Admin), 'student' = สำหรับนักศึกษา/บุคลากร
  const [portalMode, setPortalMode] = useState<'landing' | 'staff' | 'student'>(() => {
    const path = window.location.pathname.toLowerCase();
    const search = window.location.search.toLowerCase();
    if (path.includes('admin') || search.includes('role=admin')) return 'staff';
    if (path.includes('portal') || search.includes('role=student') || search.includes('role=portal')) return 'student';
    const saved = localStorage.getItem(DB_KEYS.PORTAL_ROLE);
    if (saved === 'staff' || saved === 'student') return saved;
    return 'landing'; // เริ่มต้นที่หน้าเลือกสิทธิ์ เพื่อความชัดเจนในการนำเสนอ
  });

  const switchPortal = (mode: 'landing' | 'staff' | 'student') => {
    setPortalMode(mode);
    localStorage.setItem(DB_KEYS.PORTAL_ROLE, mode);
    if (mode === 'staff') {
      window.history.pushState({}, '', '/admin');
    } else if (mode === 'student') {
      window.history.pushState({}, '', '/portal');
    } else {
      window.history.pushState({}, '', '/');
    }
  };
  
  // ---------- 1) ฐานข้อมูลระบบ (Database State with LocalStorage Persistence) ----------
  const [visits, setVisits] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(DB_KEYS.VISITS);
      return saved !== null ? JSON.parse(saved) : INITIAL_VISITS;
    } catch {
      return INITIAL_VISITS;
    }
  });

  const [beds, setBeds] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(DB_KEYS.BEDS);
      return saved !== null ? JSON.parse(saved) : INITIAL_BEDS;
    } catch {
      return INITIAL_BEDS;
    }
  });

  const [students, setStudents] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(DB_KEYS.STUDENTS);
      return saved !== null ? JSON.parse(saved) : INITIAL_STUDENTS;
    } catch {
      return INITIAL_STUDENTS;
    }
  });

  const [medicines, setMedicines] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem(DB_KEYS.MEDICINES);
      return saved !== null ? JSON.parse(saved) : INITIAL_MEDICINES;
    } catch {
      return INITIAL_MEDICINES;
    }
  });

  // ซิงค์บันทึกลงในฐานข้อมูลอัตโนมัติเมื่อมีการเปลี่ยนแปลง
  useEffect(() => {
    try { localStorage.setItem(DB_KEYS.VISITS, JSON.stringify(visits)); } catch {}
  }, [visits]);

  useEffect(() => {
    try { localStorage.setItem(DB_KEYS.BEDS, JSON.stringify(beds)); } catch {}
  }, [beds]);

  useEffect(() => {
    try { localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(students)); } catch {}
  }, [students]);

  useEffect(() => {
    try { localStorage.setItem(DB_KEYS.MEDICINES, JSON.stringify(medicines)); } catch {}
  }, [medicines]);

  // ---------- Supabase Database Configuration ----------
  const [supabaseUrl, setSupabaseUrl] = useState(() => getSupabaseConfig().url);
  const [supabaseKey, setSupabaseKey] = useState(() => getSupabaseConfig().key);
  const [supabaseStatus, setSupabaseStatus] = useState<string>('disconnected');
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);

  useEffect(() => {
    const conf = getSupabaseConfig();
    if (conf.url && conf.key) {
      testSupabaseConnection().then(res => {
        setSupabaseStatus(res.success ? 'connected' : 'disconnected');
      });
    }
  }, []);

  // ---------- 2) ฟอร์มบันทึกเข้าใช้บริการ (Visit Record Form State) ----------
  const [patientRole, setPatientRole] = useState<'นักศึกษา' | 'อาจารย์' | 'เจ้าหน้าที่' | 'บุคลากร'>('นักศึกษา');
  const [patientId, setPatientId] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [faculty, setFaculty] = useState(STANDARD_FACULTIES[0]);
  const [customFaculty, setCustomFaculty] = useState('');
  const [department, setDepartment] = useState('');
  const [patientYear, setPatientYear] = useState('ชั้นปีที่ 1');
  const [bloodGroup, setBloodGroup] = useState('ไม่ระบุ');
  const [phoneNumber, setPhoneNumber] = useState('');

  // ประวัติการแพ้ยา และอาการที่แพ้
  const [patientAllergies, setPatientAllergies] = useState<string[]>([]);
  const [allergyInputText, setAllergyInputText] = useState('');
  const [allergyReactionText, setAllergyReactionText] = useState('');

  // การเลือกเตียงพักฟื้น (ว่าง/ไม่ว่าง)
  const [assignedBedId, setAssignedBedId] = useState('');

  // การจ่ายยา + ระบบตรวจสอบการแพ้ยาอัตโนมัติ
  const [dispenseMedId, setDispenseMedId] = useState('');
  const [dispenseQty, setDispenseQty] = useState(1);
  const [dispenseList, setDispenseList] = useState<any[]>([]);
  const [allergyBlock, setAllergyBlock] = useState<any>(null);

  // อาการและการวินิจฉัย
  const [selectedStandardSymptoms, setSelectedStandardSymptoms] = useState<string[]>([]);
  const [customSymptomNote, setCustomSymptomNote] = useState('');
  const [triageLevel, setTriageLevel] = useState('ปกติ');
  const [diagnosisInput, setDiagnosisInput] = useState('');

  // AI ซักประวัติอาการ (Interactive Triage)
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewStep, setInterviewStep] = useState(0);
  const [interviewAnswers, setInterviewAnswers] = useState<Record<string, string>>({});
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);

  // Modals & UI States
  const [showPatientSearchModal, setShowPatientSearchModal] = useState(false);
  const [patientSearchInput, setPatientSearchInput] = useState('');
  const [bedManagementModal, setBedManagementModal] = useState(false);
  const [allergyModalStudent, setAllergyModalStudent] = useState<any>(null);
  const [newAllergyData, setNewAllergyData] = useState({
    drugName: '',
    drugFamily: DRUG_FAMILY_OPTIONS[0],
    reaction: 'ผื่นคัน แน่นหน้าอก คลื่นไส้',
    severity: 'รุนแรงมาก (Anaphylaxis Risk)'
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [studentFilterRole, setStudentFilterRole] = useState<string>('ทั้งหมด');

  // Floating AI Assistant Popup (มุมขวาล่างสำหรับถาม AI ขณะซักประวัติผู้ป่วย)
  const [showAiPopup, setShowAiPopup] = useState(false);
  const [popupMessages, setPopupMessages] = useState<Array<{ role: 'ai' | 'user'; text: string }>>([
    {
      role: 'ai',
      text: 'สวัสดีครับ ผมคือ UniCare AI Assistant 🤖\nพร้อมช่วยแนะนำแนวทางซักถามอาการคนไข้, แนะนำคำถามเพิ่มเติม, และตรวจสอบความปลอดภัยด้านยาระหว่างซักถามคนไข้ครับ',
    },
  ]);
  const [popupInput, setPopupInput] = useState('');
  const [popupTyping, setPopupTyping] = useState(false);
  const popupBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showAiPopup) {
      popupBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [popupMessages, popupTyping, showAiPopup]);

  const sendPopupMessage = (text: string) => {
    const q = text.trim();
    if (!q || popupTyping) return;
    setPopupMessages(prev => [...prev, { role: 'user', text: q }]);
    setPopupInput('');
    setPopupTyping(true);
    setTimeout(() => {
      const reply = answerQuestion(q, { students, medicines, visits, beds });
      setPopupMessages(prev => [...prev, { role: 'ai', text: reply }]);
      setPopupTyping(false);
    }, 350);
  };

  // ฟังก์ชันแจ้งเตือน (ส่งเข้าไอคอนกระดิ่ง Bell มุมขวาบนเท่านั้น ไม่แสดง Pop-up ลอยให้รกหน้าจอ)
  const addToast = (title: string, message: string, type = 'success') => {
    const id = Date.now() + Math.random();
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} น.`;
    setNotifications(prev => [{ id, title, message, type, time: timeStr, read: false }, ...prev].slice(0, 50));
  };

  const unreadNotifCount = notifications.filter(n => !n.read).length;

  const markAllNotifsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // รีเซ็ตแบบฟอร์มการรับบริการ
  const resetVisitForm = () => {
    setPatientRole('นักศึกษา');
    setPatientId('');
    setFirstName('');
    setLastName('');
    setFaculty(STANDARD_FACULTIES[0]);
    setCustomFaculty('');
    setDepartment('');
    setPatientYear('ชั้นปีที่ 1');
    setBloodGroup('ไม่ระบุ');
    setPhoneNumber('');
    setPatientAllergies([]);
    setAllergyInputText('');
    setAllergyReactionText('');
    setAssignedBedId('');
    setSelectedStandardSymptoms([]);
    setCustomSymptomNote('');
    setAiSuggestion(null);
    setDispenseList([]);
    setDispenseMedId('');
    setDispenseQty(1);
    setAllergyBlock(null);
    setTriageLevel('ปกติ');
    setDiagnosisInput('');
    setInterviewAnswers({});
  };

  // จัดการแท็กยาที่แพ้
  const addAllergyTag = (drug: string) => {
    const trimmed = drug.trim();
    if (!trimmed) return;
    if (!patientAllergies.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      setPatientAllergies(prev => [...prev, trimmed]);
    }
    setAllergyInputText('');
  };

  const removeAllergyTag = (drug: string) => {
    setPatientAllergies(prev => prev.filter(a => a !== drug));
  };

  // Auto-fill ข้อมูลจากฐานข้อมูลเมื่อค้นพบรหัสเดิม
  const autoFillPatient = (p: any) => {
    setPatientRole(p.role || 'นักศึกษา');
    setPatientId(p.id);
    const parts = (p.name || '').split(' ');
    setFirstName(p.firstName || parts[0] || '');
    setLastName(p.lastName || parts.slice(1).join(' ') || '');
    if (STANDARD_FACULTIES.includes(p.faculty)) {
      setFaculty(p.faculty);
      setCustomFaculty('');
    } else {
      setFaculty('อื่นๆ');
      setCustomFaculty(p.faculty || '');
    }
    setDepartment(p.department || '');
    if (p.year) setPatientYear(p.year);
    if (p.blood) setBloodGroup(p.blood);
    if (p.phone) setPhoneNumber(p.phone);
    setPatientAllergies(p.allergies || []);
    setAllergyReactionText(p.allergyReaction || '');
    addToast('ดึงข้อมูลสำเร็จ', `โหลดข้อมูลประวัติของ ${p.name} (${p.id}) เรียบร้อย`);
    if ((p.allergies || []).length > 0) {
      addToast('⚠️ ผู้ป่วยมีประวัติแพ้ยา', `แพ้: ${p.allergies.join(', ')}`, 'warning');
    }
  };

  const loadStudentById = (id: string) => {
    const target = students.find(s => s.id.toLowerCase() === id.trim().toLowerCase());
    if (!target) {
      addToast('ไม่พบข้อมูลในฐานข้อมูล', `รหัส ${id} ยังไม่เคยลงทะเบียน สามารถกรอกข้อมูลใหม่ได้ทันที`, 'info');
      setPatientId(id.trim());
      setShowPatientSearchModal(false);
      setPatientSearchInput('');
      setActiveTab('visit-record');
      return;
    }
    autoFillPatient(target);
    setShowPatientSearchModal(false);
    setPatientSearchInput('');
    setActiveTab('visit-record');
  };

  // เพิ่มยาลงในรายการจ่าย พร้อมระบบตรวจสอบการแพ้ยา (Allergy & Cross-reactivity Check)
  const addMedToDispense = (medIdentifier: string, qty = 1) => {
    const med = medicines.find(m => m.name === medIdentifier || m.id === medIdentifier);
    if (!med) return;

    // ตรวจสอบการแพ้ยากับประวัติยาที่แพ้ของผู้ป่วยทันที
    const conflict = checkDrugAllergy(med.name, patientAllergies);
    if (conflict) {
      setAllergyBlock({ med: med.name, ...conflict });
      addToast('🚨 ระงับการจ่ายยา', `${med.name}: ${conflict.message}`, 'error');
      return;
    }

    const alreadyInList = dispenseList.find(d => d.id === med.id)?.qty || 0;
    if (alreadyInList + qty > med.stock) {
      addToast('สต็อกไม่เพียงพอ', `${med.name} คงเหลือในคลัง ${med.stock} ${med.unit}`, 'error');
      return;
    }

    setDispenseList(prev => prev.some(d => d.id === med.id)
      ? prev.map(d => d.id === med.id ? { ...d, qty: d.qty + qty } : d)
      : [...prev, { id: med.id, name: med.name, unit: med.unit, qty }]);
    setAllergyBlock(null);
  };

  // บันทึกข้อมูลการรักษา จ่ายยา จัดการเตียง และบันทึกลงในฐานข้อมูล (Database Save)
  const handleSaveVisit = () => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName) {
      addToast('ยังไม่ได้ระบุชื่อผู้รับบริการ', 'กรุณากรอกชื่อและนามสกุลของผู้ป่วยก่อนบันทึก', 'warning');
      return;
    }
    if (selectedStandardSymptoms.length === 0 && !customSymptomNote.trim()) {
      addToast('ยังไม่ได้ระบุอาการ', 'กรุณาเลือกอาการมาตรฐานอย่างน้อย 1 รายการ หรือพิมพ์หมายเหตุอาการ', 'warning');
      return;
    }

    // ตรวจสอบความปลอดภัยด้านยาซ้ำอีกครั้งก่อนบันทึก (Double Check)
    const unsafeMed = dispenseList.find(d => checkDrugAllergy(d.name, patientAllergies));
    if (unsafeMed) {
      addToast('🚨 ไม่สามารถบันทึกได้', `${unsafeMed.name} ขัดแย้งกับประวัติการแพ้ยาของผู้ป่วย`, 'error');
      return;
    }

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`;
    const symptomText = [...selectedStandardSymptoms.map(s => s.split(' (')[0]), customSymptomNote.trim()].filter(Boolean).join(', ');
    const bed = beds.find(b => b.id === assignedBedId);
    const status = bed ? 'นอนพักเตียง' : triageLevel === 'ฉุกเฉิน' ? 'ส่งตัวต่อโรงพยาบาล' : 'รักษาแล้ว';
    const finalFaculty = faculty === 'อื่นๆ' ? (customFaculty.trim() || 'อื่นๆ') : faculty;
    const finalId = patientId.trim() || (patientRole === 'นักศึกษา' ? `STD-${Date.now().toString().slice(-6)}` : `STF-${Date.now().toString().slice(-4)}`);

    const nextNum = visits.length > 0
      ? Math.max(...visits.map(v => parseInt((v.id || '').replace('VST-', ''), 10) || 0)) + 1
      : 1001;

    const newVisitRecord = {
      id: `VST-${nextNum}`,
      time,
      patientId: finalId,
      studentId: finalId,
      studentName: fullName,
      patientRole,
      faculty: finalFaculty,
      department: department.trim(),
      symptom: symptomText,
      triage: triageLevel,
      status,
      diagnosis: diagnosisInput.trim() || '-',
      meds: dispenseList.map(d => d.name),
      bedId: bed?.id || null,
      allergies: patientAllergies,
      allergyReaction: allergyReactionText.trim()
    };

    // 1. เพิ่มรายการเข้ารับบริการลงฐานข้อมูล visits
    const updatedVisits = [newVisitRecord, ...visits];
    setVisits(updatedVisits);

    // 2. ตัดสต็อกยาในคลังยา medicines
    const lowAfter: string[] = [];
    const updatedMeds = medicines.map(m => {
      const dispensed = dispenseList.find(x => x.id === m.id);
      if (!dispensed) return m;
      const newStock = m.stock - dispensed.qty;
      if (newStock <= m.min) lowAfter.push(`${m.name} (เหลือ ${newStock})`);
      return { ...m, stock: newStock, status: getStockStatus({ stock: newStock, min: m.min }) };
    });
    setMedicines(updatedMeds);

    // 3. จัดการสถานะเตียง (หากมีการเลือกเตียงพักฟื้น)
    let updatedBeds = beds;
    if (bed) {
      updatedBeds = beds.map(b => b.id === bed.id ? {
        ...b,
        status: 'occupied',
        studentId: finalId,
        studentName: fullName,
        symptom: symptomText,
        timeIn: time,
      } : b);
      setBeds(updatedBeds);
    }

    // 4. บันทึก/อัปเดตประวัติผู้ป่วยลงทะเบียนฐานข้อมูล
    let updatedStudents: any[];
    const existingIndex = students.findIndex(s => s.id === finalId);
    if (existingIndex >= 0) {
      updatedStudents = students.map((s, idx) => idx === existingIndex ? {
        ...s,
        name: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: patientRole,
        faculty: finalFaculty,
        department: department.trim(),
        year: patientRole === 'นักศึกษา' ? patientYear : undefined,
        blood: bloodGroup !== 'ไม่ระบุ' ? bloodGroup : s.blood,
        phone: phoneNumber.trim() || s.phone,
        allergies: Array.from(new Set([...s.allergies, ...patientAllergies])),
        allergyReaction: allergyReactionText.trim() || s.allergyReaction,
        visitsCount: (s.visitsCount || 0) + 1,
      } : s);
    } else {
      const newPatient = {
        id: finalId,
        name: fullName,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role: patientRole,
        faculty: finalFaculty,
        department: department.trim(),
        year: patientRole === 'นักศึกษา' ? patientYear : undefined,
        blood: bloodGroup,
        phone: phoneNumber.trim(),
        allergies: patientAllergies,
        allergyReaction: allergyReactionText.trim(),
        severeAllergies: patientAllergies.length > 0,
        emergencyContact: '',
        visitsCount: 1,
      };
      updatedStudents = [newPatient, ...students];
    }
    setStudents(updatedStudents);

    // 5. บันทึกลง LocalStorage Database
    try {
      localStorage.setItem(DB_KEYS.VISITS, JSON.stringify(updatedVisits));
      localStorage.setItem(DB_KEYS.MEDICINES, JSON.stringify(updatedMeds));
      localStorage.setItem(DB_KEYS.BEDS, JSON.stringify(updatedBeds));
      localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(updatedStudents));
    } catch (err) {
      console.error('Storage save error', err);
    }

    // ถ้าเชื่อมต่อ Supabase ไว้ ให้ซิงค์ขึ้น Cloud ด้วย
    if (supabaseStatus === 'connected') {
      syncLocalToSupabase({
        students: updatedStudents,
        medicines: updatedMeds,
        visits: updatedVisits,
        beds: updatedBeds
      }).then(res => {
        if (res.success) {
          console.log('Auto-synced to Supabase Cloud');
        }
      });
    }

    addToast(
      '💾 บันทึกลงฐานข้อมูลสำเร็จ',
      `บันทึก ${newVisitRecord.id} • ${fullName} (${patientRole})${dispenseList.length ? ` • จ่ายยา ${dispenseList.length} รายการ` : ''}${bed ? ` • ${bed.name}` : ''}`
    );
    if (lowAfter.length) addToast('⚠️ แจ้งเตือนสต็อกยา', `ต่ำกว่าจุดสั่งซื้อ: ${lowAfter.join(', ')}`, 'warning');
    resetVisitForm();
  };

  // จำหน่ายผู้ป่วย / คืนเตียงว่าง
  const handleDischarge = (bedId: string) => {
    const targetBed = beds.find(b => b.id === bedId);
    if (!targetBed) return;
    const updated = beds.map(b => b.id === bedId ? {
      ...b, status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null
    } : b);
    setBeds(updated);
    setVisits(prev => prev.map(v => (v.studentId === targetBed.studentId && v.status === 'นอนพักเตียง') ? {
      ...v, status: 'รักษาแล้ว (จำหน่ายจากเตียง)'
    } : v));
    try { localStorage.setItem(DB_KEYS.BEDS, JSON.stringify(updated)); } catch {}
    addToast('จำหน่ายผู้ป่วยสำเร็จ', `${targetBed.name} ว่างพร้อมใช้งานแล้ว`);
  };

  // รีเซ็ตข้อมูลเป็น 0 ทั้งหมด (Reset All Data to 0)
  const handleResetAllToZero = () => {
    if (window.confirm('ยืนยันต้องการรีเซ็ตข้อมูลทั้งหมดเป็น 0 หรือไม่?\n\n- ยอดผู้เข้ารับบริการจะกลายเป็น 0\n- เตียงพักฟื้นจะว่างทั้งหมด 6 เตียง\n- ล้างประวัติการรักษาทั้งหมด')) {
      const cleanBeds = INITIAL_BEDS.map(b => ({ ...b, status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null }));
      setVisits([]);
      setStudents([]);
      setBeds(cleanBeds);
      setMedicines(INITIAL_MEDICINES);
      try {
        localStorage.setItem(DB_KEYS.VISITS, JSON.stringify([]));
        localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify([]));
        localStorage.setItem(DB_KEYS.BEDS, JSON.stringify(cleanBeds));
        localStorage.setItem(DB_KEYS.MEDICINES, JSON.stringify(INITIAL_MEDICINES));
      } catch {}
      resetVisitForm();
      addToast('รีเซ็ตข้อมูลสำเร็จ', 'ข้อมูลระบบถูกรีเซ็ตเป็น 0 ทั้งหมดเรียบร้อยแล้ว', 'info');
    }
  };

  // โหลดข้อมูลตัวอย่างสำหรับการสาธิต (Load Demo Data)
  const handleLoadDemo = () => {
    setVisits(DEMO_VISITS);
    setStudents(DEMO_STUDENTS);
    setBeds(DEMO_BEDS);
    try {
      localStorage.setItem(DB_KEYS.VISITS, JSON.stringify(DEMO_VISITS));
      localStorage.setItem(DB_KEYS.STUDENTS, JSON.stringify(DEMO_STUDENTS));
      localStorage.setItem(DB_KEYS.BEDS, JSON.stringify(DEMO_BEDS));
    } catch {}
    resetVisitForm();
    addToast('โหลดข้อมูลตัวอย่างสำเร็จ', 'นำเข้าชุดข้อมูลสาธิตสำหรับทดสอบระบบเรียบร้อย');
  };

  // AI Symptom Checker Execution
  const handleRunAiSymptomChecker = (answers = interviewAnswers) => {
    if (selectedStandardSymptoms.length === 0 && !customSymptomNote) {
      addToast('กรุณาระบุอาการ', 'เลือกอาการมาตรฐานอย่างน้อย 1 รายการเพื่อวิเคราะห์', 'warning');
      return;
    }
    setAiAnalyzing(true);
    setTimeout(() => {
      const result = analyzeSymptoms({
        symptoms: selectedStandardSymptoms,
        note: customSymptomNote,
        allergies: patientAllergies,
        medicines,
        answers,
      });
      setAiAnalyzing(false);
      setAiSuggestion(result);
      if (result.triage) setTriageLevel(result.triage.level);
      else if (result.redFlag) setTriageLevel('ฉุกเฉิน');
      if (!diagnosisInput && result.diagnoses.length > 0) setDiagnosisInput(result.diagnoses[0]);
      addToast('AI วิเคราะห์อาการสำเร็จ', 'แสดงข้อเสนอแนะการวินิจฉัยและยาที่ปลอดภัย');
    }, 800);
  };

  const startInterview = () => {
    if (selectedStandardSymptoms.length === 0 && !customSymptomNote) {
      addToast('กรุณาระบุอาการก่อน', 'เลือกอาการมาตรฐานอย่างน้อย 1 รายการ แล้ว AI จะซักถามเพิ่มเติม', 'warning');
      return;
    }
    setInterviewAnswers({});
    setInterviewStep(0);
    setInterviewOpen(true);
  };

  const answerInterview = (qid: string, option: string) => {
    const next = { ...interviewAnswers, [qid]: option };
    setInterviewAnswers(next);
    if (interviewStep + 1 < INTERVIEW_QUESTIONS.length) {
      setInterviewStep(interviewStep + 1);
    } else {
      setInterviewStep(INTERVIEW_QUESTIONS.length);
    }
  };

  // การลงทะเบียนแพ้ยาจาก Modal
  const handleRegisterAllergy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allergyModalStudent || !newAllergyData.drugName) return;
    const isSevere = newAllergyData.severity.includes('รุนแรงมาก');
    setStudents(prev => prev.map(s => {
      if (s.id !== allergyModalStudent.id) return s;
      return {
        ...s,
        allergies: Array.from(new Set([...s.allergies, newAllergyData.drugName])),
        allergyReaction: newAllergyData.reaction,
        allergyDetails: [...(s.allergyDetails || []), { ...newAllergyData, verified: true, source: 'staff' }],
        severeAllergies: isSevere || s.severeAllergies,
      };
    }));
    addToast('ลงทะเบียนประวัติแพ้ยาสำเร็จ', `เพิ่มประวัติแพ้ยา ${newAllergyData.drugName} ให้กับ ${allergyModalStudent.name}`);
    setAllergyModalStudent(null);
    setNewAllergyData({ drugName: '', drugFamily: DRUG_FAMILY_OPTIONS[0], reaction: 'ผื่นคัน แน่นหน้าอก', severity: 'รุนแรงมาก (Anaphylaxis Risk)' });
  };

  // Supabase Handlers
  const handleSaveSupabaseConfig = async () => {
    saveSupabaseConfig(supabaseUrl, supabaseKey);
    setIsTestingSupabase(true);
    const res = await testSupabaseConnection();
    setIsTestingSupabase(false);
    setSupabaseStatus(res.success ? 'connected' : 'disconnected');
    if (res.success) {
      addToast('เชื่อมต่อ Supabase สำเร็จ', 'ระบบเชื่อมต่อกับฐานข้อมูลคลาวด์ PostgreSQL เรียบร้อยแล้ว');
    } else {
      addToast('แจ้งเตือนการเชื่อมต่อ', res.message, 'warning');
    }
  };

  const handleSyncToSupabase = async () => {
    setIsSyncingSupabase(true);
    const res = await syncLocalToSupabase({ students, medicines, visits, beds });
    setIsSyncingSupabase(false);
    if (res.success) {
      addToast('ซิงค์ข้อมูลสำเร็จ', res.message);
    } else {
      addToast('ซิงค์ข้อมูลไม่สำเร็จ', res.message, 'error');
    }
  };

  // ---------- Inventory (สต็อกยา) ----------
  const [invSearch, setInvSearch] = useState('');
  const [invCategory, setInvCategory] = useState('ทั้งหมด');
  const [invFilter, setInvFilter] = useState<'all' | 'low' | 'expiring'>('all');
  const [restockMed, setRestockMed] = useState<any>(null);
  const [restockQty, setRestockQty] = useState('');
  const [restockLot, setRestockLot] = useState('');
  const [restockExpiry, setRestockExpiry] = useState('');
  const [medFormOpen, setMedFormOpen] = useState(false);
  const emptyNewMed = { name: '', category: MEDICINE_CATEGORIES[0], unit: MEDICINE_UNITS[0], stock: '0', min: '20', lot: '', expiry: '' };
  const [newMed, setNewMed] = useState(emptyNewMed);

  const handleConfirmRestock = () => {
    const qty = parseInt(restockQty);
    if (!restockMed || !qty || qty <= 0) {
      addToast('จำนวนไม่ถูกต้อง', 'กรุณาระบุจำนวนที่ต้องการเติมให้มากกว่า 0', 'warning');
      return;
    }
    setMedicines(prev => prev.map(m => {
      if (m.id !== restockMed.id) return m;
      const stock = m.stock + qty;
      return {
        ...m,
        stock,
        lot: restockLot.trim() || m.lot,
        expiry: restockExpiry || m.expiry,
        status: getStockStatus({ stock, min: m.min }),
      };
    }));
    addToast('เติมสต็อกสำเร็จ', `เพิ่ม ${restockMed.name} จำนวน ${qty} ${restockMed.unit} (รวมเป็น ${restockMed.stock + qty} ${restockMed.unit})`);
    setRestockMed(null);
  };

  const handleAddMedicine = () => {
    const name = newMed.name.trim();
    if (!name) {
      addToast('กรุณากรอกชื่อยา', 'ต้องระบุชื่อยาภาษาไทยก่อนบันทึก', 'warning');
      return;
    }
    if (medicines.some(m => m.name === name)) {
      addToast('มีรายการยานี้แล้ว', 'ชื่อยานี้อยู่ในระบบแล้ว ให้ใช้ปุ่มเติมสต็อกแทน', 'warning');
      return;
    }
    const maxNo = medicines.reduce((mx, m) => Math.max(mx, parseInt(String(m.id).replace(/\D/g, '')) || 0), 0);
    const id = `MED-${String(maxNo + 1).padStart(3, '0')}`;
    const stock = Math.max(parseInt(newMed.stock) || 0, 0);
    const min = Math.max(parseInt(newMed.min) || 1, 1);
    const item = {
      id, name, category: newMed.category, unit: newMed.unit, stock, min,
      lot: newMed.lot.trim() || `LOT-${new Date().getFullYear()}-${String(maxNo + 1).padStart(3, '0')}`,
      expiry: newMed.expiry || `${new Date().getFullYear() + 2}-12-31`,
      status: getStockStatus({ stock, min }),
    };
    setMedicines(prev => [...prev, item]);
    addToast('เพิ่มรายการยาสำเร็จ', `เพิ่ม ${name} เข้าคลังยาเรียบร้อย`);
    setNewMed(emptyNewMed);
    setMedFormOpen(false);
  };

  const handleCopySqlSchema = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    addToast('คัดลอก SQL Script แล้ว', 'นำคำสั่งนี้ไปวางในหน้า SQL Editor ของ Supabase เพื่อสร้างตารางได้ทันที');
  };

  // ค่าสถิติและตัวแปรคำนวณ
  const availableBedsCount = beds.filter(b => b.status === 'available').length;
  const lowStockMeds = medicines.filter(m => m.stock <= m.min);
  const pendingAllergyCount = students.reduce((n, s) => n + (s.allergyDetails || []).filter((d: any) => !d.verified).length, 0);

  // เมนูนำทางด้านซ้าย
  const navItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard, category: 'หลัก' },
    { id: 'visit-record', label: 'บันทึกเข้าใช้บริการ', icon: ClipboardPlus, category: 'หลัก' },
    { id: 'inventory', label: 'สต็อกยา & เวชภัณฑ์', icon: Pill, category: 'หลัก', badge: lowStockMeds.length },
    { id: 'data-import', label: 'นำเข้าข้อมูล', icon: Upload, category: 'ข้อมูล' },
    { id: 'students', label: 'ทะเบียนผู้ป่วย & แพ้ยา', icon: Users, category: 'ข้อมูล', badge: pendingAllergyCount },
    { id: 'reports', label: 'รายงาน & สถิติ', icon: BarChart3, category: 'ข้อมูล' },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Bot, category: 'ระบบ', highlight: true },
    { id: 'settings', label: 'ตั้งค่า & ฐานข้อมูล', icon: Settings, category: 'ระบบ' },
  ];

  const theme = {
    bg: darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800',
    sidebar: darkMode ? 'bg-slate-900/90 border-slate-800/80' : 'bg-white border-slate-200/80 shadow-sm',
    sidebarHeader: darkMode ? 'border-slate-800/80' : 'border-slate-200/80',
    header: darkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white/80 border-slate-200/80 shadow-sm',
    card: darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm shadow-slate-200/40',
    cardInner: darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200/80',
    subText: darkMode ? 'text-slate-400' : 'text-slate-500',
    heading: darkMode ? 'text-white' : 'text-slate-900',
    inputBg: darkMode ? 'bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400',
    tableHeader: darkMode ? 'border-slate-800 text-slate-400' : 'border-slate-200 text-slate-500 bg-slate-50/50',
    modalBg: darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xl',
  };

  // =========================================================================
  // VIEW A: LANDING / PORTAL ENTRANCE SCREEN (หน้าเลือกสิทธิ์การเข้าใช้งาน)
  // =========================================================================
  if (portalMode === 'landing') {
    return (
      <div className={`min-h-screen flex flex-col justify-between transition-colors duration-300 ${theme.bg}`}>
        {/* Landing Topbar */}
        <header className="p-6 flex items-center justify-between max-w-7xl mx-auto w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/25 font-bold">
              <Activity size={24} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xl font-black tracking-tight ${theme.heading}`}>UniCare</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">v2.0</span>
              </div>
              <p className={`text-xs ${theme.subText}`}>ระบบบริหารจัดการห้องพยาบาลอัจฉริยะ มหาวิทยาลัยกาฬสินธุ์</p>
            </div>
          </div>

          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
              darkMode 
                ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' 
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
            }`}
            title="สลับโหมดมืด/สว่าง"
          >
            {darkMode ? <Sun size={18} className="text-amber-400" /> : <Moon size={18} className="text-indigo-600" />}
          </button>
        </header>

        {/* Landing Hero Content */}
        <main className="max-w-5xl mx-auto px-6 py-8 flex-1 flex flex-col justify-center items-center text-center">
          <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 mb-4 inline-flex items-center gap-1.5">
            <Sparkles size={14} /> ระบบคัดกรองอาการและตรวจสอบการแพ้ยาอัตโนมัติ
          </span>
          <h1 className={`text-3xl sm:text-4xl md:text-5xl font-black tracking-tight max-w-3xl leading-tight ${theme.heading}`}>
            ยินดีต้อนรับสู่ระบบห้องพยาบาล <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-600 to-emerald-500">UniCare</span>
          </h1>
          <p className={`text-sm sm:text-base mt-3 max-w-2xl ${theme.subText}`}>
            Smart Infirmary Management System • ปลอดภัยตามมาตรฐาน PDPA • เฝ้าระวังความปลอดภัยด้านยา
          </p>

          {/* TWO MAIN ROLE ENTRANCE CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mt-10 text-left">
            
            {/* Card 1: สำหรับเจ้าหน้าที่พยาบาล (Staff & Admin Portal) */}
            <div 
              onClick={() => switchPortal('staff')}
              className={`p-8 rounded-3xl border shadow-xl hover:shadow-2xl transition-all cursor-pointer group hover:-translate-y-1 relative overflow-hidden flex flex-col justify-between ${theme.card} border-teal-500/30 hover:border-teal-500`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-500/30 group-hover:scale-105 transition-transform">
                    <Stethoscope size={28} />
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                    สำหรับ: พยาบาล / ผู้ดูแลระบบ
                  </span>
                </div>

                <div>
                  <h3 className={`text-xl font-black ${theme.heading} group-hover:text-teal-600 transition-colors`}>
                    พอร์ทัลเจ้าหน้าที่พยาบาล (Nursing Staff)
                  </h3>
                  <p className={`text-xs mt-1 leading-relaxed ${theme.subText}`}>
                    เข้าสู่แดชบอร์ดบริหารห้องพยาบาล บันทึกการรักษา จ่ายยา ตรวจสอบการแพ้ยา จัดการเตียง และรายงานสถิติ
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <li className="flex items-center gap-2">✓ แดชบอร์ดสรุปสถิติ & สต็อกยาเรียลไทม์</li>
                  <li className="flex items-center gap-2">✓ บันทึกการรักษา & ตรวจสอบแพ้ยาข้ามกลุ่ม</li>
                  <li className="flex items-center gap-2">✓ ผังเตียงพักฟื้น 6 เตียง & ตัดสต็อกยาอัตโนมัติ</li>
                  <li className="flex items-center gap-2">✓ รองรับฐานข้อมูล Supabase Cloud & LocalDB</li>
                </ul>
              </div>

              <div className="pt-6">
                <button 
                  className="w-full py-3.5 rounded-2xl bg-teal-600 group-hover:bg-teal-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 transition-all"
                >
                  <span>เข้าสู่ระบบห้องพยาบาล (Staff Portal)</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {/* Card 2: สำหรับนักศึกษาและบุคลากร (Student & Personnel Portal) */}
            <div 
              onClick={() => switchPortal('student')}
              className={`p-8 rounded-3xl border shadow-xl hover:shadow-2xl transition-all cursor-pointer group hover:-translate-y-1 relative overflow-hidden flex flex-col justify-between ${theme.card} border-emerald-500/30 hover:border-emerald-500`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition-transform">
                    <GraduationCap size={28} />
                  </div>
                  <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                    สำหรับ: นักศึกษา / บุคลากร
                  </span>
                </div>

                <div>
                  <h3 className={`text-xl font-black ${theme.heading} group-hover:text-emerald-600 transition-colors`}>
                    พอร์ทัลนักศึกษาและบุคลากร (Student Portal)
                  </h3>
                  <p className={`text-xs mt-1 leading-relaxed ${theme.subText}`}>
                    เข้าสู่พอร์ทัลผู้รับบริการ บัตรประจำตัวสุขภาพดิจิทัล แจ้งประวัติการแพ้ยาด้วยตนเอง และตรวจสอบเตียงว่าง
                  </p>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <li className="flex items-center gap-2">✓ บัตรประจำตัวสุขภาพดิจิทัล (Digital Health Card)</li>
                  <li className="flex items-center gap-2">✓ แจ้งประวัติการแพ้ยาด้วยตนเองล่วงหน้า</li>
                  <li className="flex items-center gap-2">✓ ตรวจสอบประวัติการเข้ารับบริการของตนเอง</li>
                  <li className="flex items-center gap-2">✓ ดูสถานะเตียงว่างในห้องพยาบาลแบบเรียลไทม์</li>
                </ul>
              </div>

              <div className="pt-6">
                <button 
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all"
                >
                  <span>เข้าสู่พอร์ทัลผู้รับบริการ (User Portal)</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

          </div>
        </main>

        {/* Landing Footer */}
        <footer className="p-6 text-center text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800">
          <p>โครงงานปริญญานิพนธ์ สาขาวิชาวิศวกรรมคอมพิวเตอร์ คณะวิศวกรรมศาสตร์และเทคโนโลยีอุตสาหกรรม มหาวิทยาลัยกาฬสินธุ์</p>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: STUDENT / USER PORTAL (มุมมองนักศึกษาและบุคลากร)
  // =========================================================================
  if (portalMode === 'student') {
    return (
      <div className={`min-h-screen flex flex-col transition-colors duration-300 ${theme.bg}`}>
        {/* Student Mode Topbar */}
        <header className={`h-16 border-b px-6 flex items-center justify-between backdrop-blur-md ${theme.header}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-md font-bold">
              <GraduationCap size={20} />
            </div>
            <div>
              <span className={`font-black text-sm tracking-tight ${theme.heading}`}>UniCare Student Portal</span>
              <p className={`text-[10px] ${theme.subText}`}>พอร์ทัลนักศึกษาและบุคลากร</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border text-xs font-semibold ${
                darkMode ? 'bg-slate-900 border-slate-800 text-amber-400' : 'bg-white border-slate-200 text-slate-700'
              }`}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <button
              onClick={() => switchPortal('staff')}
              className="px-3 py-1.5 rounded-xl border border-teal-500/30 text-teal-600 dark:text-teal-400 text-xs font-semibold hover:bg-teal-500/10 transition-colors"
            >
              สำหรับเจ้าหน้าที่พยาบาล →
            </button>
            <button
              onClick={() => switchPortal('landing')}
              className={`text-xs px-3 py-1.5 rounded-xl border ${theme.subText} hover:text-rose-500 transition-colors`}
            >
              กลับหน้าเลือกสิทธิ์
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
          <StudentPortal 
            students={students} 
            beds={beds}
            visits={visits}
            theme={theme} 
            onDeclare={(id: string, data: any) => {
              setStudents(prev => prev.map(s => s.id === id ? {
                ...s,
                allergies: Array.from(new Set([...s.allergies, data.drugName])),
                allergyReaction: data.reaction,
                allergyDetails: [...(s.allergyDetails || []), { ...data, verified: false, source: 'student' }]
              } : s));
              addToast('ส่งข้อมูลแพ้ยาแล้ว', `บันทึก ${data.drugName} รอยืนยันโดยเจ้าหน้าที่`);
            }} 
            addToast={addToast}
            onExitPortal={() => switchPortal('landing')}
          />
        </main>
      </div>
    );
  }

  // =========================================================================
  // VIEW C: NURSING STAFF & ADMIN DASHBOARD (มุมมองเจ้าหน้าที่ห้องพยาบาล)
  // =========================================================================
  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${theme.bg}`}>

      {/* SIDEBAR NAVIGATION */}
      <aside className={`w-64 border-r flex flex-col shrink-0 z-20 backdrop-blur-md transition-colors duration-300 ${theme.sidebar}`}>
        <div className={`h-20 flex items-center px-6 border-b justify-between ${theme.sidebarHeader}`}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 font-bold">
              <Activity size={22} className="stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className={`text-lg font-bold tracking-tight ${theme.heading}`}>UniCare</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30">Admin</span>
              </div>
              <p className={`text-[11px] ${theme.subText}`}>ระบบห้องพยาบาล ม.กาฬสินธุ์</p>
            </div>
          </div>
        </div>

        {/* Menu Navigation */}
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive 
                    ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' 
                    : darkMode 
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' 
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon size={18} className={isActive ? 'text-white' : item.highlight ? 'text-teal-500' : ''} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-white text-teal-700' : 'bg-rose-500 text-white'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={handleResetAllToZero}
              title="รีเซ็ตข้อมูลทั้งหมดให้เป็น 0"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-all"
            >
              <RotateCcw size={14} />
              <span>รีเซ็ตเป็น 0</span>
            </button>
            <button
              onClick={handleLoadDemo}
              title="โหลดชุดข้อมูลตัวอย่างสำหรับสาธิต"
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-teal-500/30 text-teal-600 dark:text-teal-400 hover:bg-teal-500/10 text-xs font-semibold transition-all"
            >
              <Database size={14} />
              <span>ข้อมูลตัวอย่าง</span>
            </button>
          </div>
          <p className={`text-[10px] text-center ${theme.subText}`}>UniCare v2.0 • วิศวกรรมคอมพิวเตอร์ มกส.</p>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER BAR */}
        <header className={`h-20 border-b flex items-center justify-between px-8 z-10 backdrop-blur-md transition-colors duration-300 ${theme.header}`}>
          <div className="flex items-center gap-4">
            <h2 className={`font-black text-xl tracking-tight capitalize ${theme.heading}`}>
              {navItems.find(n => n.id === activeTab)?.label || 'ห้องพยาบาล'}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* ปุ่มดูสถานะเตียงว่าง */}
            <button
              onClick={() => setBedManagementModal(true)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                availableBedsCount > 0 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              <Bed size={16} />
              <span>เตียงว่าง: <strong className="font-bold">{availableBedsCount}/{beds.length}</strong></span>
            </button>

            {/* ไอคอนแจ้งเตือน (Notification Bell) */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifPanel(!showNotifPanel); if (!showNotifPanel) markAllNotifsRead(); }}
                className={`relative p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                  darkMode 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
                }`}
                title="แจ้งเตือน"
              >
                <Bell size={16} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-rose-500 text-white text-[10px] font-black border-2 border-white dark:border-slate-900 animate-bounce">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifPanel && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowNotifPanel(false)} />
                  <div className={`absolute right-0 top-12 z-40 w-80 max-h-96 rounded-2xl border shadow-2xl overflow-hidden ${theme.modalBg}`}>
                    <div className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <span className={`text-xs font-bold ${theme.heading}`}>🔔 แจ้งเตือน ({notifications.length})</span>
                      <div className="flex gap-2">
                        {notifications.length > 0 && (
                          <button onClick={clearNotifications} className="text-[10px] text-rose-500 hover:underline font-semibold">ล้างทั้งหมด</button>
                        )}
                        <button onClick={() => setShowNotifPanel(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-72 custom-scrollbar">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center">
                          <Bell size={28} className={`mx-auto mb-2 ${theme.subText}`} />
                          <p className={`text-xs ${theme.subText}`}>ยังไม่มีการแจ้งเตือน</p>
                        </div>
                      ) : (
                        notifications.map(n => (
                          <div key={n.id} className={`px-4 py-3 border-b last:border-b-0 text-xs transition-colors ${
                            !n.read 
                              ? darkMode ? 'bg-teal-500/5 border-slate-800' : 'bg-teal-50/50 border-slate-100' 
                              : darkMode ? 'border-slate-800' : 'border-slate-100'
                          }`}>
                            <div className="flex items-start gap-2.5">
                              <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${
                                n.type === 'error' ? 'bg-rose-500' : n.type === 'warning' ? 'bg-amber-500' : n.type === 'info' ? 'bg-indigo-500' : 'bg-emerald-500'
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className={`font-bold leading-tight ${theme.heading}`}>{n.title}</p>
                                <p className={`mt-0.5 ${theme.subText} leading-snug`}>{n.message}</p>
                              </div>
                              <span className={`text-[10px] font-mono shrink-0 ${theme.subText}`}>{n.time}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Dark / Light Mode */}
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                darkMode 
                  ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
              }`}
              title="สลับโหมดมืด/สว่าง"
            >
              {darkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
            </button>

            {/* ปุ่มกลับหน้าเลือกสิทธิ์ (Landing) */}
            <button
              onClick={() => switchPortal('landing')}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
              } hover:text-rose-500`}
              title="ออกจากระบบ / กลับหน้าเลือกสิทธิ์"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* MAIN BODY VIEWS */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          
          {/* VIEW 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 max-w-7xl mx-auto">
              {/* Banner */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-900 to-emerald-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/20 shrink-0">
                    <ShieldCheck size={26} className="text-teal-300" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">UniCare Intelligent Nursing System — มหาวิทยาลัยกาฬสินธุ์</h4>
                    <p className="text-xs text-teal-200 mt-0.5">
                      ระบบบันทึกข้อมูลแบบเรียลไทม์ • ตรวจสอบการแพ้ยาและแพ้ข้ามกลุ่มอัตโนมัติ • ปลอดภัยตามมาตรฐาน PDPA
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => { resetVisitForm(); setActiveTab('visit-record'); }} 
                    className="px-4 py-2 rounded-xl bg-white text-teal-900 font-bold text-xs hover:bg-teal-50 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <Plus size={14} /> เพิ่มข้อมูลการรักษา
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                <div className={`p-5 rounded-2xl transition-all ${theme.card}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wider ${theme.subText}`}>ผู้รับบริการวันนี้</p>
                      <h3 className={`text-3xl font-black mt-2 tracking-tight ${theme.heading}`}>{visits.length} <span className={`text-sm font-normal ${theme.subText}`}>ครั้ง</span></h3>
                    </div>
                    <div className="p-3 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                      <Users size={22} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <span>ฉุกเฉิน {visits.filter(v => v.triage === 'ฉุกเฉิน').length} • ด่วน {visits.filter(v => v.triage === 'ด่วน').length} ราย</span>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl transition-all ${theme.card}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wider ${theme.subText}`}>เตียงพักฟื้นว่าง</p>
                      <h3 className={`text-3xl font-black mt-2 tracking-tight ${theme.heading}`}>{availableBedsCount} <span className={`text-sm font-normal ${theme.subText}`}>/ {beds.length} เตียง</span></h3>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Bed size={22} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-teal-600 dark:text-teal-400 font-medium">
                    <span>{beds.filter(b => b.status === 'occupied').length} เตียงกำลังใช้งานอยู่</span>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl transition-all ${theme.card}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wider ${theme.subText}`}>ยาใกล้หมดสต็อก</p>
                      <h3 className={`text-3xl font-black mt-2 tracking-tight ${theme.heading}`}>{lowStockMeds.length} <span className={`text-sm font-normal ${theme.subText}`}>รายการ</span></h3>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={22} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                    <span className="truncate">{lowStockMeds.length ? `ต้องสั่งซื้อ: ${lowStockMeds.map(m => m.name.split(' ')[0]).join(', ')}` : 'สต็อกทุกรายการปกติ'}</span>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl transition-all ${theme.card}`}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className={`text-xs font-semibold uppercase tracking-wider ${theme.subText}`}>ผู้มีประวัติแพ้ยา</p>
                      <h3 className={`text-3xl font-black mt-2 tracking-tight ${theme.heading}`}>
                        {students.filter(s => (s.allergies || []).length > 0).length} <span className={`text-sm font-normal ${theme.subText}`}>คน</span>
                      </h3>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      <ShieldAlert size={22} />
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    <span>เฝ้าระวังความปลอดภัยด้านยาในระบบ</span>
                  </div>
                </div>
              </div>

              {/* Live Bed Board */}
              <div className={`rounded-2xl border p-6 ${theme.card}`}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className={`font-bold text-base ${theme.heading}`}>ผังเตียงพักฟื้น (เรียลไทม์)</h3>
                    <p className={`text-xs mt-0.5 ${theme.subText}`}>ว่าง {availableBedsCount} จาก {beds.length} เตียง — จัดสรรเตียงได้ในหน้าบันทึกเข้าใช้บริการ</p>
                  </div>
                  <button onClick={() => setBedManagementModal(true)} className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                    จัดการเตียง <ChevronRight size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {beds.map(b => (
                    <div key={b.id} className={`p-3 rounded-xl border text-xs transition-all ${b.status === 'occupied' ? 'bg-rose-500/5 border-rose-500/30' : 'bg-emerald-500/5 border-emerald-500/30'}`}>
                      <div className="flex items-center justify-between">
                        <Bed size={16} className={b.status === 'occupied' ? 'text-rose-500' : 'text-emerald-500'} />
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${b.status === 'occupied' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'}`}>
                          {b.status === 'occupied' ? 'ไม่ว่าง' : 'ว่าง'}
                        </span>
                      </div>
                      <p className={`font-semibold mt-1.5 truncate ${theme.heading}`}>{b.name}</p>
                      {b.status === 'occupied' ? (
                        <div className="mt-1 text-[11px] space-y-0.5">
                          <p className="font-bold text-rose-600 dark:text-rose-400 truncate">{b.studentName}</p>
                          <p className={`truncate text-[10px] ${theme.subText}`}>{b.symptom}</p>
                        </div>
                      ) : (
                        <p className={`mt-1 text-[10px] ${theme.subText}`}>พร้อมรับผู้ป่วย</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Visits Table */}
              <div className={`rounded-2xl border p-6 ${theme.card}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className={`font-bold text-base ${theme.heading}`}>รายการผู้รับบริการล่าสุด</h3>
                    <p className={`text-xs mt-0.5 ${theme.subText}`}>ข้อมูลบันทึกจริงจากฐานข้อมูลห้องพยาบาล</p>
                  </div>
                  <button onClick={() => setActiveTab('visit-record')} className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                    ไปที่บันทึกข้อมูล <ChevronRight size={14} />
                  </button>
                </div>

                {visits.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <p className={`text-sm font-semibold ${theme.heading}`}>ยังไม่มีประวัติการเข้ารับบริการในระบบ (ข้อมูลเป็น 0)</p>
                    <p className={`text-xs ${theme.subText}`}>ไปที่หน้า "บันทึกเข้าใช้บริการ" เพื่อเริ่มลงทะเบียนและบันทึกข้อมูลการรักษา</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={`border-b ${theme.tableHeader}`}>
                          <th className="py-3 px-4 font-semibold">รหัส</th>
                          <th className="py-3 px-4 font-semibold">เวลา</th>
                          <th className="py-3 px-4 font-semibold">ประเภท</th>
                          <th className="py-3 px-4 font-semibold">ชื่อ-นามสกุล</th>
                          <th className="py-3 px-4 font-semibold">คณะ / สาขาวิชา</th>
                          <th className="py-3 px-4 font-semibold">อาการสำคัญ</th>
                          <th className="py-3 px-4 font-semibold">ระดับความเร่งด่วน</th>
                          <th className="py-3 px-4 font-semibold">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {visits.slice(0, 5).map((v) => (
                          <tr key={v.id} className="hover:bg-slate-500/5">
                            <td className="py-3 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">{v.id}</td>
                            <td className="py-3 px-4 font-mono">{v.time}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 dark:bg-slate-800">
                                {v.patientRole || 'นักศึกษา'}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-bold">{v.studentName}</td>
                            <td className="py-3 px-4 text-slate-500">{v.faculty} {v.department ? `• ${v.department}` : ''}</td>
                            <td className="py-3 px-4 max-w-xs truncate">{v.symptom}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                v.triage === 'ฉุกเฉิน' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                                v.triage === 'ด่วน' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                                'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                              }`}>
                                {v.triage}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-medium">{v.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 2: VISIT RECORD (บันทึกเข้าใช้บริการ) */}
          {activeTab === 'visit-record' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className={`font-bold text-lg ${theme.heading}`}>บันทึกการเข้าใช้บริการห้องพยาบาล</h3>
                    <p className={`text-xs mt-1 ${theme.subText}`}>
                      เพิ่มข้อมูลผู้ป่วย • ตรวจสอบการแพ้ยาอัตโนมัติ • เลือกเตียงพักฟื้น • จ่ายยาและตัดสต็อก • บันทึกลงฐานข้อมูล
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowPatientSearchModal(true)}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-semibold hover:bg-teal-500/20"
                    >
                      <Search size={15} /> ค้นหาประวัติเดิม
                    </button>
                    <button 
                      onClick={resetVisitForm}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      ล้างฟอร์ม
                    </button>
                  </div>
                </div>

                {/* FORM GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* LEFT COLUMN: ข้อมูลผู้ป่วย + เตียง + ยา (7 cols) */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* 1. ข้อมูลผู้เข้ารับบริการ & ประเภท */}
                    <div className={`p-5 rounded-2xl border space-y-4 ${theme.cardInner}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                          <UserCheck size={16} /> 1. ข้อมูลผู้เข้ารับบริการ
                        </span>
                        {patientId.trim().length >= 2 && students.some(s => s.id === patientId.trim()) && (
                          <button
                            onClick={() => {
                              const match = students.find(s => s.id === patientId.trim());
                              if (match) autoFillPatient(match);
                            }}
                            className="text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 px-2 py-0.5 rounded-lg flex items-center gap-1"
                          >
                            ⚡ ดึงข้อมูลเดิมจากฐานข้อมูล
                          </button>
                        )}
                      </div>

                      {/* Role Selector: อาจารย์ นักศึกษา เจ้าหน้าที่ บุคลากร */}
                      <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${theme.subText}`}>ประเภทผู้รับบริการ *</label>
                        <div className="grid grid-cols-4 gap-2">
                          {USER_ROLES.map(role => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => setPatientRole(role)}
                              className={`py-2 px-1 rounded-xl text-xs font-bold border transition-all text-center ${
                                patientRole === role
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20'
                                  : darkMode 
                                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 bg-white'
                              }`}
                            >
                              {role === 'นักศึกษา' ? '🎓 ' : role === 'อาจารย์' ? '👨‍🏫 ' : role === 'เจ้าหน้าที่' ? '💼 ' : '👥 '}
                              {role}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* รหัส & กรุ๊ปเลือด */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>
                            {patientRole === 'นักศึกษา' ? 'รหัสนักศึกษา' : 'รหัสประจำตัว / รหัสบุคลากร'}
                          </label>
                          <input 
                            type="text" 
                            placeholder={patientRole === 'นักศึกษา' ? 'เช่น 66010012' : 'เช่น T-1002 หรือ STF-01'}
                            value={patientId}
                            onChange={(e) => setPatientId(e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border font-mono ${theme.inputBg}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>กรุ๊ปเลือด</label>
                          <select 
                            value={bloodGroup}
                            onChange={(e) => setBloodGroup(e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          >
                            <option>ไม่ระบุ</option>
                            <option>A</option>
                            <option>B</option>
                            <option>AB</option>
                            <option>O</option>
                          </select>
                        </div>
                      </div>

                      {/* ชื่อ - นามสกุล */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>ชื่อ (First Name) *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="เช่น ธนกฤต"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>นามสกุล (Last Name) *</label>
                          <input 
                            type="text" 
                            required
                            placeholder="เช่น วิทยานุสรณ์"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          />
                        </div>
                      </div>

                      {/* คณะ & สาขาวิชา */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>คณะ / หน่วยงาน *</label>
                          <select 
                            value={faculty}
                            onChange={(e) => setFaculty(e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          >
                            {STANDARD_FACULTIES.map(fac => <option key={fac} value={fac}>{fac}</option>)}
                          </select>
                          {faculty === 'อื่นๆ' && (
                            <input 
                              type="text" 
                              placeholder="ระบุคณะ / สำนัก..."
                              value={customFaculty}
                              onChange={(e) => setCustomFaculty(e.target.value)}
                              className={`w-full mt-2 px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                            />
                          )}
                        </div>
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>สาขาวิชา / ฝ่ายงาน</label>
                          <input 
                            type="text" 
                            placeholder="เช่น วิศวกรรมคอมพิวเตอร์"
                            value={department}
                            onChange={(e) => setDepartment(e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          />
                        </div>
                      </div>

                      {/* เบอร์โทร & ชั้นปี (ถ้าเป็น นศ.) */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {patientRole === 'นักศึกษา' && (
                          <div>
                            <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>ชั้นปี</label>
                            <select 
                              value={patientYear}
                              onChange={(e) => setPatientYear(e.target.value)}
                              className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                            >
                              <option>ชั้นปีที่ 1</option>
                              <option>ชั้นปีที่ 2</option>
                              <option>ชั้นปีที่ 3</option>
                              <option>ชั้นปีที่ 4</option>
                              <option>ชั้นปีที่ 5 ขึ้นไป / บัณฑิตศึกษา</option>
                            </select>
                          </div>
                        )}
                        <div className={patientRole !== 'นักศึกษา' ? 'sm:col-span-2' : ''}>
                          <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>เบอร์โทรศัพท์ติดต่อ</label>
                          <input 
                            type="text" 
                            placeholder="เช่น 081-234-5678"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          />
                        </div>
                      </div>

                      {/* 2. ประวัติการแพ้ยา & อาการที่แพ้ */}
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <ShieldAlert size={16} /> ประวัติการแพ้ยา & อาการที่แพ้ (ระบบตรวจจับอัตโนมัติ)
                          </label>
                          <span className={`text-[10px] ${theme.subText}`}>พิมพ์ชื่อยาแล้วกด Enter หรือกดปุ่มด้านล่าง</span>
                        </div>

                        {/* กล่องพิมพ์ยาที่แพ้ */}
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="ระบุยาที่แพ้ เช่น Penicillin, Amoxicillin, Ibuprofen..."
                            value={allergyInputText}
                            onChange={(e) => setAllergyInputText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                addAllergyTag(allergyInputText);
                              }
                            }}
                            className={`flex-1 px-3 py-2 text-xs rounded-xl border focus:border-rose-500 ${theme.inputBg}`}
                          />
                          <button
                            type="button"
                            onClick={() => addAllergyTag(allergyInputText)}
                            className="px-3.5 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 flex items-center gap-1"
                          >
                            <Plus size={14} /> เพิ่มยาที่แพ้
                          </button>
                        </div>

                        {/* ปุ่มลัดเพิ่มยาที่แพ้บ่อย */}
                        <div className="flex flex-wrap gap-1.5 items-center">
                          <span className={`text-[10px] ${theme.subText}`}>ยาที่แพ้บ่อย:</span>
                          {['Penicillin', 'Amoxicillin', 'Ibuprofen', 'Aspirin', 'Sulfa'].map(d => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => addAllergyTag(d)}
                              className="text-[10px] px-2 py-0.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            >
                              + {d}
                            </button>
                          ))}
                        </div>

                        {/* แท็กแสดงยาที่แพ้ */}
                        <div className="flex flex-wrap gap-1.5 min-h-[30px] p-2 rounded-xl bg-rose-500/5 border border-rose-500/20">
                          {patientAllergies.length === 0 ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ ไม่มีประวัติแพ้ยา (ปลอดภัย)</span>
                          ) : (
                            patientAllergies.map((alg, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold shadow-sm animate-in fade-in-50">
                                ⚠️ {alg}
                                <button type="button" onClick={() => removeAllergyTag(alg)} className="hover:opacity-75 ml-1">
                                  <X size={12} />
                                </button>
                              </span>
                            ))
                          )}
                        </div>

                        {/* ช่องกรอกอาการที่แสดงเมื่อแพ้ */}
                        <div>
                          <label className={`block text-[11px] font-semibold mb-1 ${theme.subText}`}>อาการที่แสดงเมื่อแพ้ (Allergic Reaction Symptoms)</label>
                          <input 
                            type="text" 
                            placeholder="เช่น ผื่นคัน ลมพิษ แน่นหน้าอก ปากบวม หายใจไม่ออก คลื่นไส้..."
                            value={allergyReactionText}
                            onChange={(e) => setAllergyReactionText(e.target.value)}
                            className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. เลือกเตียงพักฟื้น และดูเตียงที่ว่างเรียลไทม์ */}
                    <div className={`p-5 rounded-2xl border space-y-3 ${theme.cardInner}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                          <Bed size={16} /> 2. เลือกเตียงพักฟื้น (สถานะเตียงว่างเรียลไทม์)
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                          availableBedsCount > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600'
                        }`}>
                          ว่าง {availableBedsCount} / {beds.length} เตียง
                        </span>
                      </div>

                      <p className={`text-[11px] ${theme.subText}`}>
                        คลิกเลือกเตียงที่ต้องการให้ผู้ป่วยนอนพักฟื้น (ระบบจะอัปเดตผังเตียงและบันทึกลงฐานข้อมูล)
                      </p>

                      {/* ตัวเลือกเตียง Interactive */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {/* ไม่นอนเตียง */}
                        <div
                          onClick={() => setAssignedBedId('')}
                          className={`p-3 rounded-xl border cursor-pointer transition-all text-xs font-bold flex flex-col justify-between ${
                            assignedBedId === ''
                              ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20'
                              : darkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700 bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>⚪ ไม่นอนเตียง</span>
                            {assignedBedId === '' && <Check size={14} className="text-teal-600" />}
                          </div>
                          <span className={`text-[10px] mt-2 font-normal ${theme.subText}`}>รับยาแล้วกลับ</span>
                        </div>

                        {/* เตียง 1 - เตียง 6 */}
                        {beds.map(b => {
                          const isOccupied = b.status === 'occupied';
                          const isSelected = assignedBedId === b.id;
                          return (
                            <div
                              key={b.id}
                              onClick={() => {
                                if (!isOccupied) setAssignedBedId(b.id);
                              }}
                              className={`p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                                isOccupied 
                                  ? 'opacity-60 cursor-not-allowed bg-rose-500/5 border-rose-500/30' 
                                  : isSelected
                                    ? 'cursor-pointer border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20'
                                    : darkMode 
                                      ? 'cursor-pointer border-slate-800 hover:bg-slate-800 text-slate-300' 
                                      : 'cursor-pointer border-slate-200 hover:bg-slate-100 text-slate-700 bg-white'
                              }`}
                            >
                              <div className="flex justify-between items-center">
                                <span className="font-bold truncate">{b.name}</span>
                                {isSelected ? (
                                  <Check size={14} className="text-teal-600" />
                                ) : (
                                  <span className={`w-2 h-2 rounded-full ${isOccupied ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                                )}
                              </div>
                              <div className="mt-2 text-[10px]">
                                {isOccupied ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold truncate block">
                                    🔴 ครองเตียง: {b.studentName}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    🟢 ว่าง (คลิกเลือก)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. รายการจ่ายยา & ระบบตรวจสอบการแพ้ยาอัตโนมัติ */}
                    <div className={`p-5 rounded-2xl border space-y-3 ${theme.cardInner}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                          <Pill size={16} /> 3. รายการจ่ายยา & เวชภัณฑ์
                        </span>
                        <span className={`text-[11px] ${theme.subText}`}>ระบบตรวจสอบแพ้ยาตรงและข้ามกลุ่มอัตโนมัติ</span>
                      </div>

                      <div className="flex gap-2">
                        <select
                          value={dispenseMedId}
                          onChange={(e) => setDispenseMedId(e.target.value)}
                          className={`flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                        >
                          <option value="">-- เลือกยา / เวชภัณฑ์ --</option>
                          {medicines.map(m => {
                            const risk = checkDrugAllergy(m.name, patientAllergies);
                            return (
                              <option key={m.id} value={m.id} disabled={m.stock <= 0}>
                                {risk ? '⛔ ' : ''}{m.name} (คงเหลือ {m.stock} {m.unit}){risk ? ' — ผู้ป่วยแพ้ยา!' : ''}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          type="number" min={1} value={dispenseQty}
                          onChange={(e) => setDispenseQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className={`w-16 px-2 py-2 text-xs rounded-xl border text-center font-bold ${theme.inputBg}`}
                        />
                        <button
                          type="button"
                          onClick={() => { if (dispenseMedId) addMedToDispense(dispenseMedId, dispenseQty); }}
                          className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center gap-1"
                        >
                          <Plus size={14} /> เพิ่มยา
                        </button>
                      </div>

                      {/* การบล็อกเมื่อตรวจพบความเสี่ยงแพ้ยา */}
                      {allergyBlock && (
                        <div className="p-3.5 rounded-xl bg-rose-600 text-white text-xs space-y-1 animate-pulse">
                          <p className="font-black flex items-center gap-1.5"><AlertTriangle size={18} /> ระงับการจ่ายยา: {allergyBlock.med}</p>
                          <p className="font-semibold">{allergyBlock.message}</p>
                          <p className="opacity-90 text-[11px]">ระบบความปลอดภัยระงับการเบิกจ่ายยารายการนี้ทันที กรุณาเปลี่ยนเป็นยาทางเลือกอื่น</p>
                        </div>
                      )}

                      {/* รายการยาที่เลือกจ่าย */}
                      {dispenseList.length === 0 ? (
                        <p className={`text-xs text-center py-2 ${theme.subText}`}>ยังไม่มีรายการยาที่จ่าย</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dispenseList.map(d => (
                            <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">✓ {d.name}</span>
                              <span className="flex items-center gap-3">
                                <span className="font-mono font-bold">{d.qty} {d.unit}</span>
                                <button 
                                  type="button" 
                                  onClick={() => setDispenseList(dispenseList.filter(x => x.id !== d.id))} 
                                  className="text-rose-500 hover:text-rose-700"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: อาการ + AI ช่วยวินิจฉัย + Triage + บันทึก (5 cols) */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    <div className={`p-5 rounded-2xl border space-y-4 ${theme.cardInner}`}>
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                        <Activity size={16} /> 4. อาการและการคัดกรอง
                      </span>

                      {/* รายการอาการมาตรฐาน */}
                      <div>
                        <label className={`block text-xs font-semibold mb-2 ${theme.subText}`}>
                          เลือกอาการมาตรฐาน (Standard Symptoms)
                        </label>
                        <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-2.5 rounded-xl border bg-slate-50 dark:bg-slate-900/50">
                          {STANDARD_SYMPTOMS.map((sym, idx) => {
                            const isSelected = selectedStandardSymptoms.includes(sym);
                            return (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedStandardSymptoms(selectedStandardSymptoms.filter(s => s !== sym));
                                  } else {
                                    setSelectedStandardSymptoms([...selectedStandardSymptoms, sym]);
                                  }
                                }}
                                className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all text-left ${
                                  isSelected 
                                    ? 'bg-teal-600 text-white shadow-md' 
                                    : darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-white text-slate-700 border hover:bg-slate-100'
                                }`}
                              >
                                {isSelected ? '✓ ' : '+ '} {sym}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* หมายเหตุอาการเพิ่มเติม */}
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>หมายเหตุอาการเพิ่มเติม</label>
                        <input 
                          type="text" 
                          placeholder="เช่น ปวดศีรษะตุบๆ ข้างขวา เริ่มมีอาการเมื่อ 2 ชั่วโมงก่อน..."
                          value={customSymptomNote}
                          onChange={(e) => setCustomSymptomNote(e.target.value)}
                          className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                        />
                      </div>

                      {/* ปุ่ม AI ซักประวัติ & วิเคราะห์อาการ */}
                      <div className="grid grid-cols-2 gap-2.5 pt-1">
                        <button 
                          type="button"
                          onClick={startInterview}
                          className="py-2.5 px-2 rounded-xl border-2 border-teal-500 text-teal-700 dark:text-teal-300 font-bold text-xs hover:bg-teal-500/10 flex items-center justify-center gap-1.5"
                        >
                          <MessageCircleQuestion size={16} /> AI ซักประวัติ (5 ข้อ)
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleRunAiSymptomChecker()}
                          disabled={aiAnalyzing}
                          className="py-2.5 px-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-500/20 hover:brightness-110 flex items-center justify-center gap-1.5"
                        >
                          {aiAnalyzing ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                          <span>AI วิเคราะห์ & แนะนำ</span>
                        </button>
                      </div>

                      {/* ระดับความเร่งด่วน Triage */}
                      <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${theme.subText}`}>ระดับความเร่งด่วน (Triage Level)</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { v: 'ปกติ', c: 'emerald' },
                            { v: 'ด่วน', c: 'amber' },
                            { v: 'ฉุกเฉิน', c: 'rose' },
                          ].map(t => (
                            <button
                              key={t.v}
                              type="button"
                              onClick={() => setTriageLevel(t.v)}
                              className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                                triageLevel === t.v
                                  ? t.c === 'emerald' ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' : t.c === 'amber' ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                  : darkMode ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600 bg-white'
                              }`}
                            >
                              {t.v}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* การวินิจฉัยเบื้องต้น */}
                      <div>
                        <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>การวินิจฉัยเบื้องต้น (Diagnosis Note)</label>
                        <input
                          type="text"
                          value={diagnosisInput}
                          onChange={(e) => setDiagnosisInput(e.target.value)}
                          placeholder="เช่น Common cold, Tension headache, Acute gastritis..."
                          className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                        />
                      </div>
                    </div>

                    {/* AI Suggestion Box */}
                    {aiSuggestion && (
                      <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-2.5 animate-in fade-in-50">
                        <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-300">
                          <Sparkles size={16} /> ผลวิเคราะห์จากระบบ AI Assistant
                        </div>
                        {aiSuggestion.redFlag && (
                          <div className="p-2.5 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5">
                            <AlertTriangle size={16} /> พบอาการเสี่ยงสูง (Red flag) ควรประเมินสัญญาณชีพทันที
                          </div>
                        )}
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          วินิจฉัยที่สงสัย: {aiSuggestion.diagnoses.join(', ')}
                        </p>
                        {aiSuggestion.suggestedMeds.length > 0 && (
                          <div className="text-xs">
                            <span className="font-semibold text-teal-800 dark:text-teal-300">ยาที่แนะนำ: </span>
                            {aiSuggestion.suggestedMeds.map((m: any, i: number) => (
                              <span key={i} className="inline-block mr-2">
                                {m.name}
                                {!m.allergy && !m.outOfStock && (
                                  <button 
                                    type="button" 
                                    onClick={() => addMedToDispense(m.name, 1)} 
                                    className="ml-1 text-[10px] text-teal-600 font-bold underline"
                                  >
                                    [+จ่าย]
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ปุ่มบันทึกลงฐานข้อมูลหลัก */}
                    <div className="space-y-2 pt-2">
                      <button 
                        type="button"
                        onClick={handleSaveVisit}
                        className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-700 hover:to-emerald-600 text-white font-bold text-sm shadow-xl shadow-teal-600/25 flex items-center justify-center gap-2 transition-all active:scale-95"
                      >
                        <Database size={18} />
                        <span>บันทึกข้อมูลการรักษาลงฐานข้อมูล</span>
                      </button>
                      <p className={`text-[11px] text-center ${theme.subText}`}>
                        ตัดสต็อกยา • จัดสรรเตียงเรียลไทม์ • บันทึกลงฐานข้อมูลถาวร
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* ตารางประวัติการรับบริการทั้งหมดในฐานข้อมูล */}
              <div className={`rounded-2xl border p-6 ${theme.card}`}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`font-bold text-base ${theme.heading}`}>
                    ประวัติการเข้ารับบริการทั้งหมดในฐานข้อมูล ({visits.length} รายการ)
                  </h3>
                  {visits.length > 0 && (
                    <button
                      onClick={handleResetAllToZero}
                      className="text-xs text-rose-500 hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={12} /> ล้างประวัติเป็น 0
                    </button>
                  )}
                </div>

                {visits.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    ยังไม่มีข้อมูลประวัติการรักษา (ข้อมูลเป็น 0)
                  </div>
                ) : (
                  <div className="overflow-x-auto max-h-96">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={`border-b ${theme.tableHeader}`}>
                          <th className="py-2.5 px-3 font-semibold">รหัส</th>
                          <th className="py-2.5 px-3 font-semibold">เวลา</th>
                          <th className="py-2.5 px-3 font-semibold">ประเภท</th>
                          <th className="py-2.5 px-3 font-semibold">ผู้รับบริการ</th>
                          <th className="py-2.5 px-3 font-semibold">คณะ / สาขาวิชา</th>
                          <th className="py-2.5 px-3 font-semibold">อาการสำคัญ</th>
                          <th className="py-2.5 px-3 font-semibold">Triage</th>
                          <th className="py-2.5 px-3 font-semibold">เตียง</th>
                          <th className="py-2.5 px-3 font-semibold">ยาที่จ่าย</th>
                          <th className="py-2.5 px-3 font-semibold">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {visits.map(v => (
                          <tr key={v.id} className="hover:bg-slate-500/5">
                            <td className="py-2.5 px-3 font-mono font-bold text-teal-600 dark:text-teal-400">{v.id}</td>
                            <td className="py-2.5 px-3 font-mono">{v.time}</td>
                            <td className="py-2.5 px-3">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800">
                                {v.patientRole || 'นักศึกษา'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-semibold">{v.studentName}</td>
                            <td className="py-2.5 px-3 text-slate-500">{v.faculty} {v.department ? `(${v.department})` : ''}</td>
                            <td className="py-2.5 px-3 max-w-xs truncate">{v.symptom}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                v.triage === 'ฉุกเฉิน' ? 'bg-rose-500/10 text-rose-600' :
                                v.triage === 'ด่วน' ? 'bg-amber-500/10 text-amber-600' :
                                'bg-emerald-500/10 text-emerald-600'
                              }`}>
                                {v.triage}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 font-medium text-teal-600 dark:text-teal-400">
                              {v.bedId ? beds.find(b => b.id === v.bedId)?.name || v.bedId : '-'}
                            </td>
                            <td className="py-2.5 px-3">{(v.meds || []).join(', ') || '-'}</td>
                            <td className="py-2.5 px-3 font-medium">{v.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 3: INVENTORY (สต็อกยา & เวชภัณฑ์) */}
          {activeTab === 'inventory' && (() => {
            const statusLabel = (m: any) => {
              if (m.stock <= 0) return 'หมดสต็อก';
              const s = getStockStatus(m);
              return s === 'วิกฤต' ? 'วิกฤต ใกล้หมด' : s === 'เหลือน้อย' ? 'เหลือน้อย ควรสั่งเพิ่ม' : 'ปกติ';
            };
            const statusClass = (m: any) => {
              if (m.stock <= 0) return 'bg-rose-600 text-white border border-rose-600';
              const s = getStockStatus(m);
              return s === 'วิกฤต' ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20' :
                s === 'เหลือน้อย' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20';
            };
            const barClass = (m: any) => {
              const s = getStockStatus(m);
              return s === 'วิกฤต' ? 'bg-rose-500' : s === 'เหลือน้อย' ? 'bg-amber-500' : 'bg-emerald-500';
            };
            const okCount = medicines.filter(m => getStockStatus(m) === 'ปกติ').length;
            const lowCount = medicines.filter(m => getStockStatus(m) === 'เหลือน้อย').length;
            const critCount = medicines.filter(m => getStockStatus(m) === 'วิกฤต').length;
            const expSoonCount = medicines.filter(m => daysUntil(m.expiry) <= 90).length;

            const filtered = medicines.filter(m => {
              const q = invSearch.trim().toLowerCase();
              if (q && !(m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q))) return false;
              if (invCategory !== 'ทั้งหมด' && m.category !== invCategory) return false;
              if (invFilter === 'low' && getStockStatus(m) === 'ปกติ') return false;
              if (invFilter === 'expiring' && daysUntil(m.expiry) > 90) return false;
              return true;
            });

            const restockAfter = restockMed ? restockMed.stock + (parseInt(restockQty) || 0) : 0;
            const restockAfterStatus = restockMed ? getStockStatus({ stock: restockAfter, min: restockMed.min }) : 'ปกติ';

            const summaryCards = [
              { key: 'all', label: 'ยาทั้งหมด', value: medicines.length, hint: 'รายการ', cls: 'text-teal-600' },
              { key: 'ok', label: 'ปกติ', value: okCount, hint: 'ยังมีเพียงพอ', cls: 'text-emerald-600' },
              { key: 'low', label: 'เหลือน้อย', value: lowCount + critCount, hint: 'ต้องสั่งเพิ่ม', cls: 'text-amber-600' },
              { key: 'expiring', label: 'ใกล้หมดอายุ', value: expSoonCount, hint: 'ภายใน 90 วัน', cls: 'text-rose-600' },
            ];

            return (
            <div className="max-w-6xl mx-auto space-y-6">
              {/* สรุปภาพรวมสต็อก */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {summaryCards.map(c => (
                  <button
                    key={c.key}
                    onClick={() => setInvFilter(c.key === 'low' ? 'low' : c.key === 'expiring' ? 'expiring' : 'all')}
                    className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 ${theme.card}`}
                  >
                    <p className={`text-[11px] font-semibold ${theme.subText}`}>{c.label}</p>
                    <p className={`text-2xl font-black mt-1 ${c.cls}`}>{c.value}</p>
                    <p className={`text-[10px] ${theme.subText}`}>{c.hint}</p>
                  </button>
                ))}
              </div>

              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                  <div>
                    <h3 className={`font-bold text-lg ${theme.heading}`}>สต็อกยา & เวชภัณฑ์ห้องพยาบาล</h3>
                    <p className={`text-xs mt-1 ${theme.subText}`}>ตัดสต็อกอัตโนมัติเมื่อจ่ายยา และแจ้งเตือนเมื่อยาเหลือน้อยหรือใกล้หมดอายุ</p>
                  </div>
                  <button
                    onClick={() => setMedFormOpen(true)}
                    className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-md flex items-center gap-1.5"
                  >
                    <Plus size={16} /> เพิ่มรายการยาใหม่
                  </button>
                </div>

                {/* คำอธิบายการอ่านสต็อก */}
                <div className={`p-3 rounded-xl border text-[11px] mb-4 space-y-1.5 ${theme.cardInner}`}>
                  <p className="font-bold text-teal-700 dark:text-teal-300">วิธีอ่านสถานะสต็อก</p>
                  <p className={theme.subText}>
                    <strong>จุดสั่งซื้อขั้นต่ำ</strong> คือจำนวนที่ต้องมีไว้อย่างน้อย เมื่อยาคงเหลือเท่ากับหรือต่ำกว่าค่านี้ ระบบจะเตือนให้เติมสต็อก
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span><span className={theme.subText}>ปกติ: คงเหลือมากกว่าจุดสั่งซื้อ</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span><span className={theme.subText}>เหลือน้อย: ต่ำกว่าหรือเท่าจุดสั่งซื้อ</span></span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span><span className={theme.subText}>วิกฤต: เหลือไม่ถึง 30% ของจุดสั่งซื้อ</span></span>
                  </div>
                </div>

                {/* ค้นหา / กรอง */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.subText}`} />
                    <input
                      value={invSearch}
                      onChange={e => setInvSearch(e.target.value)}
                      placeholder="ค้นหาชื่อยา หรือรหัสยา..."
                      className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`}
                    />
                  </div>
                  <select
                    value={invCategory}
                    onChange={e => setInvCategory(e.target.value)}
                    className={`px-3 py-2 rounded-xl border text-xs outline-none ${theme.inputBg}`}
                  >
                    <option value="ทั้งหมด">ทุกหมวดหมู่</option>
                    {MEDICINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <select
                    value={invFilter}
                    onChange={e => setInvFilter(e.target.value as any)}
                    className={`px-3 py-2 rounded-xl border text-xs outline-none ${theme.inputBg}`}
                  >
                    <option value="all">แสดงทุกสถานะ</option>
                    <option value="low">เฉพาะยาที่ต้องเติม</option>
                    <option value="expiring">เฉพาะยาใกล้หมดอายุ</option>
                  </select>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${theme.tableHeader}`}>
                        <th className="py-3 px-4 font-semibold">รหัสยา</th>
                        <th className="py-3 px-4 font-semibold">ชื่อยา / เวชภัณฑ์</th>
                        <th className="py-3 px-4 font-semibold">หมวดหมู่</th>
                        <th className="py-3 px-4 font-semibold min-w-[170px]">คงเหลือ</th>
                        <th className="py-3 px-4 font-semibold">จุดสั่งซื้อขั้นต่ำ</th>
                        <th className="py-3 px-4 font-semibold">Lot / วันหมดอายุ</th>
                        <th className="py-3 px-4 font-semibold">สถานะสต็อก</th>
                        <th className="py-3 px-4 font-semibold text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {filtered.length === 0 && (
                        <tr><td colSpan={8} className={`py-8 text-center ${theme.subText}`}>ไม่พบรายการยาที่ตรงกับเงื่อนไข</td></tr>
                      )}
                      {filtered.map(m => {
                        const days = daysUntil(m.expiry);
                        const need = Math.max(m.min * 3 - m.stock, 0);
                        const pct = Math.min(100, Math.round((m.stock / (m.min * 3)) * 100));
                        return (
                          <tr key={m.id} className="transition-colors hover:bg-slate-500/5">
                            <td className="py-3.5 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">{m.id}</td>
                            <td className="py-3.5 px-4 font-semibold">{m.name}</td>
                            <td className="py-3.5 px-4">{m.category}</td>
                            <td className="py-3.5 px-4">
                              <p className="font-mono font-bold">{m.stock} {m.unit}</p>
                              <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 mt-1.5 overflow-hidden">
                                <div className={`h-full rounded-full ${barClass(m)}`} style={{ width: `${pct}%` }}></div>
                              </div>
                              {getStockStatus(m) !== 'ปกติ' && (
                                <p className="text-[10px] mt-1 text-amber-600 font-semibold">ขาดอีกประมาณ {need} {m.unit} จึงจะพอใช้</p>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-mono">{m.min} {m.unit}</td>
                            <td className="py-3.5 px-4 font-mono text-[11px]">
                              {m.lot} <br/>
                              <span className={days <= 90 ? 'text-rose-500 font-bold' : theme.subText}>
                                {m.expiry} ({days < 0 ? 'หมดอายุแล้ว' : `อีก ${days} วัน`})
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${statusClass(m)}`}>
                                {statusLabel(m)}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                onClick={() => { setRestockMed(m); setRestockQty(String(Math.max(need, m.min))); setRestockLot(''); setRestockExpiry(''); }}
                                className="px-3 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold hover:bg-teal-500/20 text-xs whitespace-nowrap"
                              >
                                + เติมสต็อก
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* หน้าต่างเติมสต็อก */}
              {restockMed && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <div className={`w-full max-w-md rounded-2xl border p-6 space-y-4 ${theme.modalBg}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className={`font-bold text-base ${theme.heading}`}>เติมสต็อกยา</h3>
                        <p className="text-xs font-semibold text-teal-600 mt-0.5">{restockMed.name}</p>
                      </div>
                      <button onClick={() => setRestockMed(null)} className={theme.subText}><X size={18} /></button>
                    </div>

                    <div className={`p-3 rounded-xl border text-xs grid grid-cols-3 gap-2 text-center ${theme.cardInner}`}>
                      <div><p className={theme.subText}>คงเหลือตอนนี้</p><p className="font-black text-base">{restockMed.stock}</p></div>
                      <div><p className={theme.subText}>จุดสั่งซื้อขั้นต่ำ</p><p className="font-black text-base">{restockMed.min}</p></div>
                      <div><p className={theme.subText}>หลังเติมจะเป็น</p><p className="font-black text-base text-teal-600">{restockAfter}</p></div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold">จำนวนที่รับเข้า ({restockMed.unit})</label>
                      <input
                        type="number" min="1" value={restockQty}
                        onChange={e => setRestockQty(e.target.value)}
                        className={`mt-1 w-full px-3 py-2 rounded-xl border text-sm outline-none focus:border-teal-500 ${theme.inputBg}`}
                      />
                      <div className="flex gap-2 mt-2">
                        {[10, 50, 100, 200].map(n => (
                          <button key={n} onClick={() => setRestockQty(String((parseInt(restockQty) || 0) + n))}
                            className="px-3 py-1 rounded-lg bg-teal-500/10 text-teal-600 text-xs font-semibold hover:bg-teal-500/20">+{n}</button>
                        ))}
                      </div>
                      <p className={`text-[11px] mt-2 ${restockAfterStatus === 'ปกติ' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {restockAfterStatus === 'ปกติ' ? 'หลังเติมสต็อกแล้วสถานะจะเป็นปกติ' : 'หลังเติมแล้วยังต่ำกว่าจุดสั่งซื้อขั้นต่ำ ควรเติมเพิ่ม'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold">Lot ใหม่ (ถ้ามี)</label>
                        <input value={restockLot} onChange={e => setRestockLot(e.target.value)} placeholder={restockMed.lot}
                          className={`mt-1 w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`} />
                      </div>
                      <div>
                        <label className="text-xs font-semibold">วันหมดอายุใหม่ (ถ้ามี)</label>
                        <input type="date" value={restockExpiry} onChange={e => setRestockExpiry(e.target.value)}
                          className={`mt-1 w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`} />
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => setRestockMed(null)} className={`px-4 py-2 rounded-xl border text-xs font-semibold ${theme.cardInner}`}>ยกเลิก</button>
                      <button onClick={handleConfirmRestock} className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700">ยืนยันเติมสต็อก</button>
                    </div>
                  </div>
                </div>
              )}

              {/* หน้าต่างเพิ่มรายการยาใหม่ */}
              {medFormOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                  <div className={`w-full max-w-lg rounded-2xl border p-6 space-y-4 ${theme.modalBg}`}>
                    <div className="flex justify-between items-start">
                      <h3 className={`font-bold text-base ${theme.heading}`}>เพิ่มรายการยา / เวชภัณฑ์ใหม่</h3>
                      <button onClick={() => setMedFormOpen(false)} className={theme.subText}><X size={18} /></button>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-xs font-semibold">ชื่อยา (ภาษาไทย) *</label>
                        <input value={newMed.name} onChange={e => setNewMed({ ...newMed, name: e.target.value })} placeholder="เช่น ยาธาตุน้ำขาว"
                          className={`mt-1 w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold">หมวดหมู่</label>
                          <select value={newMed.category} onChange={e => setNewMed({ ...newMed, category: e.target.value })}
                            className={`mt-1 w-full px-3 py-2 rounded-xl border text-xs outline-none ${theme.inputBg}`}>
                            {MEDICINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold">หน่วยนับ</label>
                          <select value={newMed.unit} onChange={e => setNewMed({ ...newMed, unit: e.target.value })}
                            className={`mt-1 w-full px-3 py-2 rounded-xl border text-xs outline-none ${theme.inputBg}`}>
                            {MEDICINE_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold">จำนวนเริ่มต้น</label>
                          <input type="number" min="0" value={newMed.stock} onChange={e => setNewMed({ ...newMed, stock: e.target.value })}
                            className={`mt-1 w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold">จุดสั่งซื้อขั้นต่ำ</label>
                          <input type="number" min="1" value={newMed.min} onChange={e => setNewMed({ ...newMed, min: e.target.value })}
                            className={`mt-1 w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`} />
                          <p className={`text-[10px] mt-1 ${theme.subText}`}>ต่ำกว่าค่านี้ระบบจะเตือนให้เติมยา</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-semibold">Lot ผลิต</label>
                          <input value={newMed.lot} onChange={e => setNewMed({ ...newMed, lot: e.target.value })} placeholder="เช่น LOT-2026-050"
                            className={`mt-1 w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`} />
                        </div>
                        <div>
                          <label className="text-xs font-semibold">วันหมดอายุ</label>
                          <input type="date" value={newMed.expiry} onChange={e => setNewMed({ ...newMed, expiry: e.target.value })}
                            className={`mt-1 w-full px-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`} />
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => setMedFormOpen(false)} className={`px-4 py-2 rounded-xl border text-xs font-semibold ${theme.cardInner}`}>ยกเลิก</button>
                      <button onClick={handleAddMedicine} className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700">บันทึกรายการยา</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {/* VIEW 4: DATA IMPORT */}
          {activeTab === 'data-import' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className={`p-8 rounded-2xl border text-center ${theme.card}`}>
                <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-4">
                  <Upload size={32} />
                </div>
                <h3 className={`font-bold text-lg ${theme.heading}`}>นำเข้าข้อมูลผู้ใช้บริการผ่านไฟล์ Google Sheets / Excel</h3>
                <p className={`text-xs mt-1 max-w-md mx-auto ${theme.subText}`}>
                  ลากวางไฟล์ CSV หรือ XLSX เพื่อนำเข้ารายชื่อนักศึกษา อาจารย์ และบุคลากรเข้าสู่ฐานข้อมูลอัตโนมัติ
                </p>

                <div className="mt-8 p-8 rounded-2xl border-2 border-dashed border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 transition-all cursor-pointer">
                  <SheetIcon size={40} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
                  <p className="text-xs font-semibold">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</p>
                  <p className={`text-[11px] mt-1 ${theme.subText}`}>รองรับไฟล์ .csv, .xlsx (ขนาดไม่เกิน 25MB)</p>
                </div>

                <div className="mt-6 flex justify-center gap-4">
                  <button 
                    onClick={() => addToast('ซิงค์ข้อมูลสำเร็จ', 'ดึงข้อมูลนักศึกษาใหม่ 1,250 รายการจาก Google Sheets เรียบร้อย')}
                    className="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-md"
                  >
                    ยืนยันการนำเข้าข้อมูล
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 5: PATIENTS & STUDENTS DIRECTORY */}
          {activeTab === 'students' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <div>
                    <h3 className={`font-bold text-lg ${theme.heading}`}>ทะเบียนผู้รับบริการ & ประวัติการแพ้ยา</h3>
                    <p className={`text-xs mt-1 ${theme.subText}`}>รวมนักศึกษา อาจารย์ เจ้าหน้าที่ และบุคลากร ({students.length} รายการ)</p>
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto">
                    {/* Role Filter Chips */}
                    <div className="flex gap-1 overflow-x-auto py-1">
                      {['ทั้งหมด', 'นักศึกษา', 'อาจารย์', 'เจ้าหน้าที่', 'บุคลากร'].map(r => (
                        <button
                          key={r}
                          onClick={() => setStudentFilterRole(r)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            studentFilterRole === r
                              ? 'bg-teal-600 text-white'
                              : darkMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {students.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <p className={`text-sm font-semibold ${theme.heading}`}>ยังไม่มีข้อมูลผู้รับบริการในระบบ (ข้อมูลเป็น 0)</p>
                    <p className={`text-xs ${theme.subText}`}>เมื่อบันทึกข้อมูลการรักษา รายชื่อผู้ป่วยและประวัติแพ้ยาจะถูกจัดเก็บลงที่นี่โดยอัตโนมัติ</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className={`border-b ${theme.tableHeader}`}>
                          <th className="py-3 px-4 font-semibold">รหัสประจำตัว</th>
                          <th className="py-3 px-4 font-semibold">ประเภท</th>
                          <th className="py-3 px-4 font-semibold">ชื่อ-นามสกุล</th>
                          <th className="py-3 px-4 font-semibold">คณะ / สาขาวิชา</th>
                          <th className="py-3 px-4 font-semibold">กรุ๊ปเลือด</th>
                          <th className="py-3 px-4 font-semibold">ประวัติการแพ้ยา</th>
                          <th className="py-3 px-4 font-semibold text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {students
                          .filter(s => studentFilterRole === 'ทั้งหมด' || s.role === studentFilterRole)
                          .map(s => (
                            <tr key={s.id} className="transition-colors hover:bg-slate-500/5">
                              <td className="py-3.5 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">{s.id}</td>
                              <td className="py-3.5 px-4">
                                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-200 dark:bg-slate-800">
                                  {s.role || 'นักศึกษา'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-bold">{s.name}</td>
                              <td className="py-3.5 px-4">{s.faculty} {s.department ? `• ${s.department}` : ''}</td>
                              <td className="py-3.5 px-4 font-mono">{s.blood || '-'}</td>
                              <td className="py-3.5 px-4">
                                <div className="flex flex-wrap gap-1 items-center">
                                  {s.allergies && s.allergies.length > 0 ? s.allergies.map((alg: string, i: number) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300 text-[11px] font-bold border border-rose-500/20">
                                      ⚠️ {alg}
                                    </span>
                                  )) : (
                                    <span className="text-emerald-600 dark:text-emerald-400">ปกติ</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3.5 px-4 text-right space-x-2">
                                <button 
                                  onClick={() => setAllergyModalStudent(s)}
                                  className="px-3 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold hover:bg-teal-500/20 text-xs"
                                >
                                  + แพ้ยา
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* VIEW 6: REPORTS */}
          {activeTab === 'reports' && (
            <Reports data={{ students, medicines, visits, beds }} theme={theme} addToast={addToast} />
          )}

          {/* VIEW 7: AI ASSISTANT */}
          {activeTab === 'ai-assistant' && (
            <AiChat data={{ students, medicines, visits, beds }} theme={theme} darkMode={darkMode} />
          )}

          {/* VIEW 8: SETTINGS & DATABASE MANAGEMENT */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl mx-auto space-y-6">
              
              {/* Supabase Cloud Database Setting Card */}
              <div className={`p-6 rounded-3xl border ${theme.card} space-y-4 shadow-xl border-teal-500/30`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white shadow-md shadow-teal-500/20">
                      <Cloud size={22} />
                    </div>
                    <div>
                      <h3 className={`font-black text-base ${theme.heading}`}>ฐานข้อมูลคลาวด์ Supabase (PostgreSQL)</h3>
                      <p className={`text-xs ${theme.subText}`}>ระบบรองรับการเชื่อมต่อฐานข้อมูลคลาวด์ออนไลน์ ซิงค์ข้อมูลข้ามอุปกรณ์แบบเรียลไทม์</p>
                    </div>
                  </div>
                  <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                    supabaseStatus === 'connected'
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                  }`}>
                    {supabaseStatus === 'connected' ? '🟢 เชื่อมต่อ Supabase แล้ว' : '🟡 โหมด LocalDB (ออฟไลน์)'}
                  </span>
                </div>

                <div className="space-y-3 pt-2 text-xs">
                  <div>
                    <label className={`block font-semibold mb-1 ${theme.heading}`}>Supabase Project URL</label>
                    <input
                      type="text"
                      placeholder="https://your-project.supabase.co"
                      value={supabaseUrl}
                      onChange={e => setSupabaseUrl(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border font-mono ${theme.inputBg}`}
                    />
                  </div>
                  <div>
                    <label className={`block font-semibold mb-1 ${theme.heading}`}>Supabase Anon Public API Key</label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={supabaseKey}
                      onChange={e => setSupabaseKey(e.target.value)}
                      className={`w-full p-2.5 rounded-xl border font-mono ${theme.inputBg}`}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <button
                    onClick={handleSaveSupabaseConfig}
                    disabled={isTestingSupabase}
                    className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-all flex items-center gap-1.5 shadow-md shadow-teal-600/20"
                  >
                    {isTestingSupabase ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                    <span>บันทึก & ทดสอบเชื่อมต่อ</span>
                  </button>

                  <button
                    onClick={handleCopySqlSchema}
                    className="px-4 py-2 rounded-xl border border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold text-xs transition-all flex items-center gap-1.5"
                  >
                    <Copy size={14} />
                    <span>คัดลอก SQL Script สร้างตาราง</span>
                  </button>

                  <button
                    onClick={handleSyncToSupabase}
                    disabled={isSyncingSupabase || supabaseStatus !== 'connected'}
                    className="px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isSyncingSupabase ? <RefreshCw className="animate-spin" size={14} /> : <Cloud size={14} />}
                    <span>ซิงค์ข้อมูลขึ้น Supabase Cloud</span>
                  </button>
                </div>

                <div className={`p-3 rounded-2xl border text-[11px] space-y-1 ${theme.cardInner}`}>
                  <p className="font-bold text-teal-700 dark:text-teal-300">💡 วิธีใช้งานฐานข้อมูล Supabase สำหรับโปรเจกต์:</p>
                  <p className={theme.subText}>1. สมัครใช้งานฟรีที่ <a href="https://supabase.com" target="_blank" rel="noreferrer" className="underline font-semibold text-teal-600">supabase.com</a> แล้วสร้างโปรเจกต์ใหม่</p>
                  <p className={theme.subText}>2. ไปที่เมนู <strong>SQL Editor</strong> แล้วกดปุ่ม <em>"คัดลอก SQL Script สร้างตาราง"</em> ด้านบนไปรัน เพื่อสร้างตารางอัตโนมัติ</p>
                  <p className={theme.subText}>3. นำ <strong>Project URL</strong> และ <strong>Anon Key</strong> จากหน้า Project Settings มาวางและกดบันทึก</p>
                </div>
              </div>

              {/* Local Storage Database Management Card */}
              <div className={`p-6 rounded-2xl border ${theme.card} space-y-4`}>
                <h3 className={`font-bold text-base ${theme.heading}`}>จัดการฐานข้อมูลภายในเครื่อง (Local Database Management)</h3>
                <p className={`text-xs ${theme.subText}`}>ระบบจัดเก็บข้อมูลใน Local Storage Database ของเบราว์เซอร์อย่างถาวร</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <button
                    onClick={handleResetAllToZero}
                    className="p-4 rounded-xl border border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/10 text-left space-y-1 transition-all"
                  >
                    <div className="flex items-center gap-2 text-rose-600 font-bold text-xs">
                      <RotateCcw size={16} /> ล้างและรีเซ็ตข้อมูลเป็น 0 ทั้งหมด
                    </div>
                    <p className={`text-[11px] ${theme.subText}`}>ล้างประวัติการรักษา รายชื่อผู้ป่วย และคืนเตียงว่างทั้งหมดให้เป็น 0</p>
                  </button>

                  <button
                    onClick={handleLoadDemo}
                    className="p-4 rounded-xl border border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 text-left space-y-1 transition-all"
                  >
                    <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-xs">
                      <Database size={16} /> โหลดข้อมูลตัวอย่างสำหรับสาธิต
                    </div>
                    <p className={`text-[11px] ${theme.subText}`}>นำเข้าชุดข้อมูลทดสอบเพื่อใช้ในการนำเสนอโครงงานและอาจารย์</p>
                  </button>
                </div>
              </div>

              {/* Google Apps Script Card */}
              <div className={`p-6 rounded-2xl border ${theme.card} space-y-4`}>
                <h3 className={`font-bold text-base ${theme.heading}`}>การเชื่อมต่อ Google Apps Script & Google Sheets</h3>
                <p className={`text-xs ${theme.subText}`}>เชื่อมโยงข้อมูลกับชีตออนไลน์ของมหาวิทยาลัยกาฬสินธุ์</p>
                <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20 text-xs space-y-2">
                  <p className="font-bold text-emerald-700 dark:text-emerald-300">✅ สถานะ: เชื่อมต่อ Web App URL สำเร็จ</p>
                  <p className="font-mono text-[11px] opacity-80">https://script.google.com/macros/s/AKfycbx.../exec</p>
                </div>
              </div>

            </div>
          )}

          {/* VIEW 9: STUDENT PORTAL (PREVIEW IN ADMIN) */}
          {activeTab === 'student-portal' && (
            <StudentPortal 
              students={students} 
              beds={beds}
              visits={visits}
              theme={theme} 
              onDeclare={(id: string, data: any) => {
                setStudents(prev => prev.map(s => s.id === id ? {
                  ...s,
                  allergies: Array.from(new Set([...s.allergies, data.drugName])),
                  allergyReaction: data.reaction,
                  allergyDetails: [...(s.allergyDetails || []), { ...data, verified: false, source: 'student' }]
                } : s));
                addToast('ส่งข้อมูลแพ้ยาแล้ว', `บันทึก ${data.drugName} รอยืนยันโดยเจ้าหน้าที่`);
              }} 
              addToast={addToast} 
            />
          )}

        </main>
      </div>

      {/* FLOATING AI ASSISTANT WIDGET (มุมขวาล่างสำหรับถาม AI ขณะซักประวัติ) */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end">
        {/* POPUP CHAT WINDOW */}
        {showAiPopup && (
          <div className={`mb-3 w-96 max-w-[calc(100vw-2rem)] h-[520px] max-h-[82vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in slide-in-from-bottom-5 duration-200 ${
            darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-teal-950/40' : 'bg-white/95 border-slate-200 text-slate-800 shadow-teal-900/10'
          }`}>
            {/* Header */}
            <div className={`p-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-600/30">
                  <Bot size={20} />
                </div>
                <div>
                  <h4 className={`font-bold text-xs flex items-center gap-1.5 ${theme.heading}`}>
                    UniCare AI Assistant
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  </h4>
                  <p className={`text-[10px] ${theme.subText}`}>ผู้ช่วยซักประวัติอาการ & ตรวจความปลอดภัยยา</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAiPopup(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                title="ปิดหน้าต่าง AI"
              >
                <X size={16} />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar text-xs">
              {popupMessages.map((m, idx) => (
                <div key={idx} className={`flex gap-2.5 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'ai' && (
                    <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Sparkles size={12} />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                      m.role === 'user'
                        ? 'bg-teal-600 text-white rounded-br-none shadow-md shadow-teal-600/20'
                        : darkMode 
                          ? 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700/60' 
                          : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/80'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {popupTyping && (
                <div className="flex gap-2 items-center text-xs text-teal-600 dark:text-teal-400 animate-pulse">
                  <Sparkles size={14} />
                  <span>AI กำลังวิเคราะห์ข้อมูลการซักประวัติ...</span>
                </div>
              )}
              <div ref={popupBottomRef} />
            </div>

            {/* Quick Consultation Chips */}
            <div className={`p-2 border-t overflow-x-auto flex gap-1.5 custom-scrollbar ${darkMode ? 'border-slate-800 bg-slate-900/60' : 'border-slate-100 bg-slate-50/60'}`}>
              {[
                'แนวทางซักประวัติไข้หวัด',
                'ปวดท้องเกร็ง ควรถามอะไรต่อ',
                'แพ้ Penicillin จ่ายยาอะไรแทนได้',
                'สัญญาณอันตราย Red Flags'
              ].map(q => (
                <button
                  key={q}
                  type="button"
                  onClick={() => sendPopupMessage(q)}
                  className="whitespace-nowrap text-[10px] px-2.5 py-1 rounded-full border border-teal-500/30 bg-teal-500/5 text-teal-700 dark:text-teal-300 hover:bg-teal-500/15 transition-all"
                >
                  + {q}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className={`p-3 border-t flex gap-2 ${darkMode ? 'border-slate-800 bg-slate-900' : 'border-slate-100 bg-white'}`}>
              <input
                type="text"
                placeholder="ถาม AI เช่น คนไข้ปวดหัว ควรถามอะไรต่อ..."
                value={popupInput}
                onChange={e => setPopupInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendPopupMessage(popupInput);
                  }
                }}
                className={`flex-1 px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-teal-500 ${theme.inputBg}`}
              />
              <button
                type="button"
                onClick={() => sendPopupMessage(popupInput)}
                disabled={!popupInput.trim() || popupTyping}
                className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white transition-all shadow-md shadow-teal-600/30"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Floating Toggle Button */}
        <button
          type="button"
          onClick={() => setShowAiPopup(!showAiPopup)}
          className={`flex items-center gap-2.5 px-4 py-3 rounded-full text-white font-bold text-xs shadow-2xl transition-all hover:scale-105 active:scale-95 group ${
            showAiPopup
              ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-slate-900/50'
              : 'bg-gradient-to-r from-teal-600 to-emerald-500 hover:brightness-110 shadow-teal-600/40 ring-4 ring-teal-500/20'
          }`}
          title="คลิกเพื่อเปิด AI ผู้ช่วยซักถามอาการคนไข้"
        >
          <div className="relative">
            <Bot size={18} className="stroke-[2.5]" />
            {!showAiPopup && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping" />
            )}
          </div>
          <span>{showAiPopup ? 'ปิดหน้าต่าง AI' : 'AI ซักถามผู้ป่วย'}</span>
        </button>
      </div>

      {/* MODALS */}
      {/* 1. Patient Directory Search Modal (แทนการสแกน QR) */}
      {showPatientSearchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl relative ${theme.modalBg}`}>
            <button onClick={() => setShowPatientSearchModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>

            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                <Search size={28} />
              </div>
              <h3 className={`font-bold text-lg ${theme.heading}`}>ค้นหาประวัติผู้ป่วยเดิม</h3>
              <p className={`text-xs ${theme.subText}`}>พิมพ์รหัสประจำตัว หรือเลือกรายชื่อจากฐานข้อมูลเพื่อดึงข้อมูลอัตโนมัติ</p>

              <form
                onSubmit={e => { e.preventDefault(); if (patientSearchInput.trim()) loadStudentById(patientSearchInput); }}
                className="flex gap-2 pt-2"
              >
                <input
                  autoFocus
                  type="text"
                  value={patientSearchInput}
                  onChange={e => setPatientSearchInput(e.target.value)}
                  placeholder="พิมพ์รหัส เช่น 66010012 หรือ T-1002"
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border font-mono ${theme.inputBg}`}
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700">
                  ดึงข้อมูล
                </button>
              </form>

              <div className="grid grid-cols-1 gap-2 pt-3 max-h-60 overflow-y-auto">
                {students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => loadStudentById(s.id)}
                    className={`p-3 rounded-xl border text-left flex justify-between items-center transition-all text-xs font-semibold ${darkMode ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-teal-50 border-slate-200'}`}
                  >
                    <div>
                      <span className="text-teal-600 dark:text-teal-400 font-mono">{s.id} ({s.role || 'นักศึกษา'})</span>
                      <p className={`font-bold ${theme.heading}`}>{s.name}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-200 dark:bg-slate-800">{s.faculty}</span>
                      {s.allergies && s.allergies.length > 0 && <p className="text-[10px] text-rose-500 font-bold mt-1">⚠️ แพ้ยา</p>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Allergy Registration Modal */}
      {allergyModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl relative ${theme.modalBg}`}>
            <button onClick={() => setAllergyModalStudent(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600">
                  <ShieldAlert size={24} />
                </div>
                <div>
                  <h3 className={`font-bold text-base ${theme.heading}`}>ลงทะเบียนประวัติแพ้ยา</h3>
                  <p className={`text-xs ${theme.subText}`}>{allergyModalStudent.name} ({allergyModalStudent.id})</p>
                </div>
              </div>

              <form onSubmit={handleRegisterAllergy} className="space-y-3 text-xs">
                <div>
                  <label className={`block font-semibold mb-1 ${theme.heading}`}>ชื่อยาที่แพ้ *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="ระบุชื่อยา เช่น Penicillin, Ibuprofen..."
                    value={newAllergyData.drugName}
                    onChange={(e) => setNewAllergyData({ ...newAllergyData, drugName: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${theme.heading}`}>กลุ่มยา (ตรวจการแพ้ยาข้ามกลุ่ม)</label>
                  <select
                    value={newAllergyData.drugFamily}
                    onChange={(e) => setNewAllergyData({ ...newAllergyData, drugFamily: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`}
                  >
                    {DRUG_FAMILY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${theme.heading}`}>อาการที่แสดงเมื่อแพ้</label>
                  <input 
                    type="text" 
                    value={newAllergyData.reaction}
                    onChange={(e) => setNewAllergyData({ ...newAllergyData, reaction: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`}
                  />
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${theme.heading}`}>ระดับความรุนแรง</label>
                  <select 
                    value={newAllergyData.severity}
                    onChange={(e) => setNewAllergyData({ ...newAllergyData, severity: e.target.value })}
                    className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`}
                  >
                    <option value="รุนแรงมาก (Anaphylaxis Risk)">รุนแรงมาก (Anaphylaxis Risk)</option>
                    <option value="ปานกลาง (มีผื่นลมพิษ)">ปานกลาง (มีผื่นลมพิษ)</option>
                    <option value="เล็กน้อย (คลื่นไส้ มึนหัว)">เล็กน้อย (คลื่นไส้ มึนหัว)</option>
                  </select>
                </div>

                <div className="pt-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setAllergyModalStudent(null)} className="px-4 py-2 rounded-xl border text-slate-500">ยกเลิก</button>
                  <button type="submit" className="px-5 py-2 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700">บันทึกประวัติแพ้ยา</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 3. Bed Management Modal */}
      {bedManagementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className={`max-w-2xl w-full p-6 rounded-3xl border shadow-2xl relative ${theme.modalBg}`}>
            <button onClick={() => setBedManagementModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-600">
                  <Bed size={24} />
                </div>
                <div>
                  <h3 className={`font-bold text-base ${theme.heading}`}>จัดการเตียงนอนพักฟื้นห้องพยาบาล</h3>
                  <p className={`text-xs ${theme.subText}`}>ว่าง {availableBedsCount} จาก {beds.length} เตียง — กดปุ่มจำหน่ายผู้ป่วยเมื่ออาการดีขึ้นเพื่อคืนเตียงว่าง</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                {beds.map(b => (
                  <div key={b.id} className={`p-4 rounded-2xl border text-xs ${
                    b.status === 'occupied' ? 'bg-rose-500/5 border-rose-500/30' : 'bg-emerald-500/5 border-emerald-500/30'
                  }`}>
                    <div className="flex justify-between items-center">
                      <span className={`font-bold text-sm ${theme.heading}`}>{b.name}</span>
                      <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                        b.status === 'occupied' ? 'bg-rose-500/20 text-rose-600' : 'bg-emerald-500/20 text-emerald-600'
                      }`}>
                        {b.status === 'occupied' ? 'ไม่ว่าง' : 'ว่าง'}
                      </span>
                    </div>
                    {b.status === 'occupied' ? (
                      <div className="mt-2 pt-2 border-t border-rose-500/20 space-y-1.5">
                        <p className="font-semibold text-rose-700 dark:text-rose-300">ผู้ป่วย: {b.studentName} ({b.studentId})</p>
                        <p className="opacity-80">อาการ: {b.symptom}</p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="font-mono opacity-70">เข้าพัก: {b.timeIn}</span>
                          <button
                            onClick={() => handleDischarge(b.id)}
                            className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 text-[11px] flex items-center gap-1"
                          >
                            <LogOut size={12} /> จำหน่าย / คืนเตียง
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`mt-2 ${theme.subText}`}>พร้อมรับผู้ป่วยพักฟื้น</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. AI Symptom Interview Modal */}
      {interviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className={`max-w-lg w-full p-6 rounded-3xl border shadow-2xl relative ${theme.modalBg}`}>
            <button onClick={() => setInterviewOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                  <MessageCircleQuestion size={24} />
                </div>
                <div>
                  <h3 className={`font-bold text-base ${theme.heading}`}>AI ซักประวัติอาการเพิ่มเติม (Interactive Triage)</h3>
                  <p className={`text-xs ${theme.subText}`}>ช่วยประเมินระดับความเร่งด่วนเบื้องต้น (ไม่ส่งข้อมูลระบุตัวตนออกภายนอก)</p>
                </div>
              </div>

              {interviewStep < INTERVIEW_QUESTIONS.length ? (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-teal-600 dark:text-teal-400">คำถามที่ {interviewStep + 1} / {INTERVIEW_QUESTIONS.length}</span>
                    <div className="flex gap-1">
                      {INTERVIEW_QUESTIONS.map((_, i) => (
                        <span key={i} className={`h-1.5 w-6 rounded-full ${i <= interviewStep ? 'bg-teal-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                      ))}
                    </div>
                  </div>
                  <p className={`font-bold text-sm ${theme.heading}`}>{INTERVIEW_QUESTIONS[interviewStep].q}</p>
                  <div className="grid grid-cols-1 gap-2">
                    {INTERVIEW_QUESTIONS[interviewStep].options.map(opt => (
                      <button
                        key={opt}
                        onClick={() => answerInterview(INTERVIEW_QUESTIONS[interviewStep].id, opt)}
                        className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${darkMode ? 'hover:bg-slate-800 border-slate-700' : 'hover:bg-teal-50 border-slate-200'}`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (() => {
                const res = assessTriage(interviewAnswers, selectedStandardSymptoms);
                return (
                  <div className="space-y-4 pt-2 text-xs">
                    <div className={`p-4 rounded-2xl border ${res.level === 'ฉุกเฉิน' ? 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300' : res.level === 'ด่วน' ? 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'}`}>
                      <p className="font-black text-sm">ระดับความเร่งด่วนที่แนะนำ: {res.level}</p>
                      <p className="mt-1">เหตุผล: {res.reasons.join(', ')}</p>
                    </div>
                    <div className="space-y-1">
                      {INTERVIEW_QUESTIONS.map(q => (
                        <div key={q.id} className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-800">
                          <span className={theme.subText}>{q.q}</span>
                          <span className="font-semibold">{interviewAnswers[q.id]}</span>
                        </div>
                      ))}
                    </div>
                    <p className={`text-[11px] ${theme.subText}`}>⚠️ ผลลัพธ์เป็นเพียงข้อเสนอแนะ ผู้ตัดสินใจคือพยาบาล/เจ้าหน้าที่</p>
                    <div className="flex justify-end gap-2 pt-2">
                      <button onClick={() => { setInterviewStep(0); setInterviewAnswers({}); }} className="px-4 py-2 rounded-xl border text-slate-500">ถามใหม่</button>
                      <button
                        onClick={() => {
                          setTriageLevel(res.level);
                          setInterviewOpen(false);
                          handleRunAiSymptomChecker(interviewAnswers);
                        }}
                        className="px-5 py-2 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700"
                      >
                        นำผลไปวิเคราะห์อาการ & แนะนำยา
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
