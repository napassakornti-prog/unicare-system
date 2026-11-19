import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, ClipboardPlus, Pill, Upload, Users, BarChart3, Bot, Settings, Activity,
  AlertTriangle, Search, CheckCircle2, AlertCircle, X, Plus, Bed, ShieldCheck,
  FileSpreadsheet as SheetIcon, Sun, Moon, Sparkles, ShieldAlert, RefreshCw, ChevronRight,
  GraduationCap, MessageCircleQuestion, LogOut, Trash2, Clock, RotateCcw, Database,
  UserCheck, Briefcase, Award, HeartHandshake, Check, Bell, Send, Cloud, Copy,
  ArrowRight, ArrowLeft, Stethoscope, User, Lock, ExternalLink, Inbox, Siren,
  Menu, ChevronLeft, Eye, PanelLeftClose, PanelLeftOpen, Phone, MapPin, Wifi
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
  syncLocalToSupabase,  SUPABASE_SCHEMA_SQL,
  pushBeds, pushMedicines, fetchBeds, fetchMedicines
} from './supabase';
import AiChat from './components/AiChat';
import Reports from './components/Reports';
import StudentPortal from './components/StudentPortal';
import LoginPage from './components/LoginPage';
import RequestsAdmin from './components/RequestsAdmin';
import { AuthUser, LoginRole, initAuth, signInWithGoogle, signOutUser, emailToId, getVisibleAdminEmails, getLocalAdminEmails, saveLocalAdminEmails, ALLOWED_DOMAIN, isAdminEmail, setSelectedLoginRole, getRoleLabel } from './auth';
import { Req, REQ_STATUS, useRequests, createRequest, updateRequest } from './requests';

// เสียงเตือนเมื่อมีการเรียกฉุกเฉิน
const playAlarm = () => {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    [0, 0.35, 0.7].forEach(d => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = 880; g.gain.value = 0.2;
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.22);
    });
  } catch {}
};

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('unicare_sidebar_collapsed');
      if (saved !== null) return saved === '1';
    } catch {}
    return typeof window !== 'undefined' && window.innerWidth < 1024;
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem('unicare_sidebar_collapsed', sidebarCollapsed ? '1' : '0');
    } catch {}
  }, [sidebarCollapsed]);
  const [studentSearch, setStudentSearch] = useState('');
  const [detailStudent, setDetailStudent] = useState<any | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [settingsSubTab, setSettingsSubTab] = useState<'general' | 'admins' | 'import'>('general');

  // ---------- การยืนยันตัวตน (Google ด้วยอีเมลมหาวิทยาลัยเท่านั้น) ----------
  const [session, setSession] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNonce, setAuthNonce] = useState(0);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    setAuthReady(false);
    return initAuth(
      u => { setSession(u); setAuthReady(true); setLoginLoading(false); if (u) setAuthError(''); },
      msg => setAuthError(msg)
    );
  }, [authNonce]);

  // 'landing' = หน้าเข้าสู่ระบบ, 'staff' = เจ้าหน้าที่/แอดมิน, 'student' = นักศึกษา/อาจารย์/บุคลากร
  const portalMode: 'landing' | 'staff' | 'student' = !session ? 'landing' : session.role === 'admin' ? 'staff' : 'student';

  useEffect(() => {
    // รอให้ตรวจ session เสร็จก่อน ไม่เช่นนั้นจะเขียนทับ URL (/admin, #access_token) เป็น '/' ตั้งแต่ตอนเปิดหน้า
    if (!authReady) return;
    const target = portalMode === 'staff' ? '/admin' : portalMode === 'student' ? '/portal' : '/';
    if (window.location.pathname !== target) window.history.replaceState({}, '', target);
  }, [portalMode, authReady]);

  const handleGoogleLogin = async (role: LoginRole = 'student') => {
    setAuthError('');
    setLoginLoading(true);
    const err = await signInWithGoogle(role);
    if (err) { setAuthError(err); setLoginLoading(false); }
  };

  const handleSwitchRole = (newRole: LoginRole) => {
    if (!session) return;
    if (newRole === 'admin' && !isAdminEmail(session.email)) return;
    setSelectedLoginRole(newRole);
    setSession({
      ...session,
      userType: newRole,
      role: newRole === 'admin' ? 'admin' : 'user',
    });
  };

  const handleSignOut = async () => {
    await signOutUser();
    setSession(null);
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
      return saved !== null ? JSON.parse(saved).map((m: any) => ({ ...m, en: m.en ?? INITIAL_MEDICINES.find(i => i.name === m.name)?.en ?? '' })) : INITIAL_MEDICINES;
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

  // ---------- คำขอจากผู้ใช้ (จองเตียง / ขอยา / แจ้งแพ้ยา / เรียกฉุกเฉิน) ----------
  const { requests, loaded: reqLoaded, refresh: refreshRequests } = useRequests(!!session);
  const myRequests = requests.filter(r => !!session && r.email === session.email);
  const pendingRequestCount = requests.filter(r => r.status === REQ_STATUS.PENDING).length;
  const pendingEmergencies = requests.filter(r => r.type === 'emergency' && r.status === REQ_STATUS.PENDING);
  const seenReqIds = useRef<Set<string> | null>(null);
  const [flash, setFlash] = useState<{ title: string; message: string; type: string } | null>(null);
  const [adminEmails, setAdminEmails] = useState<string[]>(() => getLocalAdminEmails());
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [newBedName, setNewBedName] = useState('');

  // แจ้งเตือนฝั่งเจ้าหน้าที่เมื่อมีคำขอใหม่ (ฉุกเฉินมีเสียงเตือน)
  useEffect(() => {
    if (portalMode !== 'staff' || !reqLoaded) return;
    if (seenReqIds.current === null) {
      seenReqIds.current = new Set(requests.map(r => r.id));
      return;
    }
    const labels: Record<string, string> = { bed: 'จองเตียง', medicine: 'ขอยา', allergy: 'แจ้งประวัติแพ้ยา', emergency: 'เรียกฉุกเฉิน' };
    requests.filter(r => !seenReqIds.current!.has(r.id)).forEach(r => {
      seenReqIds.current!.add(r.id);
      if (r.type === 'emergency') {
        addToast('🚨 เรียกฉุกเฉิน', `${r.name} กดเรียกขอความช่วยเหลือ`, 'error');
        playAlarm();
      } else {
        addToast('มีคำขอใหม่', `${r.name} ส่งคำขอ${labels[r.type] || ''}`, 'warning');
      }
    });
  }, [requests, reqLoaded, portalMode]);

  // ฝั่งผู้ใช้: ดึงสถานะเตียงและรายการยาจากฐานข้อมูลคลาวด์
  const [remoteBeds, setRemoteBeds] = useState<any[] | null>(null);
  const [remoteMeds, setRemoteMeds] = useState<any[] | null>(null);
  useEffect(() => {
    if (portalMode !== 'student') return;
    let alive = true;
    const load = async () => {
      const [b, m] = await Promise.all([fetchBeds(), fetchMedicines()]);
      if (!alive) return;
      if (b) setRemoteBeds(b);
      if (m) setRemoteMeds(m);
    };
    load();
    const t = setInterval(load, 6000);
    return () => { alive = false; clearInterval(t); };
  }, [portalMode]);

  // ฝั่งเจ้าหน้าที่: ส่งสถานะเตียง/ยาขึ้นคลาวด์อัตโนมัติ เพื่อให้พอร์ทัลผู้ใช้เห็นข้อมูลล่าสุด
  useEffect(() => {
    if (portalMode !== 'staff' || !getSupabaseConfig().url) return;
    const t = setTimeout(() => { pushBeds(beds); }, 1200);
    return () => clearTimeout(t);
  }, [beds, portalMode]);
  useEffect(() => {
    if (portalMode !== 'staff' || !getSupabaseConfig().url) return;
    const t = setTimeout(() => { pushMedicines(medicines); }, 1200);
    return () => clearTimeout(t);
  }, [medicines, portalMode]);

  const nowTime = () => new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.';

  const allergiesByEmail = (email: string): string[] => {
    const fromStudents = students.find(s => s.id === emailToId(email))?.allergies || [];
    const fromReqs = requests
      .filter(q => q.type === 'allergy' && q.email === email && q.status !== REQ_STATUS.REJECTED)
      .map(q => q.payload?.drugName).filter(Boolean);
    return Array.from(new Set([...fromStudents, ...fromReqs]));
  };

  const handleCreateRequest = async (type: Req['type'], payload: any) => {
    if (!session) return;
    await createRequest({ type, email: session.email, name: session.name, role: getRoleLabel(session.userType), payload });
    refreshRequests();
  };

  const approveBedRequest = async (r: Req, bedId: string) => {
    const bed = beds.find(b => b.id === bedId);
    if (!bed || bed.status !== 'available') {
      addToast('เตียงไม่ว่าง', 'กรุณาเลือกเตียงที่ว่างอยู่', 'warning');
      return;
    }
    setBeds(prev => prev.map(b => b.id === bedId ? {
      ...b, status: 'occupied', studentId: emailToId(r.email), studentName: r.name,
      symptom: r.payload?.symptom || '-', timeIn: nowTime(), requestId: r.id,
    } : b));
    await updateRequest(r.id, { status: REQ_STATUS.APPROVED, payload: { ...r.payload, bedId, bedName: bed.name } });
    refreshRequests();
    addToast('อนุมัติการจองเตียง', `จัด ${bed.name} ให้ ${r.name} แล้ว`);
  };

  const finishBedRequest = async (r: Req) => {
    const bedId = r.payload?.bedId;
    if (bedId) {
      setBeds(prev => prev.map(b => b.id === bedId ? {
        ...b, status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null, requestId: null,
      } : b));
    }
    await updateRequest(r.id, { status: REQ_STATUS.DONE });
    refreshRequests();
    addToast('จำหน่ายผู้ป่วยแล้ว', `${r.payload?.bedName || 'เตียง'} ว่างพร้อมใช้งาน`);
  };

  const approveMedicineRequest = async (r: Req) => {
    const items: any[] = r.payload?.items || [];
    for (const i of items) {
      const med = medicines.find(m => m.id === i.id || m.name === i.name);
      if (!med || med.stock < i.qty) {
        addToast('สต็อกไม่เพียงพอ', `${i.name} คงเหลือไม่พอสำหรับคำขอนี้`, 'error');
        return;
      }
    }
    const known = allergiesByEmail(r.email);
    for (const i of items) {
      const w = checkDrugAllergy(i.name + ' ' + (i.en || ''), known);
      if (w && !window.confirm('⚠️ ' + i.name + ': ' + w.message + '\nยืนยันอนุมัติหรือไม่?')) return;
    }
    setMedicines(prev => prev.map(m => {
      const it = items.find(i => i.id === m.id || i.name === m.name);
      if (!it) return m;
      const stock = m.stock - it.qty;
      return { ...m, stock, status: getStockStatus({ stock, min: m.min }) };
    }));
    await updateRequest(r.id, { status: REQ_STATUS.APPROVED, adminNote: 'อนุมัติแล้ว กรุณารับยาที่ห้องพยาบาล' });
    refreshRequests();
    addToast('อนุมัติคำขอยา', `ตัดสต็อกยาให้ ${r.name} แล้ว`);
  };

  const approveAllergyRequest = async (r: Req) => {
    const id = emailToId(r.email);
    const p = r.payload || {};
    const severe = String(p.severity || '').includes('รุนแรงมาก');
    const detail = { drugName: p.drugName, drugFamily: p.drugFamily, reaction: p.reaction, severity: p.severity, verified: true, source: 'student' };
    setStudents(prev => {
      const ex = prev.find(s => s.id === id);
      if (ex) {
        return prev.map(s => s.id === id ? {
          ...s,
          allergies: Array.from(new Set([...(s.allergies || []), p.drugName])),
          allergyReaction: p.reaction || s.allergyReaction,
          severeAllergies: s.severeAllergies || severe,
          allergyDetails: [...(s.allergyDetails || []), detail],
        } : s);
      }
      return [...prev, {
        id, role: 'นักศึกษา', name: r.name, firstName: r.name, lastName: '', faculty: '', department: '', year: '',
        blood: 'ไม่ระบุ', phone: '', allergies: [p.drugName], allergyReaction: p.reaction || '',
        severeAllergies: severe, allergyDetails: [detail], visitsCount: 0,
      }];
    });
    await updateRequest(r.id, { status: REQ_STATUS.APPROVED });
    refreshRequests();
    addToast('ยืนยันประวัติแพ้ยา', `บันทึก ${p.drugName} ของ ${r.name} เข้าระบบแล้ว`);
  };

  const rejectRequest = async (r: Req, note: string) => {
    await updateRequest(r.id, { status: REQ_STATUS.REJECTED, adminNote: note });
    refreshRequests();
    addToast('ปฏิเสธคำขอแล้ว', r.name);
  };

  const setRequestStatus = async (r: Req, status: string) => {
    await updateRequest(r.id, { status });
    refreshRequests();
  };

  const handleAddBed = () => {
    const maxNo = beds.reduce((mx, b) => Math.max(mx, parseInt(String(b.id).replace(/\D/g, '')) || 0), 0);
    const id = 'BED-' + String(maxNo + 1).padStart(2, '0');
    const name = newBedName.trim() || ('เตียง ' + (beds.length + 1));
    setBeds(prev => [...prev, { id, name, status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null }]);
    setNewBedName('');
    addToast('เพิ่มเตียงสำเร็จ', name + ' พร้อมใช้งาน');
  };

  const handleRemoveBed = (bedId: string) => {
    const b = beds.find(x => x.id === bedId);
    if (!b) return;
    if (b.status === 'occupied') {
      addToast('ลบเตียงไม่ได้', 'เตียงนี้มีผู้ป่วยอยู่ กรุณาจำหน่ายก่อน', 'warning');
      return;
    }
    if (!window.confirm('ต้องการลบ ' + b.name + ' ออกจากระบบหรือไม่?')) return;
    setBeds(prev => prev.filter(x => x.id !== bedId));
    addToast('ลบเตียงแล้ว', b.name);
  };

  const handleAddAdminEmail = () => {
    const e = adminEmailInput.trim().toLowerCase();
    if (!e.endsWith('@' + ALLOWED_DOMAIN)) {
      addToast('อีเมลไม่ถูกต้อง', 'ต้องเป็นอีเมล @' + ALLOWED_DOMAIN + ' เท่านั้น', 'warning');
      return;
    }
    const next = Array.from(new Set([...adminEmails, e]));
    saveLocalAdminEmails(next);
    setAdminEmails(next);
    setAdminEmailInput('');
    addToast('เพิ่มผู้ดูแลระบบแล้ว', e);
  };

  const handleRemoveAdminEmail = (e: string) => {
    const next = adminEmails.filter(x => x !== e);
    saveLocalAdminEmails(next);
    setAdminEmails(next);
  };

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
    setFlash({ title, message, type });
    setTimeout(() => setFlash(null), 4000);
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
  const emptyNewMed = { name: '', en: '', category: MEDICINE_CATEGORIES[0], unit: MEDICINE_UNITS[0], stock: '0', min: '20', lot: '', expiry: '' };
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
      id, name, en: newMed.en.trim(), category: newMed.category, unit: newMed.unit, stock, min,
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

  // เมนูนำทางด้านซ้าย แบ่งเป็น 3 หมวดหมู่ตามมาตรฐาน HIS
  const navGroups = [
    {
      title: 'งานบริการผู้ป่วย',
      items: [
        { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
        { id: 'requests', label: 'คำขอออนไลน์', icon: Inbox, badge: pendingRequestCount },
        { id: 'visit-record', label: 'บันทึกการรักษา', icon: ClipboardPlus },
        { id: 'students', label: 'ทะเบียนผู้ป่วย & แพ้ยา', icon: Users, badge: pendingAllergyCount },
      ],
    },
    {
      title: 'คลังและรายงาน',
      items: [
        { id: 'inventory', label: 'สต็อกยา & เวชภัณฑ์', icon: Pill, badge: lowStockMeds.length },
        { id: 'reports', label: 'รายงาน & สถิติ', icon: BarChart3 },
      ],
    },
    {
      title: 'ทั่วไป',
      items: [
        { id: 'settings', label: 'ตั้งค่าระบบ', icon: Settings },
      ],
    },
  ];
  const navItems = navGroups.flatMap(g => g.items);

  const theme = {
    bg: darkMode ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-800',
    sidebar: darkMode ? 'bg-slate-900/90 border-slate-800/80' : 'bg-white border-slate-200 shadow-sm',
    sidebarHeader: darkMode ? 'border-slate-800/80' : 'border-slate-200',
    header: darkMode ? 'bg-slate-900/40 border-slate-800/80' : 'bg-white/80 border-slate-200 shadow-sm',
    card: darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-slate-200 shadow-sm shadow-slate-200/40',
    cardInner: darkMode ? 'bg-slate-950 border-slate-800' : 'bg-slate-50/80 border-slate-200',
    subText: darkMode ? 'text-slate-400' : 'text-slate-600',
    heading: darkMode ? 'text-white' : 'text-slate-900',
    inputBg: darkMode ? 'bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-500' : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400',
    tableHeader: darkMode ? 'border-slate-800 text-slate-300 bg-slate-900/90 font-bold' : 'border-slate-200 text-slate-700 bg-slate-100/90 font-bold',
    modalBg: darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-2xl',
  };

  // =========================================================================
  // VIEW A: LOGIN (เข้าสู่ระบบด้วย Google อีเมลมหาวิทยาลัยเท่านั้น)
  // =========================================================================
  if (portalMode === 'landing') {
    const cfg = getSupabaseConfig();
    // ระหว่างตรวจ session ที่ค้างอยู่ ให้แสดงหน้าโหลด แทนการแสดงหน้า Login ชั่วคราว
    if (!authReady && cfg.url) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-900 via-teal-700 to-teal-400">
          <div className="flex flex-col items-center gap-3 text-white">
            <Activity size={36} className="animate-pulse" />
            <p className="text-sm font-semibold">กำลังตรวจสอบการเข้าสู่ระบบ...</p>
          </div>
        </div>
      );
    }
    return (
      <LoginPage
        darkMode={darkMode}
        onToggleDark={() => setDarkMode(!darkMode)}
        onGoogle={handleGoogleLogin}error={authError}
        loading={loginLoading || (!authReady && !!cfg.url)}
        configured={!!(cfg.url && cfg.key)}/>
    );
  }

  // =========================================================================
  // VIEW B: PORTAL นักศึกษา / อาจารย์ / บุคลากร
  // =========================================================================
  if (portalMode === 'student' && session) {
    return (
      <div className={`min-h-screen flex flex-col transition-colors duration-300 ${theme.bg}`}>
        <header className={`h-16 border-b px-4 sm:px-6 lg:px-8 flex items-center justify-between backdrop-blur-md ${theme.header}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-sky-500 flex items-center justify-center text-white shadow-md">
              <GraduationCap size={20} />
            </div>
            <div>
              <span className={`font-black text-sm tracking-tight ${theme.heading}`}>UniCare</span>
              <p className={`text-[10px] ${theme.subText}`}>ระบบห้องพยาบาล ม.กาฬสินธุ์</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-xl border text-xs font-semibold ${darkMode ? 'bg-slate-900 border-slate-800 text-amber-400' : 'bg-white border-slate-200 text-slate-700'}`}
            >
              {darkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>
            <div className="hidden sm:flex items-center gap-2">
              {session.avatar ? (
                <img src={session.avatar} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold">{session.name.charAt(0)}</div>
              )}
              <div className="leading-tight">
                <p className={`text-xs font-bold ${theme.heading}`}>{session.name}</p>
                <p className={`text-[10px] ${theme.subText}`}>{session.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 font-semibold"
            >
              <LogOut size={13} /> ออกจากระบบ
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 w-full">
          <StudentPortal
            user={session}
            theme={theme}
            beds={remoteBeds ?? beds}
            medicines={remoteMeds ?? medicines}
            myRequests={myRequests}
            onCreate={handleCreateRequest}
            addToast={addToast}
          />
        </main>

        {flash && (
          <div className={`fixed bottom-6 right-6 z-50 max-w-sm p-4 rounded-2xl border shadow-2xl text-xs ${theme.modalBg} ${flash.type === 'error' ? 'border-rose-500' : flash.type === 'warning' ? 'border-amber-500' : 'border-emerald-500'}`}>
            <p className={`font-bold ${theme.heading}`}>{flash.title}</p>
            <p className={theme.subText}>{flash.message}</p>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW C: NURSING STAFF & ADMIN DASHBOARD (มุมมองเจ้าหน้าที่ห้องพยาบาล)
  // =========================================================================
  return (
    <div className={`flex h-[100dvh] font-sans overflow-hidden transition-colors duration-300 ${theme.bg}`}>

      {/* MOBILE SLIDE-OUT DRAWER (< 1024px) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className={`relative w-72 max-w-[82vw] h-full border-r flex flex-col z-10 shadow-2xl ${theme.sidebar}`}>
            <div className={`h-16 flex items-center px-5 border-b justify-between ${theme.sidebarHeader}`}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-sky-500 flex items-center justify-center text-white shadow-md shrink-0">
                  <Activity size={20} className="stroke-[2.5]" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-base font-bold tracking-tight ${theme.heading}`}>UniCare</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30">HIS</span>
                  </div>
                  <p className={`text-[10px] truncate ${theme.subText}`}>ระบบห้องพยาบาล ม.กาฬสินธุ์</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label="ปิดเมนู"
              >
                <X size={20} />
              </button>
            </div>

            <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto custom-scrollbar">
              {navGroups.map(group => (
                <div key={group.title} className="space-y-1">
                  <p className={`px-3 text-[10px] font-bold uppercase tracking-wider ${theme.subText}`}>{group.title}</p>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                        className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                          isActive
                            ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'
                            : darkMode
                              ? 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={18} className={isActive ? 'text-white' : ''} />
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
                </div>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
              <div className={`px-3 py-2 rounded-xl border text-[11px] flex items-center justify-between gap-2 ${theme.cardInner}`}>
                <span className="flex items-center gap-1.5 font-semibold truncate">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${supabaseStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                  {supabaseStatus === 'connected' ? 'Cloud Sync' : 'LocalDB'}
                </span>
                <button
                  onClick={() => { setMobileMenuOpen(false); setBedManagementModal(true); }}
                  className="font-bold text-teal-600 dark:text-teal-400 shrink-0"
                >
                  เตียงว่าง {availableBedsCount}/{beds.length}
                </button>
              </div>
              {session && (
                <div className="flex items-center gap-2.5">
                  {session.avatar ? (
                    <img src={session.avatar} alt="" className="w-9 h-9 rounded-full shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold shrink-0">{session.name.charAt(0)}</div>
                  )}
                  <div className="min-w-0 leading-tight">
                    <p className={`text-xs font-bold truncate ${theme.heading}`}>{session.name}</p>
                    <p className={`text-[10px] truncate ${theme.subText}`}>{session.email}</p>
                  </div>
                </div>
              )}
              <button
                onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400 text-xs font-bold"
              >
                <LogOut size={15} /> ออกจากระบบ
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* DESKTOP COLLAPSIBLE SIDEBAR (>= 1024px) */}
      <aside className={`hidden md:flex ${sidebarCollapsed ? 'w-20' : 'w-64'} border-r flex-col shrink-0 z-20 backdrop-blur-md transition-all duration-300 ${theme.sidebar}`}>
        <div className={`h-20 flex items-center ${sidebarCollapsed ? 'px-3 justify-center' : 'px-5 justify-start'} border-b ${theme.sidebarHeader}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-sky-500 flex items-center justify-center text-white shadow-lg shadow-teal-500/20 font-bold shrink-0">
              <Activity size={22} className="stroke-[2.5]" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-lg font-bold tracking-tight ${theme.heading}`}>UniCare</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30">HIS</span>
                </div>
                <p className={`text-[11px] truncate ${theme.subText}`}>ระบบห้องพยาบาล ม.กาฬสินธุ์</p>
              </div>
            )}
          </div>
        </div>

        {/* Menu Navigation (3 หมวดหมู่) */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto custom-scrollbar">
          {navGroups.map((group, gIdx) => (
            <div key={group.title} className="space-y-1">
              {sidebarCollapsed ? (
                gIdx > 0 && <div className="my-2 border-t border-slate-200 dark:border-slate-800" />
              ) : (
                <p className={`px-3 pb-1 text-[10px] font-bold uppercase tracking-wider ${theme.subText}`}>{group.title}</p>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    title={sidebarCollapsed ? `${item.label}${item.badge ? ` (${item.badge})` : ''}` : undefined}
                    className={`relative w-full flex items-center ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'justify-between px-3.5 py-2.5'} rounded-xl text-xs font-semibold transition-all ${
                      isActive 
                        ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/20' 
                        : darkMode 
                          ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60' 
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon size={18} className={`shrink-0 ${isActive ? 'text-white' : ''}`} />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {item.badge !== undefined && item.badge > 0 && (
                      sidebarCollapsed ? (
                        <span className="absolute top-1.5 right-1.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-500 text-white text-[9px] font-black flex items-center justify-center">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          isActive ? 'bg-white text-teal-700' : 'bg-rose-500 text-white'
                        }`}>
                          {item.badge}
                        </span>
                      )
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom Nurse Station Status Widget */}
        {!sidebarCollapsed ? (
          <div className={`mx-3 mb-3 p-3 rounded-2xl border space-y-2 text-[11px] ${theme.cardInner}`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`font-bold flex items-center gap-1.5 truncate ${theme.heading}`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${supabaseStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                สถานะห้องพยาบาล
              </span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                supabaseStatus === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}>
                {supabaseStatus === 'connected' ? 'Cloud Sync' : 'LocalDB'}
              </span>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className={theme.subText}>เตียงพร้อมใช้:</span>
                <button
                  onClick={() => setBedManagementModal(true)}
                  className="font-bold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  {availableBedsCount}/{beds.length} เตียง
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className={theme.subText}>จุดบริการ:</span>
                <span className={`font-medium truncate ${theme.heading}`}>อาคารกิจการฯ ชั้น 1</span>
              </div>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setBedManagementModal(true)}
            className={`mx-auto mb-2 w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${theme.cardInner}`}
            title={`สถานะ: ${supabaseStatus === 'connected' ? 'Cloud Sync' : 'LocalDB'} | เตียงว่าง ${availableBedsCount}/${beds.length}`}
          >
            <span className={`w-2.5 h-2.5 rounded-full ${supabaseStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          </button>
        )}

        {/* Sidebar Footer (Profile + Bottom Collapse Toggle) */}
        <div className="p-3.5 border-t border-slate-200 dark:border-slate-800">
          {!sidebarCollapsed ? (
            <div className="flex items-center justify-between gap-2">
              {session ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  {session.avatar ? (
                    <img src={session.avatar} alt="" className="w-9 h-9 rounded-full shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold shrink-0">{session.name.charAt(0)}</div>
                  )}
                  <div className="min-w-0 leading-tight">
                    <p className={`text-xs font-bold truncate ${theme.heading}`}>{session.name}</p>
                    <p className={`text-[10px] truncate ${theme.subText}`}>{session.email}</p>
                  </div>
                </div>
              ) : (
                <div />
              )}
              <button
                onClick={() => setSidebarCollapsed(true)}
                className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 transition-all ${darkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                title="พับแถบเมนูด้านซ้าย"
                aria-label="พับแถบเมนูด้านซ้าย"
              >
                <PanelLeftClose size={16} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2.5">
              {session && (
                <div title={`${session.name} (${session.email})`}>
                  {session.avatar ? (
                    <img src={session.avatar} alt="" className="w-9 h-9 rounded-full shrink-0" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold shrink-0">{session.name.charAt(0)}</div>
                  )}
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed(false)}
                className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${darkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                title="กางแถบเมนูด้านซ้าย"
                aria-label="กางแถบเมนูด้านซ้าย"
              >
                <PanelLeftOpen size={16} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER BAR */}
        <header className={`h-16 lg:h-20 border-b flex items-center justify-between px-3 sm:px-6 lg:px-8 z-10 backdrop-blur-md transition-colors duration-300 gap-2 ${theme.header}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className={`md:hidden w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-all ${
                darkMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-slate-200 text-slate-700 shadow-sm'
              }`}
              aria-label="เปิดเมนูนำทาง"
            >
              <Menu size={20} />
            </button>
            <div className="min-w-0">
              <h2 className={`font-black text-base sm:text-xl tracking-tight truncate ${theme.heading}`}>
                {navItems.find(n => n.id === activeTab)?.label || 'ห้องพยาบาล'}
              </h2>
              {session && (
                <p className={`md:hidden text-[10px] truncate ${theme.subText}`}>
                  เจ้าหน้าที่: {session.name}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* ปุ่มดูสถานะเตียงว่าง */}
            <button
              onClick={() => setBedManagementModal(true)}
              className={`min-h-[42px] flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all ${
                availableBedsCount > 0 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20'
              }`}
              title="จัดการเตียงพักฟื้น"
            >
              <Bed size={16} className="shrink-0" />
              <span className="hidden sm:inline">เตียงว่าง:</span>
              <strong className="font-bold">{availableBedsCount}/{beds.length}</strong>
            </button>

            {/* ไอคอนแจ้งเตือน (Notification Bell) */}
            <div className="relative">
              <button
                onClick={() => { setShowNotifPanel(!showNotifPanel); if (!showNotifPanel) markAllNotifsRead(); }}
                className={`relative w-11 h-11 rounded-xl border flex items-center justify-center text-xs font-semibold transition-all ${
                  darkMode 
                    ? 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800' 
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
                }`}
                title="แจ้งเตือน"
              >
                <Bell size={16} />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-rose-500 text-white text-[10px] font-black border-2 border-white dark:border-slate-900 animate-bounce">
                    {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Notification Dropdown Panel */}
              {showNotifPanel && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowNotifPanel(false)} />
                  <div className={`fixed sm:absolute right-3 sm:right-0 top-16 sm:top-12 z-40 w-[calc(100vw-1.5rem)] sm:w-80 max-h-96 rounded-2xl border shadow-2xl overflow-hidden ${theme.modalBg}`}>
                    <div className={`sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b ${darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
                      <span className={`text-xs font-bold ${theme.heading}`}>แจ้งเตือน {notifications.length > 0 ? `(${notifications.length})` : ''}</span>
                      <div className="flex gap-2 items-center">
                        {notifications.length > 0 && (
                          <button onClick={clearNotifications} className="text-[10px] text-rose-500 hover:underline font-semibold">ล้างทั้งหมด</button>
                        )}
                        <button onClick={() => setShowNotifPanel(false)} className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
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
              className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xs font-semibold transition-all ${
                darkMode 
                  ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
              }`}
              title="สลับโหมดมืด/สว่าง"
            >
              {darkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
            </button>

            {/* ปุ่มออกจากระบบ */}
            <button
              onClick={handleSignOut}
              className={`w-11 h-11 rounded-xl border flex items-center justify-center text-xs font-semibold transition-all ${
                darkMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-slate-200 text-slate-600'
              } hover:text-rose-500`}
              title="ออกจากระบบ"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {pendingEmergencies.length > 0 && (
          <div className="px-4 sm:px-8 py-2.5 bg-rose-600 text-white flex flex-wrap items-center justify-between gap-2 animate-pulse">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-black">
              <Siren size={18} className="shrink-0" />
              <span>เรียกฉุกเฉิน {pendingEmergencies.length} รายการ: {pendingEmergencies.map(e => e.name).join(', ')}</span>
            </div>
            <button onClick={() => setActiveTab('requests')} className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-white text-rose-600 text-xs font-bold">ดูรายละเอียด</button>
          </div>
        )}

        {/* MAIN BODY VIEWS */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-6 lg:p-8 pb-24 custom-scrollbar">
          
          {/* VIEW 1: DASHBOARD (2-Column Split HIS Layout) */}
          {activeTab === 'dashboard' && (() => {
            const allergyStudents = students.filter(s => (s.allergies || []).length > 0);
            const freeBedsList = beds.filter(b => b.status === 'available');
            const quickPendingReqs = requests
              .filter(r => r.status === REQ_STATUS.PENDING || (r.type === 'emergency' && r.status === REQ_STATUS.ACK))
              .sort((a, b) => (a.type === 'emergency' ? -1 : b.type === 'emergency' ? 1 : 0))
              .slice(0, 3);

            return (
            <div className="space-y-5 max-w-[1440px] mx-auto">
              {/* Compact Banner */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-teal-900 to-sky-900 text-white flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 shadow-lg">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2.5 rounded-xl bg-white/10 border border-white/20 shrink-0">
                    <ShieldCheck size={20} className="text-teal-300" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-bold text-xs sm:text-sm truncate">UniCare Intelligent Nursing System — ม.กาฬสินธุ์</h4>
                    <p className="text-[11px] text-teal-200 mt-0.5 line-clamp-1">
                      บันทึกข้อมูลเรียลไทม์ • ตรวจการแพ้ยาและแพ้ข้ามกลุ่มอัตโนมัติ • มาตรฐาน PDPA
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => { resetVisitForm(); setActiveTab('visit-record'); }} 
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-white text-teal-900 font-bold text-xs hover:bg-teal-50 transition-all flex items-center justify-center gap-1.5 shadow-sm shrink-0"
                >
                  <Plus size={15} /> บันทึกการรักษา
                </button>
              </div>

              {/* 4 Compact KPI Metrics */}
              <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className={`p-4 rounded-2xl border transition-all ${theme.card}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.subText}`}>ผู้รับบริการวันนี้</p>
                      <h3 className={`text-2xl sm:text-3xl font-black mt-1 tracking-tight ${theme.heading}`}>{visits.length} <span className={`text-xs font-semibold ${theme.subText}`}>ครั้ง</span></h3>
                    </div>
                    <div className="p-2.5 rounded-xl bg-teal-100 text-teal-800 border border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800 shrink-0">
                      <Users size={18} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-rose-700 dark:text-rose-400 font-bold">
                    <span>ฉุกเฉิน {visits.filter(v => v.triage === 'ฉุกเฉิน').length} • ด่วน {visits.filter(v => v.triage === 'ด่วน').length} ราย</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setBedManagementModal(true)}
                  className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:border-teal-500/40 ${theme.card}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.subText}`}>เตียงพักฟื้นว่าง</p>
                      <h3 className={`text-2xl sm:text-3xl font-black mt-1 tracking-tight ${theme.heading}`}>{availableBedsCount} <span className={`text-xs font-semibold ${theme.subText}`}>/ {beds.length} เตียง</span></h3>
                    </div>
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shrink-0">
                      <Bed size={18} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-teal-700 dark:text-teal-400 font-bold">
                    <span>{beds.filter(b => b.status === 'occupied').length} เตียงกำลังใช้งาน</span>
                    <ChevronRight size={13} />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('inventory')}
                  className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/40 ${theme.card}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.subText}`}>ยาใกล้หมดสต็อก</p>
                      <h3 className={`text-2xl sm:text-3xl font-black mt-1 tracking-tight ${theme.heading}`}>{lowStockMeds.length} <span className={`text-xs font-semibold ${theme.subText}`}>รายการ</span></h3>
                    </div>
                    <div className="p-2.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 shrink-0">
                      <AlertTriangle size={18} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-amber-700 dark:text-amber-400 font-bold">
                    <span className="truncate">{lowStockMeds.length ? `สั่งเพิ่ม: ${lowStockMeds.map(m => m.name.split(' ')[0]).join(', ')}` : 'สต็อกทุกรายการปกติ'}</span>
                    <ChevronRight size={13} className="shrink-0" />
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('students')}
                  className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 hover:border-rose-500/40 ${theme.card}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.subText}`}>ผู้มีประวัติแพ้ยา</p>
                      <h3 className={`text-2xl sm:text-3xl font-black mt-1 tracking-tight ${theme.heading}`}>
                        {allergyStudents.length} <span className={`text-xs font-semibold ${theme.subText}`}>คน</span>
                      </h3>
                    </div>
                    <div className="p-2.5 rounded-xl bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 shrink-0">
                      <ShieldAlert size={18} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] text-rose-700 dark:text-rose-400 font-bold">
                    <span>เฝ้าระวังความปลอดภัยด้านยา</span>
                    <ChevronRight size={13} className="shrink-0" />
                  </div>
                </button>
              </div>

              {/* 2-Column Split HIS Workspace */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* LEFT MAIN COLUMN (68%): Recent Visits */}
                <div className="xl:col-span-8 space-y-5">
                  <div className={`rounded-2xl border p-4 sm:p-5 ${theme.card}`}>
                    <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                      <div className="flex items-center gap-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className={`font-bold text-sm sm:text-base ${theme.heading}`}>รายการผู้รับบริการล่าสุด</h3>
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-100 text-teal-800 border border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800">
                              {visits.length} รายการ
                            </span>
                          </div>
                          <p className={`text-xs mt-0.5 ${theme.subText}`}>ข้อมูลบันทึกจริงจากฐานข้อมูลห้องพยาบาล</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => { resetVisitForm(); setActiveTab('visit-record'); }}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center gap-1 shadow-sm"
                        >
                          <Plus size={14} /> บันทึกใหม่
                        </button>
                        <button
                          onClick={() => setActiveTab('visit-record')}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 flex items-center gap-1"
                        >
                          ดูทั้งหมด <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>

                    {visits.length === 0 ? (
                      <div className="py-12 text-center space-y-2">
                        <p className={`text-sm font-semibold ${theme.heading}`}>ยังไม่มีประวัติการเข้ารับบริการในระบบ</p>
                        <p className={`text-xs ${theme.subText}`}>ไปที่หน้า "บันทึกการรักษา" เพื่อเริ่มลงทะเบียนและบันทึกข้อมูลการรักษา</p>
                      </div>
                    ) : (
                      <>
                        {/* Mobile Visit Cards (< 768px) */}
                        <div className="md:hidden space-y-2.5">
                          {visits.slice(0, 6).map((v) => (
                            <div key={v.id} className={`p-3.5 rounded-xl border text-xs space-y-2 shadow-sm ${theme.cardInner}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className={`font-bold text-sm truncate ${theme.heading}`}>{v.studentName}</p>
                                  <p className="text-[11px] font-mono font-medium text-slate-600 dark:text-slate-400">{v.id} • {v.time} • {v.patientRole || 'นักศึกษา'}</p>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                                  v.triage === 'ฉุกเฉิน' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                                  v.triage === 'ด่วน' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
                                  'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    v.triage === 'ฉุกเฉิน' ? 'bg-rose-600' : v.triage === 'ด่วน' ? 'bg-amber-600' : 'bg-emerald-600'
                                  }`} />
                                  {v.triage}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium">{v.faculty}{v.department ? ` • ${v.department}` : ''}</p>
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800">
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">อาการ: <strong>{v.symptom}</strong></span>
                                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                                  v.status.includes('จำหน่าย')
                                    ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                    : 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                                }`}>{v.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Desktop Table (>= 768px) - 5 Balanced Columns */}
                        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                          <table className="w-full text-left border-collapse text-xs">
                            <thead>
                              <tr className={`border-b ${theme.tableHeader}`}>
                                <th className="py-3 px-3.5 font-bold whitespace-nowrap">รหัส / เวลา</th>
                                <th className="py-3 px-3.5 font-bold">ผู้รับบริการ / คณะ</th>
                                <th className="py-3 px-3.5 font-bold">อาการสำคัญ</th>
                                <th className="py-3 px-3.5 font-bold whitespace-nowrap">Triage</th>
                                <th className="py-3 px-3.5 font-bold text-right whitespace-nowrap">สถานะ</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                              {visits.slice(0, 8).map((v) => (
                                <tr key={v.id} className="hover:bg-teal-50/40 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="py-3 px-3.5 whitespace-nowrap">
                                    <p className="font-mono font-bold text-teal-700 dark:text-teal-400">{v.id}</p>
                                    <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 font-medium">{v.time}</p>
                                  </td>
                                  <td className="py-3 px-3.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className={`font-bold text-sm ${theme.heading}`}>{v.studentName}</span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                                        {v.patientRole || 'นักศึกษา'}
                                      </span>
                                    </div>
                                    <p className="text-[11px] mt-0.5 text-slate-600 dark:text-slate-400 font-medium">
                                      {v.faculty}{v.department ? ` • ${v.department}` : ''}
                                    </p>
                                  </td>
                                  <td className="py-3 px-3.5 max-w-xs">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{v.symptom}</p>
                                    {v.meds && v.meds.length > 0 && (
                                      <p className="text-[11px] truncate text-slate-600 dark:text-slate-400 font-medium">
                                        ยา: <span className="text-teal-700 dark:text-teal-300 font-semibold">{v.meds.join(', ')}</span>
                                      </p>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 whitespace-nowrap">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                                      v.triage === 'ฉุกเฉิน' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                                      v.triage === 'ด่วน' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
                                      'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                    }`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${
                                        v.triage === 'ฉุกเฉิน' ? 'bg-rose-600' : v.triage === 'ด่วน' ? 'bg-amber-600' : 'bg-emerald-600'
                                      }`} />
                                      {v.triage}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3.5 text-right whitespace-nowrap">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                                      v.status.includes('จำหน่าย')
                                        ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                        : 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                                    }`}>
                                      {v.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* RIGHT SIDE OPERATIONS PANEL (32%) */}
                <div className="xl:col-span-4 space-y-4">
                  {/* 1. Live Bed Monitor (2x3 Matrix) */}
                  <div className={`rounded-2xl border p-4 space-y-3 ${theme.card}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className={`font-bold text-sm truncate ${theme.heading}`}>ผังเตียงพักฟื้น</h3>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                          availableBedsCount > 0 
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' 
                            : 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                        }`}>
                          ว่าง {availableBedsCount}/{beds.length}
                        </span>
                      </div>
                      <button
                        onClick={() => setBedManagementModal(true)}
                        className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-0.5 shrink-0"
                      >
                        จัดการเตียง <ChevronRight size={13} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-2 gap-2.5">
                      {beds.map(b => {
                        const occupied = b.status === 'occupied';
                        return (
                          <div
                            key={b.id}
                            className={`p-3 rounded-xl border text-xs transition-all flex flex-col justify-between shadow-xs ${
                              occupied 
                                ? 'bg-rose-50/90 border-rose-200 text-rose-950 dark:bg-rose-950/30 dark:border-rose-800/80 dark:text-rose-200' 
                                : 'bg-emerald-50/80 border-emerald-200 text-emerald-950 dark:bg-emerald-950/30 dark:border-emerald-800/80 dark:text-emerald-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${occupied ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                                <span className="font-bold truncate text-slate-900 dark:text-white">{b.name.replace(/\s*\(.*\)/, '')}</span>
                              </div>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                                occupied 
                                  ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/60 dark:text-rose-200 dark:border-rose-700' 
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-200 dark:border-emerald-700'
                              }`}>
                                {occupied ? 'ไม่ว่าง' : 'ว่าง'}
                              </span>
                            </div>
                            {occupied ? (
                              <div className="mt-2 pt-2 border-t border-rose-200 dark:border-rose-900/60 space-y-1.5">
                                <p className="font-bold text-rose-800 dark:text-rose-300 truncate text-[11px]">{b.studentName}</p>
                                <p className="truncate text-[10px] text-slate-600 dark:text-slate-400 font-medium">{b.symptom || '-'}</p>
                                <button
                                  type="button"
                                  onClick={() => handleDischarge(b.id)}
                                  className="w-full py-1 px-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] transition-all shadow-xs"
                                >
                                  จำหน่าย
                                </button>
                              </div>
                            ) : (
                              <p className="mt-2 text-[10px] truncate text-slate-600 dark:text-slate-400 font-medium">
                                {b.name.match(/\(([^)]+)\)/)?.[1] || 'พร้อมรับผู้ป่วย'}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Clinical Watchlist (Allergy & Low Stock Alerts) */}
                  <div className={`rounded-2xl border p-4 space-y-3 ${theme.card}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-bold text-sm flex items-center gap-1.5 ${theme.heading}`}>
                        <ShieldAlert size={16} className="text-rose-600 shrink-0" />
                        เฝ้าระวังกลุ่มเสี่ยง & ยา
                      </h3>
                      <button
                        onClick={() => setActiveTab('students')}
                        className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:underline flex items-center gap-0.5 shrink-0"
                      >
                        ทะเบียนแพ้ยา <ChevronRight size={13} />
                      </button>
                    </div>

                    {allergyStudents.length === 0 && lowStockMeds.length === 0 ? (
                      <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
                        <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                        <span>ไม่มีรายการเฝ้าระวังเร่งด่วน</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {allergyStudents.slice(0, 4).map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => setDetailStudent(s)}
                            className={`w-full p-2.5 rounded-xl border text-left transition-all hover:border-rose-400 space-y-1.5 shadow-xs ${theme.cardInner}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className={`font-bold text-xs truncate ${theme.heading}`}>{s.name}</span>
                              <span className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-400 shrink-0">{s.id}</span>
                            </div>
                            {s.faculty && <p className="text-[10px] truncate text-slate-600 dark:text-slate-400 font-medium">{s.faculty}</p>}
                            <div className="flex flex-wrap gap-1">
                              {(s.allergies || []).map((alg: string, i: number) => (
                                <span key={i} className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800 text-[10px] font-bold">
                                  แพ้: {alg}
                                </span>
                              ))}
                            </div>
                          </button>
                        ))}

                        {lowStockMeds.length > 0 && (
                          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1">
                                <AlertTriangle size={14} /> ยาใกล้หมดสต็อก ({lowStockMeds.length})
                              </span>
                              <button
                                onClick={() => setActiveTab('inventory')}
                                className="text-[11px] font-bold text-amber-700 dark:text-amber-300 underline"
                              >
                                เติมยา
                              </button>
                            </div>
                            <div className="space-y-1">
                              {lowStockMeds.slice(0, 3).map(m => (
                                <div key={m.id} className="flex justify-between text-[11px]">
                                  <span className="truncate pr-2">{m.name}</span>
                                  <span className="font-mono font-bold text-rose-600 dark:text-rose-400 shrink-0">{m.stock} {m.unit}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 3. Quick Pending Online Requests */}
                  <div className={`rounded-2xl border p-4 space-y-3 ${theme.card}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <h3 className={`font-bold text-sm truncate ${theme.heading}`}>คำขอออนไลน์รอดำเนินการ</h3>
                        {quickPendingReqs.length > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0">
                            {pendingRequestCount}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setActiveTab('requests')}
                        className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-0.5 shrink-0"
                      >
                        ดูทั้งหมด <ChevronRight size={13} />
                      </button>
                    </div>

                    {quickPendingReqs.length === 0 ? (
                      <p className={`text-xs py-2 text-center ${theme.subText}`}>ไม่มีคำขอออนไลน์ค้างอยู่</p>
                    ) : (
                      <div className="space-y-2">
                        {quickPendingReqs.map(r => {
                          const p = r.payload || {};
                          const typeName = r.type === 'emergency' ? 'เรียกฉุกเฉิน' : r.type === 'bed' ? 'จองเตียง' : r.type === 'medicine' ? 'ขอยา' : 'แจ้งแพ้ยา';
                          const detail = r.type === 'bed'
                            ? (p.symptom || p.preferredBedName || 'ขอพักฟื้น')
                            : r.type === 'medicine'
                              ? (p.items || []).map((i: any) => `${i.name} x${i.qty}`).join(', ')
                              : r.type === 'allergy'
                                ? `แพ้ ${p.drugName || '-'}`
                                : (p.message || 'ต้องการความช่วยเหลือด่วน');
                          const chosenBedId = freeBedsList.find(b => b.id === p.preferredBedId)?.id || freeBedsList[0]?.id || '';

                          return (
                            <div key={r.id} className={`p-3 rounded-xl border text-xs space-y-2 ${r.type === 'emergency' ? 'border-rose-500/40 bg-rose-500/5' : theme.cardInner}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    r.type === 'emergency' ? 'bg-rose-600 text-white' : 'bg-teal-500/15 text-teal-700 dark:text-teal-300'
                                  }`}>
                                    {typeName}
                                  </span>
                                  <p className={`font-bold mt-1 truncate ${theme.heading}`}>{r.name}</p>
                                  <p className={`text-[11px] truncate ${theme.subText}`}>{detail}</p>
                                </div>
                              </div>
                              <div className="flex justify-end">
                                {r.type === 'bed' && (
                                  <button
                                    disabled={!chosenBedId}
                                    onClick={() => approveBedRequest(r, chosenBedId)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] disabled:opacity-50"
                                  >
                                    {chosenBedId ? 'อนุมัติเตียง' : 'ไม่มีเตียงว่าง'}
                                  </button>
                                )}
                                {r.type === 'medicine' && (
                                  <button
                                    onClick={() => approveMedicineRequest(r)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                                  >
                                    อนุมัติยา
                                  </button>
                                )}
                                {r.type === 'allergy' && (
                                  <button
                                    onClick={() => approveAllergyRequest(r)}
                                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                                  >
                                    ยืนยันแพ้ยา
                                  </button>
                                )}
                                {r.type === 'emergency' && (
                                  <button
                                    onClick={() => setRequestStatus(r, r.status === REQ_STATUS.ACK ? REQ_STATUS.DONE : REQ_STATUS.ACK)}
                                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px]"
                                  >
                                    {r.status === REQ_STATUS.ACK ? 'เสร็จสิ้น' : 'รับทราบ'}
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            );
          })()}

          {/* VIEW 2: VISIT RECORD (บันทึกการรักษา) */}
          {activeTab === 'visit-record' && (() => {
            const fullNamePreview = `${firstName} ${lastName}`.trim();
            const selectedBedObj = beds.find(b => b.id === assignedBedId);
            const cleanId = patientId.trim().toLowerCase();
            const cleanFirst = firstName.trim().toLowerCase();
            const previousPatientVisits = (cleanId.length >= 2 || cleanFirst.length >= 2)
              ? visits.filter(v =>
                  (cleanId.length >= 2 && String(v.patientId || v.studentId || '').trim().toLowerCase() === cleanId) ||
                  (cleanFirst.length >= 2 && String(v.studentName || '').toLowerCase().includes(cleanFirst))
                ).slice(0, 4)
              : [];

            return (
            <div className="max-w-[1440px] mx-auto space-y-5 sm:space-y-6">
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                <div className={`xl:col-span-8 p-4 sm:p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-5 pb-4 border-b border-slate-200 dark:border-slate-800">
                  <div>
                    <h3 className={`font-bold text-base sm:text-lg ${theme.heading}`}>บันทึกการเข้าใช้บริการห้องพยาบาล</h3>
                    <p className={`text-xs mt-1 ${theme.subText}`}>
                      เพิ่มข้อมูลผู้ป่วย • ตรวจสอบการแพ้ยาอัตโนมัติ • เลือกเตียงพักฟื้น • จ่ายยาและตัดสต็อก • บันทึกลงฐานข้อมูล
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button 
                      onClick={() => setShowPatientSearchModal(true)}
                      className="flex-1 sm:flex-initial min-h-[42px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-semibold hover:bg-teal-500/20"
                    >
                      <Search size={15} /> ค้นหาประวัติเดิม
                    </button>
                    <button 
                      onClick={resetVisitForm}
                      className="min-h-[42px] flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      ล้างฟอร์ม
                    </button>
                  </div>
                </div>

                {/* FORM GRID */}
                <div className="flex flex-col gap-5 sm:gap-6">
                  
                  {/* LEFT COLUMN: ข้อมูลผู้ป่วย + เตียง + ยา */}
                  <div className="contents">
                    
                    {/* 1. ข้อมูลผู้เข้ารับบริการ & ประเภท */}
                    <div className={`order-1 p-4 sm:p-5 rounded-2xl border space-y-4 ${theme.cardInner}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                          <UserCheck size={16} /> 1. ข้อมูลผู้เข้ารับบริการ
                        </span>
                        {patientId.trim().length >= 2 && students.some(s => s.id === patientId.trim()) && (
                          <button
                            onClick={() => {
                              const match = students.find(s => s.id === patientId.trim());
                              if (match) autoFillPatient(match);
                            }}
                            className="min-h-[34px] text-[11px] font-bold text-teal-600 dark:text-teal-400 bg-teal-500/10 hover:bg-teal-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1"
                          >
                            ดึงข้อมูลเดิมจากฐานข้อมูล
                          </button>
                        )}
                      </div>

                      {/* Role Selector: อาจารย์ นักศึกษา เจ้าหน้าที่ บุคลากร */}
                      <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${theme.subText}`}>ประเภทผู้รับบริการ *</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {USER_ROLES.map(role => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => setPatientRole(role)}
                              className={`min-h-[42px] py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center ${
                                patientRole === role
                                  ? 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/20'
                                  : darkMode 
                                    ? 'border-slate-700 text-slate-300 hover:bg-slate-800' 
                                    : 'border-slate-200 text-slate-600 hover:bg-slate-100 bg-white'
                              }`}
                            >
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
                            className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border font-mono ${theme.inputBg}`}
                          />
                        </div>
                        <div>
                          <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>กรุ๊ปเลือด</label>
                          <select 
                            value={bloodGroup}
                            onChange={(e) => setBloodGroup(e.target.value)}
                            className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
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
                            className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
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
                            className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
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
                            className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          >
                            {STANDARD_FACULTIES.map(fac => <option key={fac} value={fac}>{fac}</option>)}
                          </select>
                          {faculty === 'อื่นๆ' && (
                            <input 
                              type="text" 
                              placeholder="ระบุคณะ / สำนัก..."
                              value={customFaculty}
                              onChange={(e) => setCustomFaculty(e.target.value)}
                              className={`w-full min-h-[42px] mt-2 px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
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
                            className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
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
                              className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
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
                            className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          />
                        </div>
                      </div>

                      {/* 2. ประวัติการแพ้ยา & อาการที่แพ้ */}
                      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <label className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <ShieldAlert size={16} /> ประวัติการแพ้ยา & อาการที่แพ้ (ตรวจจับอัตโนมัติ)
                          </label>
                          <span className={`text-[10px] ${theme.subText}`}>พิมพ์ชื่อยาแล้วกดเพิ่ม</span>
                        </div>

                        {/* กล่องพิมพ์ยาที่แพ้ */}
                        <div className="flex flex-col sm:flex-row gap-2">
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
                            className={`flex-1 min-h-[42px] px-3 py-2 text-xs rounded-xl border focus:border-rose-500 ${theme.inputBg}`}
                          />
                          <button
                            type="button"
                            onClick={() => addAllergyTag(allergyInputText)}
                            className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 flex items-center justify-center gap-1 shrink-0"
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
                              className="min-h-[30px] text-[11px] px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                            >
                              + {d}
                            </button>
                          ))}
                        </div>

                        {/* แท็กแสดงยาที่แพ้ */}
                        <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20">
                          {patientAllergies.length === 0 ? (
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">ไม่มีประวัติแพ้ยา (ปลอดภัย)</span>
                          ) : (
                            patientAllergies.map((alg, i) => (
                              <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold shadow-sm">
                                {alg}
                                <button type="button" onClick={() => removeAllergyTag(alg)} className="hover:opacity-75 p-0.5">
                                  <X size={13} />
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
                            className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 3. เลือกเตียงพักฟื้น และดูเตียงที่ว่างเรียลไทม์ */}
                    <div className={`order-3 p-4 sm:p-5 rounded-2xl border space-y-3 ${theme.cardInner}`}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                          <Bed size={16} /> 3. เลือกเตียงพักฟื้น (เรียลไทม์)
                        </span>
                        <span className={`text-xs font-bold px-2.5 py-0.5 rounded-lg ${
                          availableBedsCount > 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600'
                        }`}>
                          ว่าง {availableBedsCount} / {beds.length} เตียง
                        </span>
                      </div>

                      <p className={`text-[11px] ${theme.subText}`}>
                        แตะเลือกเตียงที่ต้องการให้ผู้ป่วยนอนพักฟื้น (ระบบจะอัปเดตผังเตียงและบันทึกลงฐานข้อมูล)
                      </p>

                      {/* ตัวเลือกเตียง Interactive */}
                      <div className="grid grid-cols-1 min-[380px]:grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {/* ไม่นอนเตียง */}
                        <div
                          onClick={() => setAssignedBedId('')}
                          className={`min-h-[64px] p-3 rounded-xl border cursor-pointer transition-all text-xs font-bold flex flex-col justify-between ${
                            assignedBedId === ''
                              ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20'
                              : darkMode ? 'border-slate-800 hover:bg-slate-800 text-slate-300' : 'border-slate-200 hover:bg-slate-100 text-slate-700 bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span>ไม่นอนเตียง</span>
                            {assignedBedId === '' && <Check size={14} className="text-teal-600" />}
                          </div>
                          <span className={`text-[10px] mt-1.5 font-normal ${theme.subText}`}>รับยาแล้วกลับ</span>
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
                              className={`min-h-[64px] p-3 rounded-xl border transition-all text-xs flex flex-col justify-between ${
                                isOccupied 
                                  ? 'opacity-60 cursor-not-allowed bg-rose-500/5 border-rose-500/30' 
                                  : isSelected
                                    ? 'cursor-pointer border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20'
                                    : darkMode 
                                      ? 'cursor-pointer border-slate-800 hover:bg-slate-800 text-slate-300' 
                                      : 'cursor-pointer border-slate-200 hover:bg-slate-100 text-slate-700 bg-white'
                              }`}
                            >
                              <div className="flex justify-between items-center gap-1">
                                <span className="font-bold truncate">{b.name}</span>
                                {isSelected ? (
                                  <Check size={14} className="text-teal-600 shrink-0" />
                                ) : (
                                  <span className={`w-2 h-2 rounded-full shrink-0 ${isOccupied ? 'bg-rose-500' : 'bg-emerald-500'}`}></span>
                                )}
                              </div>
                              <div className="mt-1.5 text-[10px]">
                                {isOccupied ? (
                                  <span className="text-rose-600 dark:text-rose-400 font-bold truncate block">
                                    ไม่ว่าง: {b.studentName}
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    ว่าง (แตะเลือก)
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 4. รายการจ่ายยา & ระบบตรวจสอบการแพ้ยาอัตโนมัติ */}
                    <div className={`order-4 p-4 sm:p-5 rounded-2xl border space-y-3 ${theme.cardInner}`}>
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                          <Pill size={16} /> 4. รายการจ่ายยา & เวชภัณฑ์
                        </span>
                        <span className={`text-[11px] ${theme.subText}`}>ตรวจแพ้ยาตรงและข้ามกลุ่มอัตโนมัติ</span>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          value={dispenseMedId}
                          onChange={(e) => setDispenseMedId(e.target.value)}
                          className={`flex-1 min-w-0 min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                        >
                          <option value="">-- เลือกยา / เวชภัณฑ์ --</option>
                          {medicines.map(m => {
                            const risk = checkDrugAllergy(m.name, patientAllergies);
                            return (
                              <option key={m.id} value={m.id} disabled={m.stock <= 0}>
                                {risk ? '[แพ้ยา] ' : ''}{m.name}{m.en ? ` (${m.en})` : ''} (คงเหลือ {m.stock} {m.unit})
                              </option>
                            );
                          })}
                        </select>
                        <div className="flex gap-2">
                          <input
                            type="number" min={1} value={dispenseQty}
                            onChange={(e) => setDispenseQty(Math.max(1, parseInt(e.target.value) || 1))}
                            className={`w-20 min-h-[42px] px-2 py-2 text-xs rounded-xl border text-center font-bold ${theme.inputBg}`}
                          />
                          <button
                            type="button"
                            onClick={() => { if (dispenseMedId) addMedToDispense(dispenseMedId, dispenseQty); }}
                            className="flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center justify-center gap-1"
                          >
                            <Plus size={14} /> เพิ่มยา
                          </button>
                        </div>
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
                            <div key={d.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs">
                              <span className="font-bold text-emerald-700 dark:text-emerald-300 truncate pr-2">{d.name}</span>
                              <span className="flex items-center gap-3 shrink-0">
                                <span className="font-mono font-bold">{d.qty} {d.unit}</span>
                                <button 
                                  type="button" 
                                  onClick={() => setDispenseList(dispenseList.filter(x => x.id !== d.id))} 
                                  className="p-1 text-rose-500 hover:text-rose-700"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* RIGHT COLUMN: อาการ + AI ช่วยวินิจฉัย + Triage + บันทึก */}
                  <div className="contents">
                    
                    <div className={`order-2 p-4 sm:p-5 rounded-2xl border space-y-4 ${theme.cardInner}`}>
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400 flex items-center gap-1.5">
                        <Activity size={16} /> 2. อาการและการคัดกรอง
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
                                className={`min-h-[34px] text-xs px-2.5 py-1.5 rounded-lg font-medium transition-all text-left ${
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
                          className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                        />
                      </div>

                      {/* ปุ่ม AI ซักประวัติ & วิเคราะห์อาการ */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <button 
                          type="button"
                          onClick={startInterview}
                          className="min-h-[44px] py-2.5 px-3 rounded-xl border-2 border-teal-500 text-teal-700 dark:text-teal-300 font-bold text-xs hover:bg-teal-500/10 flex items-center justify-center gap-1.5"
                        >
                          <MessageCircleQuestion size={16} /> AI ซักประวัติ (5 ข้อ)
                        </button>
                        <button 
                          type="button"
                          onClick={() => handleRunAiSymptomChecker()}
                          disabled={aiAnalyzing}
                          className="min-h-[44px] py-2.5 px-3 rounded-xl bg-gradient-to-r from-teal-600 to-sky-500 text-white font-bold text-xs shadow-lg shadow-teal-500/20 hover:brightness-110 flex items-center justify-center gap-1.5"
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
                              className={`min-h-[42px] py-2 rounded-xl text-xs font-bold border transition-all ${
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
                          className={`w-full min-h-[42px] px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                        />
                      </div>
                    </div>

                    {/* AI Suggestion Box */}
                    {aiSuggestion && (
                      <div className="order-2 p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-2.5 animate-in fade-in-50">
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
                          <div className="text-xs flex flex-wrap gap-1.5 items-center">
                            <span className="font-semibold text-teal-800 dark:text-teal-300">ยาที่แนะนำ: </span>
                            {aiSuggestion.suggestedMeds.map((m: any, i: number) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-teal-500/20">
                                {m.name}
                                {!m.allergy && !m.outOfStock && (
                                  <button 
                                    type="button" 
                                    onClick={() => addMedToDispense(m.name, 1)} 
                                    className="text-[11px] text-teal-600 font-bold underline px-1"
                                  >
                                    +จ่าย
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ปุ่มบันทึกลงฐานข้อมูลหลัก */}
                    <div className="order-5 space-y-2 pt-2">
                      <div className="flex flex-col sm:flex-row gap-2.5">
                        <button
                          type="button"
                          onClick={resetVisitForm}
                          className="min-h-[48px] px-5 py-3 rounded-2xl border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-100 dark:hover:bg-slate-800"
                        >
                          ยกเลิก / ล้างข้อมูล
                        </button>
                        <button 
                          type="button"
                          onClick={handleSaveVisit}
                          className="flex-1 min-h-[48px] py-3.5 px-5 rounded-2xl bg-gradient-to-r from-teal-600 to-sky-500 hover:from-teal-700 hover:to-sky-600 text-white font-bold text-sm shadow-xl shadow-teal-600/25 flex items-center justify-center gap-2 transition-all active:scale-95"
                        >
                          <Database size={18} />
                          <span>บันทึกข้อมูลการรักษาลงฐานข้อมูล</span>
                        </button>
                      </div>
                      <p className={`text-[11px] text-center ${theme.subText}`}>
                        ตัดสต็อกยา • จัดสรรเตียงเรียลไทม์ • บันทึกลงฐานข้อมูลถาวร
                      </p>
                    </div>
                  </div>

                </div>
              </div>

                {/* RIGHT COLUMN (32%): Live Clinical Safety & Assist Panel */}
                <div className="xl:col-span-4 xl:sticky xl:top-4 space-y-4">
                  {/* 1. Safety & Allergy Check Card */}
                  <div className={`p-4 rounded-2xl border space-y-3 ${theme.card}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`font-bold text-sm flex items-center gap-1.5 ${theme.heading}`}>
                        <ShieldCheck size={16} className="text-teal-600 dark:text-teal-400 shrink-0" />
                        ตรวจสอบความปลอดภัยยา
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-500/10 text-teal-600 dark:text-teal-400">
                        Live Check
                      </span>
                    </div>

                    <div className={`p-3 rounded-xl border text-xs ${theme.cardInner}`}>
                      <p className={`font-bold truncate ${theme.heading}`}>
                        {fullNamePreview || 'ยังไม่ระบุชื่อผู้ป่วย'}
                      </p>
                      <p className={`text-[11px] mt-0.5 ${theme.subText}`}>
                        {patientRole} {patientId ? `• ${patientId}` : ''} • เลือดกรุ๊ป {bloodGroup}
                      </p>
                    </div>

                    {patientAllergies.length > 0 ? (
                      <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-2 text-xs">
                        <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                          <ShieldAlert size={15} /> พบประวัติแพ้ยา ({patientAllergies.length} รายการ)
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {patientAllergies.map((alg, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-bold text-[11px]">
                              {alg}
                            </span>
                          ))}
                        </div>
                        {allergyReactionText && (
                          <p className="text-[11px] text-rose-700 dark:text-rose-300">
                            อาการ: <strong>{allergyReactionText}</strong>
                          </p>
                        )}
                        <p className="text-[10px] text-rose-600/90 dark:text-rose-300/90 font-semibold">
                          ระบบจะตรวจสอบและแจ้งเตือนการแพ้ข้ามกลุ่มอัตโนมัติขณะเลือกยา
                        </p>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2">
                        <CheckCircle2 size={15} className="shrink-0" />
                        <span>ยังไม่มีประวัติแพ้ยาในฟอร์มนี้</span>
                      </div>
                    )}

                    {allergyBlock && (
                      <div className="p-3 rounded-xl bg-rose-600 text-white text-xs space-y-1 animate-pulse">
                        <p className="font-black flex items-center gap-1.5">
                          <AlertTriangle size={15} /> ระงับจ่ายยา: {allergyBlock.med}
                        </p>
                        <p className="text-[11px] opacity-95">{allergyBlock.message}</p>
                      </div>
                    )}
                  </div>

                  {/* 2. Live Summary Before Save */}
                  <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${theme.card}`}>
                    <h4 className={`font-bold text-sm ${theme.heading}`}>สรุปรายการก่อนบันทึก</h4>
                    <div className={`p-3 rounded-xl border space-y-2 ${theme.cardInner}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={theme.subText}>ระดับความเร่งด่วน:</span>
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          triageLevel === 'ฉุกเฉิน' ? 'bg-rose-500/15 text-rose-600' :
                          triageLevel === 'ด่วน' ? 'bg-amber-500/15 text-amber-600' :
                          'bg-emerald-500/15 text-emerald-600'
                        }`}>
                          {triageLevel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className={theme.subText}>เตียงพักฟื้น:</span>
                        <span className={`font-semibold text-right ${selectedBedObj ? 'text-teal-600 dark:text-teal-400' : theme.heading}`}>
                          {selectedBedObj ? selectedBedObj.name : 'ไม่นอนเตียง (รับยาแล้วกลับ)'}
                        </span>
                      </div>
                      <div className="flex items-start justify-between gap-2">
                        <span className={`${theme.subText} shrink-0`}>ยาที่จ่าย ({dispenseList.length}):</span>
                        <span className={`text-right font-medium ${theme.heading}`}>
                          {dispenseList.length > 0 ? dispenseList.map(d => `${d.name} x${d.qty}`).join(', ') : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 3. Previous Visits of This Patient */}
                  <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${theme.card}`}>
                    <div className="flex items-center justify-between">
                      <h4 className={`font-bold text-sm ${theme.heading}`}>ประวัติรับบริการเดิม</h4>
                      <span className={`text-[11px] font-mono ${theme.subText}`}>{previousPatientVisits.length} ครั้ง</span>
                    </div>
                    {previousPatientVisits.length === 0 ? (
                      <p className={`text-[11px] py-2 ${theme.subText}`}>
                        {(cleanId.length >= 2 || cleanFirst.length >= 2) ? 'ไม่พบประวัติการมารับบริการครั้งก่อน' : 'พิมพ์รหัสหรือชื่อเพื่อค้นประวัติเดิมอัตโนมัติ'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {previousPatientVisits.map(v => (
                          <div key={v.id} className={`p-2.5 rounded-xl border space-y-1 ${theme.cardInner}`}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold truncate">{v.symptom}</span>
                              <span className={`text-[10px] font-mono shrink-0 ${theme.subText}`}>{v.time}</span>
                            </div>
                            <p className={`text-[10px] truncate ${theme.subText}`}>
                              ยา: {(v.meds || []).join(', ') || '-'} • {v.status}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 4. Quick Bed Matrix */}
                  <div className={`p-4 rounded-2xl border space-y-2.5 text-xs ${theme.card}`}>
                    <div className="flex items-center justify-between">
                      <h4 className={`font-bold text-sm ${theme.heading}`}>ผังเตียงด่วน</h4>
                      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                        ว่าง {availableBedsCount}/{beds.length}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {beds.map(b => {
                        const occupied = b.status === 'occupied';
                        const selected = assignedBedId === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            disabled={occupied}
                            onClick={() => setAssignedBedId(selected ? '' : b.id)}
                            className={`p-2.5 rounded-xl border text-left transition-all text-[11px] ${
                              occupied
                                ? 'opacity-60 cursor-not-allowed bg-rose-500/5 border-rose-500/30'
                                : selected
                                  ? 'border-teal-500 bg-teal-500/15 text-teal-700 dark:text-teal-300 ring-2 ring-teal-500/20 font-bold'
                                  : 'bg-emerald-500/5 border-emerald-500/30 hover:border-teal-500/50'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold truncate">{b.name.replace(/\s*\(.*\)/, '')}</span>
                              <span className={`w-2 h-2 rounded-full shrink-0 ${occupied ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            </div>
                            <p className={`text-[10px] truncate mt-0.5 ${theme.subText}`}>
                              {occupied ? b.studentName : selected ? 'เลือกแล้ว ✓' : 'ว่าง'}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ประวัติการรับบริการทั้งหมดในฐานข้อมูล (Cards on Mobile, Table on Desktop) */}
              <div className={`rounded-2xl border p-4 sm:p-6 ${theme.card}`}>
                <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                  <h3 className={`font-bold text-sm sm:text-base ${theme.heading}`}>
                    ประวัติการเข้ารับบริการทั้งหมด ({visits.length} รายการ)
                  </h3>
                  {visits.length > 0 && (
                    <button
                      onClick={handleResetAllToZero}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg text-xs text-rose-500 hover:bg-rose-500/10 flex items-center gap-1"
                    >
                      <Trash2 size={13} /> ล้างประวัติเป็น 0
                    </button>
                  )}
                </div>

                {visits.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    ยังไม่มีข้อมูลประวัติการรักษา
                  </div>
                ) : (
                  <>
                    {/* Mobile Visit Cards (< 768px) */}
                    <div className="md:hidden space-y-2.5">
                      {visits.map(v => (
                        <div key={v.id} className={`p-3.5 rounded-xl border text-xs space-y-2 ${theme.cardInner}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className={`font-bold text-sm truncate ${theme.heading}`}>{v.studentName}</p>
                              <p className={`text-[11px] font-mono ${theme.subText}`}>{v.id} • {v.time} • {v.patientRole || 'นักศึกษา'}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              v.triage === 'ฉุกเฉิน' ? 'bg-rose-500/10 text-rose-600' :
                              v.triage === 'ด่วน' ? 'bg-amber-500/10 text-amber-600' :
                              'bg-emerald-500/10 text-emerald-600'
                            }`}>
                              {v.triage}
                            </span>
                          </div>
                          <p className={`text-[11px] ${theme.subText}`}>อาการ: <strong className={theme.heading}>{v.symptom}</strong></p>
                          {(v.meds && v.meds.length > 0) && (
                            <p className={`text-[11px] ${theme.subText}`}>ยาที่จ่าย: {v.meds.join(', ')}</p>
                          )}
                          <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-200 dark:border-slate-800 text-[11px]">
                            <span className="text-teal-600 dark:text-teal-400 font-semibold">
                              เตียง: {v.bedId ? beds.find(b => b.id === v.bedId)?.name || v.bedId : 'ไม่ใช้เตียง'}
                            </span>
                            <span className="font-medium">{v.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop Table (>= 768px) */}
                    <div className="hidden md:block overflow-x-auto max-h-96 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className={`border-b ${theme.tableHeader}`}>
                            <th className="py-2.5 px-3 font-bold">รหัส</th>
                            <th className="py-2.5 px-3 font-bold">เวลา</th>
                            <th className="py-2.5 px-3 font-bold">ประเภท</th>
                            <th className="py-2.5 px-3 font-bold">ผู้รับบริการ</th>
                            <th className="py-2.5 px-3 font-bold">คณะ / สาขาวิชา</th>
                            <th className="py-2.5 px-3 font-bold">อาการสำคัญ</th>
                            <th className="py-2.5 px-3 font-bold">Triage</th>
                            <th className="py-2.5 px-3 font-bold">เตียง</th>
                            <th className="py-2.5 px-3 font-bold">ยาที่จ่าย</th>
                            <th className="py-2.5 px-3 font-bold">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {visits.map(v => (
                            <tr key={v.id} className="hover:bg-teal-50/40 dark:hover:bg-slate-800/50 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-teal-700 dark:text-teal-400">{v.id}</td>
                              <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-400 font-medium">{v.time}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                                  {v.patientRole || 'นักศึกษา'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">{v.studentName}</td>
                              <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 font-medium">{v.faculty} {v.department ? `(${v.department})` : ''}</td>
                              <td className="py-2.5 px-3 max-w-xs truncate font-semibold text-slate-800 dark:text-slate-200">{v.symptom}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                                  v.triage === 'ฉุกเฉิน' ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800' :
                                  v.triage === 'ด่วน' ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800' :
                                  'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${
                                    v.triage === 'ฉุกเฉิน' ? 'bg-rose-600' : v.triage === 'ด่วน' ? 'bg-amber-600' : 'bg-emerald-600'
                                  }`} />
                                  {v.triage}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-teal-700 dark:text-teal-400">
                                {v.bedId ? beds.find(b => b.id === v.bedId)?.name || v.bedId : '-'}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{(v.meds || []).join(', ') || '-'}</td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                                  v.status.includes('จำหน่าย')
                                    ? 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                                    : 'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800'
                                }`}>
                                  {v.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
            );
          })()}

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
            <div className="max-w-[1440px] mx-auto space-y-5">
              {/* สรุปภาพรวมสต็อก */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {summaryCards.map(c => {
                  const isSelected = (c.key === 'all' && invFilter === 'all') || c.key === invFilter;
                  return (
                  <button
                    key={c.key}
                    onClick={() => setInvFilter(c.key === 'low' ? 'low' : c.key === 'expiring' ? 'expiring' : 'all')}
                    className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 ${theme.card} ${
                      isSelected ? 'ring-2 ring-teal-500/40 border-teal-500/50' : ''
                    }`}
                  >
                    <p className={`text-[11px] font-semibold ${theme.subText}`}>{c.label}</p>
                    <p className={`text-2xl font-black mt-1 ${c.cls}`}>{c.value}</p>
                    <p className={`text-[10px] ${theme.subText}`}>{c.hint}</p>
                  </button>
                  );
                })}
              </div>

              <div className={`p-4 sm:p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                  <div>
                    <h3 className={`font-bold text-base sm:text-lg ${theme.heading}`}>สต็อกยา & เวชภัณฑ์ห้องพยาบาล</h3>
                    <p className={`text-xs mt-1 ${theme.subText}`}>ตัดสต็อกอัตโนมัติเมื่อจ่ายยา และแจ้งเตือนเมื่อยาเหลือน้อยหรือใกล้หมดอายุ</p>
                  </div>
                  <button
                    onClick={() => setMedFormOpen(true)}
                    className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-md flex items-center justify-center gap-1.5"
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
                <div className="flex flex-col sm:flex-row flex-wrap gap-2 mb-4">
                  <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
                    <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.subText}`} />
                    <input
                      value={invSearch}
                      onChange={e => setInvSearch(e.target.value)}
                      placeholder="ค้นหาชื่อยา หรือรหัสยา..."
                      className={`w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`}
                    />
                  </div>
                  <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:flex gap-2">
                    <select
                      value={invCategory}
                      onChange={e => setInvCategory(e.target.value)}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs outline-none ${theme.inputBg}`}
                    >
                      <option value="ทั้งหมด">ทุกหมวดหมู่</option>
                      {MEDICINE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={invFilter}
                      onChange={e => setInvFilter(e.target.value as any)}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs outline-none ${theme.inputBg}`}
                    >
                      <option value="all">แสดงทุกสถานะ</option>
                      <option value="low">เฉพาะยาที่ต้องเติม</option>
                      <option value="expiring">เฉพาะยาใกล้หมดอายุ</option>
                    </select>
                  </div>
                </div>

                {/* Mobile Medicine Cards (< 768px) */}
                <div className="md:hidden space-y-3">
                  {filtered.length === 0 && (
                    <div className={`py-8 text-center text-xs ${theme.subText}`}>ไม่พบรายการยาที่ตรงกับเงื่อนไข</div>
                  )}
                  {filtered.map(m => {
                    const days = daysUntil(m.expiry);
                    const need = Math.max(m.min * 3 - m.stock, 0);
                    const pct = Math.min(100, Math.round((m.stock / (m.min * 3)) * 100));
                    return (
                      <div key={m.id} className={`p-4 rounded-2xl border text-xs space-y-3 ${theme.cardInner}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`font-bold text-sm ${theme.heading}`}>{m.name}</p>
                            {m.en && <p className={`text-[11px] ${theme.subText}`}>({m.en})</p>}
                            <p className={`text-[10px] font-mono mt-0.5 ${theme.subText}`}>{m.id} • {m.category}</p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold shrink-0 ${statusClass(m)}`}>
                            {statusLabel(m)}
                          </span>
                        </div>

                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={theme.subText}>คงเหลือ: <strong className={`font-mono ${theme.heading}`}>{m.stock} {m.unit}</strong></span>
                            <span className={theme.subText}>ขั้นต่ำ: <span className="font-mono">{m.min} {m.unit}</span></span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div className={`h-full rounded-full ${barClass(m)}`} style={{ width: `${pct}%` }}></div>
                          </div>
                          {getStockStatus(m) !== 'ปกติ' && (
                            <p className="text-[11px] mt-1 text-amber-600 font-semibold">ควรเติมเพิ่มประมาณ {need} {m.unit}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <span className={`text-[11px] font-mono ${days <= 90 ? 'text-rose-500 font-bold' : theme.subText}`}>
                            {m.lot} • หมดอายุ {m.expiry}
                          </span>
                          <button
                            onClick={() => { setRestockMed(m); setRestockQty(String(Math.max(need, m.min))); setRestockLot(''); setRestockExpiry(''); }}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700"
                          >
                            + เติมสต็อก
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop Table (>= 768px) */}
                <div className="hidden md:block overflow-x-auto">
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
                            <td className="py-3.5 px-4 font-semibold">{m.name}{m.en && <span className={`block text-[10px] font-normal ${theme.subText}`}>({m.en})</span>}</td>
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
                                className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold hover:bg-teal-500/20 text-xs whitespace-nowrap"
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
 <div>
 <label className="text-xs font-semibold">ชื่อภาษาอังกฤษ (แสดงใต้ชื่อไทย)</label>
 <input value={newMed.en} onChange={e => setNewMed({ ...newMed, en: e.target.value })} placeholder="เช่น Aluminium-Magnesium antacid"
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

          {/* VIEW 5: PATIENTS & STUDENTS DIRECTORY (Master-Detail E-Chart Layout) */}
          {activeTab === 'students' && (() => {
            const q = studentSearch.trim().toLowerCase();
            const filteredStudents = students.filter(s => {
              if (studentFilterRole === 'แพ้ยา') {
                if (!(s.allergies && s.allergies.length > 0)) return false;
              } else if (studentFilterRole !== 'ทั้งหมด' && s.role !== studentFilterRole) {
                return false;
              }
              if (q && !(
                String(s.id || '').toLowerCase().includes(q) ||
                String(s.name || '').toLowerCase().includes(q) ||
                String(s.faculty || '').toLowerCase().includes(q) ||
                (s.allergies || []).some((a: string) => a.toLowerCase().includes(q))
              )) return false;
              return true;
            });
            const activeEChartStudent = filteredStudents.find(s => s.id === selectedStudentId) || filteredStudents[0] || null;
            const activeEChartVisits = activeEChartStudent
              ? visits.filter(v => (v.patientId || v.studentId) === activeEChartStudent.id)
              : [];

            return (
            <div className="max-w-[1440px] mx-auto space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                {/* LEFT COLUMN (Master List): Search, Filter & Directory */}
                <div className={`lg:col-span-7 p-4 sm:p-6 rounded-2xl border ${theme.card}`}>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <div>
                      <h3 className={`font-bold text-base sm:text-lg ${theme.heading}`}>ทะเบียนผู้รับบริการ & ประวัติการแพ้ยา</h3>
                      <p className={`text-xs mt-1 ${theme.subText}`}>รวมนักศึกษา อาจารย์ เจ้าหน้าที่ และบุคลากร ({students.length} รายการ)</p>
                    </div>
                  </div>

                  {/* Search & Filter Controls */}
                  <div className="flex flex-col gap-2.5 mb-5">
                    <div className="relative">
                      <Search size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.subText}`} />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        placeholder="ค้นหาชื่อ, รหัสประจำตัว, คณะ หรือยาที่แพ้..."
                        className={`w-full min-h-[42px] pl-9 pr-3 py-2 rounded-xl border text-xs outline-none focus:border-teal-500 ${theme.inputBg}`}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {['ทั้งหมด', 'นักศึกษา', 'อาจารย์', 'เจ้าหน้าที่', 'บุคลากร', 'แพ้ยา'].map(r => (
                        <button
                          key={r}
                          onClick={() => setStudentFilterRole(r)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                            studentFilterRole === r
                              ? r === 'แพ้ยา' ? 'bg-rose-600 text-white shadow-sm' : 'bg-teal-600 text-white shadow-sm'
                              : darkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {r === 'แพ้ยา' ? `แพ้ยา (${students.filter(s => (s.allergies || []).length > 0).length})` : r}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredStudents.length === 0 ? (
                    <div className="py-12 text-center space-y-2">
                      <p className={`text-sm font-semibold ${theme.heading}`}>ไม่พบข้อมูลผู้รับบริการที่ตรงกับเงื่อนไข</p>
                      <p className={`text-xs ${theme.subText}`}>เมื่อบันทึกข้อมูลการรักษา รายชื่อผู้ป่วยและประวัติแพ้ยาจะถูกจัดเก็บลงที่นี่โดยอัตโนมัติ</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Patient Cards (< 768px) */}
                      <div className="md:hidden space-y-3">
                        {filteredStudents.map(s => {
                          const hasAllergy = s.allergies && s.allergies.length > 0;
                          return (
                            <div key={s.id} className={`p-4 rounded-2xl border text-xs space-y-3 ${hasAllergy ? 'border-rose-500/30 bg-rose-500/5' : theme.cardInner}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className={`font-bold text-sm truncate ${theme.heading}`}>{s.name}</p>
                                  <p className={`text-[11px] font-mono mt-0.5 ${theme.subText}`}>
                                    {s.id} • {s.role || 'นักศึกษา'} • เลือดกรุ๊ป {s.blood || '-'}
                                  </p>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  hasAllergy ? 'bg-rose-600 text-white' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                }`}>
                                  {hasAllergy ? `แพ้ยา ${s.allergies.length} รายการ` : 'ไม่มีประวัติแพ้ยา'}
                                </span>
                              </div>

                              {s.faculty && (
                                <p className={`text-[11px] truncate ${theme.subText}`}>{s.faculty}{s.department ? ` • ${s.department}` : ''}</p>
                              )}

                              {hasAllergy && (
                                <div className="flex flex-wrap gap-1.5">
                                  {s.allergies.map((alg: string, i: number) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-300 text-[11px] font-bold border border-rose-500/25">
                                      แพ้: {alg}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                                <button
                                  onClick={() => setDetailStudent(s)}
                                  className={`flex-1 min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                                    darkMode ? 'border-slate-700 text-slate-200 hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <Eye size={14} /> ดูรายละเอียด
                                </button>
                                <button
                                  onClick={() => setAllergyModalStudent(s)}
                                  className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center justify-center gap-1"
                                >
                                  <Plus size={14} /> บันทึกแพ้ยา
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table (>= 768px) - Streamlined Click-to-Select */}
                      <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className={`border-b ${theme.tableHeader}`}>
                              <th className="py-3 px-3 font-semibold">รหัส / ประเภท</th>
                              <th className="py-3 px-3 font-semibold">ชื่อ-นามสกุล / คณะ</th>
                              <th className="py-3 px-3 font-semibold">ประวัติการแพ้ยา</th>
                              <th className="py-3 px-3 font-semibold text-right">จัดการ</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {filteredStudents.map(s => {
                              const isSelected = activeEChartStudent?.id === s.id;
                              return (
                              <tr
                                key={s.id}
                                onClick={() => setSelectedStudentId(s.id)}
                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-teal-500/10' : 'hover:bg-slate-500/5'}`}
                              >
                                <td className="py-3 px-3 whitespace-nowrap">
                                  <p className="font-mono font-bold text-teal-600 dark:text-teal-400">{s.id}</p>
                                  <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 dark:bg-slate-800">
                                    {s.role || 'นักศึกษา'}
                                  </span>
                                </td>
                                <td className="py-3 px-3">
                                  <p className={`font-bold ${theme.heading}`}>{s.name}</p>
                                  <p className={`text-[11px] mt-0.5 ${theme.subText}`}>
                                    {s.faculty || '-'}{s.department ? ` • ${s.department}` : ''}
                                  </p>
                                </td>
                                <td className="py-3 px-3">
                                  <div className="flex flex-wrap gap-1 items-center">
                                    {s.allergies && s.allergies.length > 0 ? s.allergies.map((alg: string, i: number) => (
                                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300 text-[11px] font-bold border border-rose-500/20">
                                        {alg}
                                      </span>
                                    )) : (
                                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">ปกติ</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); setDetailStudent(s); }}
                                    className={`lg:hidden px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                                      darkMode ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                  >
                                    ดูข้อมูล
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); setAllergyModalStudent(s); }}
                                    className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold hover:bg-teal-500/20 text-xs"
                                  >
                                    + แพ้ยา
                                  </button>
                                </td>
                              </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>

                {/* RIGHT COLUMN (Detail E-Chart Card on Desktop) */}
                <div className="hidden lg:block lg:col-span-5 lg:sticky lg:top-4">
                  {activeEChartStudent ? (
                    <div className={`p-5 rounded-2xl border space-y-4 ${theme.card}`}>
                      {/* E-Chart Header */}
                      <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-200 dark:border-slate-800">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-teal-600 to-sky-500 text-white flex items-center justify-center text-lg font-black shadow-md shrink-0">
                            {(activeEChartStudent.name || 'U').charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
                              Patient E-Chart • แฟ้มประวัติสุขภาพ
                            </p>
                            <h4 className={`font-bold text-base truncate ${theme.heading}`}>{activeEChartStudent.name}</h4>
                            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px]">
                              <span className={`font-mono ${theme.subText}`}>{activeEChartStudent.id}</span>
                              <span className="px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-semibold text-[10px]">
                                {activeEChartStudent.role || 'นักศึกษา'}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 font-mono font-bold text-[10px]">
                                กรุ๊ปเลือด: {activeEChartStudent.blood || 'ไม่ระบุ'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setDetailStudent(activeEChartStudent)}
                          className={`p-2 rounded-xl border text-xs shrink-0 ${
                            darkMode ? 'border-slate-800 text-slate-400 hover:bg-slate-800' : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                          }`}
                          title="เปิดหน้าต่างแบบเต็ม"
                        >
                          <Eye size={16} />
                        </button>
                      </div>

                      {/* 2x2 Demographics Grid */}
                      <div className={`p-3.5 rounded-2xl border text-xs grid grid-cols-2 gap-3 ${theme.cardInner}`}>
                        <div>
                          <p className={`text-[10px] ${theme.subText}`}>คณะ / หน่วยงาน</p>
                          <p className="font-semibold mt-0.5">{activeEChartStudent.faculty || '-'}</p>
                        </div>
                        <div>
                          <p className={`text-[10px] ${theme.subText}`}>สาขาวิชา / ฝ่าย</p>
                          <p className="font-semibold mt-0.5">{activeEChartStudent.department || '-'}</p>
                        </div>
                        <div>
                          <p className={`text-[10px] ${theme.subText}`}>ชั้นปี / สถานะ</p>
                          <p className="font-semibold mt-0.5">{activeEChartStudent.year || activeEChartStudent.role || '-'}</p>
                        </div>
                        <div>
                          <p className={`text-[10px] ${theme.subText}`}>เบอร์โทรศัพท์</p>
                          <p className="font-mono mt-0.5">{activeEChartStudent.phone || '-'}</p>
                        </div>
                      </div>

                      {/* Allergy Profile Block */}
                      <div className={`p-3.5 rounded-2xl border text-xs space-y-2.5 ${
                        activeEChartStudent.allergies && activeEChartStudent.allergies.length > 0
                          ? 'border-rose-500/30 bg-rose-500/5'
                          : theme.cardInner
                      }`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                            <ShieldAlert size={15} /> ประวัติการแพ้ยา (Allergy Profile)
                          </p>
                          <button
                            onClick={() => setAllergyModalStudent(activeEChartStudent)}
                            className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1"
                          >
                            <Plus size={12} /> บันทึกแพ้ยาเพิ่ม
                          </button>
                        </div>
                        {activeEChartStudent.allergies && activeEChartStudent.allergies.length > 0 ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-1.5">
                              {activeEChartStudent.allergies.map((alg: string, i: number) => (
                                <span key={i} className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[11px]">
                                  {alg}
                                </span>
                              ))}
                            </div>
                            {activeEChartStudent.allergyReaction && (
                              <p className={theme.subText}>อาการเมื่อแพ้: <strong>{activeEChartStudent.allergyReaction}</strong></p>
                            )}
                            {(activeEChartStudent.allergyDetails || []).length > 0 && (
                              <div className="space-y-1 pt-1">
                                {(activeEChartStudent.allergyDetails || []).map((d: any, idx: number) => (
                                  <div key={idx} className="flex items-center justify-between gap-2 text-[11px] p-2 rounded-lg bg-white/50 dark:bg-slate-900/50 border border-rose-500/15">
                                    <span className="truncate font-medium">
                                      {d.drugName} {d.drugFamily ? `(${d.drugFamily})` : ''}
                                    </span>
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                                      d.verified ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600'
                                    }`}>
                                      {d.verified ? 'ยืนยันแล้ว' : 'รอยืนยัน'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <p className="text-emerald-600 dark:text-emerald-400 font-semibold">ไม่มีประวัติการแพ้ยาในระบบ</p>
                        )}
                      </div>

                      {/* Past Visits Timeline */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <p className={`font-bold ${theme.heading}`}>
                            ประวัติการรับบริการ ({activeEChartVisits.length} ครั้ง)
                          </p>
                        </div>
                        <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                          {activeEChartVisits.length === 0 ? (
                            <p className={`p-3 rounded-xl border text-center ${theme.cardInner} ${theme.subText}`}>
                              ยังไม่มีประวัติการเข้ารับบริการที่ห้องพยาบาล
                            </p>
                          ) : (
                            activeEChartVisits.map(v => (
                              <div key={v.id} className={`p-3 rounded-xl border space-y-1 ${theme.cardInner}`}>
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold truncate">{v.symptom}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      v.triage === 'ฉุกเฉิน' ? 'bg-rose-500/10 text-rose-600' :
                                      v.triage === 'ด่วน' ? 'bg-amber-500/10 text-amber-600' :
                                      'bg-emerald-500/10 text-emerald-600'
                                    }`}>
                                      {v.triage}
                                    </span>
                                    <span className={`font-mono text-[10px] ${theme.subText}`}>{v.time}</span>
                                  </div>
                                </div>
                                {v.diagnosis && (
                                  <p className={`text-[11px] ${theme.subText}`}>วินิจฉัย: {v.diagnosis}</p>
                                )}
                                <p className={`text-[11px] ${theme.subText}`}>
                                  ยา: {(v.meds || []).join(', ') || '-'} • <span className="text-teal-600 dark:text-teal-400 font-semibold">{v.status}</span>
                                </p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Primary CTA */}
                      <button
                        onClick={() => { autoFillPatient(activeEChartStudent); setActiveTab('visit-record'); }}
                        className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-sky-500 hover:brightness-110 text-white font-bold text-xs shadow-lg shadow-teal-600/20 flex items-center justify-center gap-2 transition-all"
                      >
                        <ClipboardPlus size={16} /> เปิดบันทึกการรักษารายนี้ทันที
                      </button>
                    </div>
                  ) : (
                    <div className={`p-10 rounded-2xl border text-center space-y-2 ${theme.card}`}>
                      <Users size={36} className={`mx-auto ${theme.subText}`} />
                      <p className={`text-sm font-bold ${theme.heading}`}>เลือกรายชื่อผู้ป่วย</p>
                      <p className={`text-xs ${theme.subText}`}>คลิกที่รายชื่อทางฝั่งซ้ายเพื่อดูแฟ้มประวัติสุขภาพและประวัติแพ้ยา</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
            );
          })()}

          {/* VIEW 6: REPORTS */}
          {activeTab === 'reports' && (
            <Reports data={{ students, medicines, visits, beds }} theme={theme} addToast={addToast} />
          )}

          {/* VIEW 7: AI ASSISTANT (Fallback route) */}
          {activeTab === 'ai-assistant' && (
            <AiChat data={{ students, medicines, visits, beds }} theme={theme} darkMode={darkMode} />
          )}

          {/* VIEW 8: SETTINGS, ADMIN ACCESS, DATA IMPORT & DATABASE MANAGEMENT */}
          {(activeTab === 'settings' || activeTab === 'data-import') && (() => {
            const currentSettingsTab = activeTab === 'data-import' ? 'import' : settingsSubTab;
            return (
            <div className="max-w-5xl mx-auto space-y-5">
              {/* 3-Tab Sub Navigation */}
              <div className={`p-1.5 rounded-2xl border flex flex-wrap gap-1.5 ${theme.card}`}>
                {[
                  { id: 'general' as const, label: 'ทั่วไป & ฐานข้อมูล', icon: Settings },
                  { id: 'admins' as const, label: 'จัดการสิทธิ์แอดมิน (Admin Access)', icon: ShieldCheck },
                  { id: 'import' as const, label: 'นำเข้าข้อมูล (CSV / Excel)', icon: Upload },
                ].map(t => {
                  const Icon = t.icon;
                  const isActive = currentSettingsTab === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        if (activeTab === 'data-import') setActiveTab('settings');
                        setSettingsSubTab(t.id);
                      }}
                      className={`flex-1 min-w-[160px] min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                        isActive
                          ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                          : `${theme.subText} hover:bg-teal-500/10 hover:text-teal-600 dark:hover:text-teal-300`
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* TAB 1: ทั่วไป & ฐานข้อมูล */}
              {currentSettingsTab === 'general' && (
                <div className="space-y-5">
                  {/* ข้อมูลห้องพยาบาล (Clinic Info Card) */}
                  <div className={`p-4 sm:p-6 rounded-2xl border ${theme.card} space-y-4`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                          <Stethoscope size={20} />
                        </div>
                        <div>
                          <h3 className={`font-bold text-sm sm:text-base ${theme.heading}`}>ข้อมูลห้องพยาบาล (Clinic Information)</h3>
                          <p className={`text-xs ${theme.subText}`}>รายละเอียดสถานที่ เวลาทำการ และจำนวนเตียงพักฟื้นที่ให้บริการ</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setBedManagementModal(true)}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center gap-1.5"
                      >
                        <Bed size={15} /> จัดการเตียงพักฟื้น ({beds.length} เตียง)
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                      <div className={`p-3.5 rounded-xl border ${theme.cardInner}`}>
                        <p className={`text-[10px] font-semibold ${theme.subText}`}>ชื่อหน่วยงาน</p>
                        <p className={`font-bold mt-1 ${theme.heading}`}>ห้องพยาบาล มหาวิทยาลัยกาฬสินธุ์</p>
                      </div>
                      <div className={`p-3.5 rounded-xl border ${theme.cardInner}`}>
                        <p className={`text-[10px] font-semibold flex items-center gap-1 ${theme.subText}`}>
                          <Clock size={12} /> เวลาทำการ
                        </p>
                        <p className={`font-bold mt-1 ${theme.heading}`}>08:30 - 16:30 น. (จันทร์–ศุกร์)</p>
                      </div>
                      <div className={`p-3.5 rounded-xl border ${theme.cardInner}`}>
                        <p className={`text-[10px] font-semibold flex items-center gap-1 ${theme.subText}`}>
                          <MapPin size={12} /> สถานที่ตั้ง
                        </p>
                        <p className={`font-bold mt-1 ${theme.heading}`}>อาคารกิจการนักศึกษา ชั้น 1</p>
                      </div>
                      <div className={`p-3.5 rounded-xl border ${theme.cardInner}`}>
                        <p className={`text-[10px] font-semibold flex items-center gap-1 ${theme.subText}`}>
                          <Phone size={12} /> สายด่วนห้องพยาบาล
                        </p>
                        <p className={`font-bold font-mono mt-1 text-teal-600 dark:text-teal-400`}>043-712-345 ต่อ 1204</p>
                      </div>
                    </div>
                  </div>

                  {/* ฐานข้อมูลคลาวด์ Supabase (PostgreSQL) */}
                  <div className={`p-4 sm:p-6 rounded-2xl border ${theme.card} space-y-4 border-teal-500/30`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-gradient-to-tr from-teal-600 to-sky-500 text-white shadow-md shadow-teal-500/20 shrink-0">
                          <Cloud size={20} />
                        </div>
                        <div>
                          <h3 className={`font-black text-sm sm:text-base ${theme.heading}`}>ฐานข้อมูลคลาวด์ Supabase (PostgreSQL)</h3>
                          <p className={`text-xs ${theme.subText}`}>ซิงค์ข้อมูลข้ามอุปกรณ์แบบเรียลไทม์</p>
                        </div>
                      </div>
                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${
                        supabaseStatus === 'connected'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
                      }`}>
                        {supabaseStatus === 'connected' ? 'เชื่อมต่อ Supabase แล้ว' : 'โหมด LocalDB'}
                      </span>
                    </div>

                    <div className="space-y-3 pt-1 text-xs">
                      <div>
                        <label className={`block font-semibold mb-1 ${theme.heading}`}>Supabase Project URL</label>
                        <input
                          type="text"
                          placeholder="https://your-project.supabase.co"
                          value={supabaseUrl}
                          onChange={e => setSupabaseUrl(e.target.value)}
                          className={`w-full min-h-[42px] p-2.5 rounded-xl border font-mono ${theme.inputBg}`}
                        />
                      </div>
                      <div>
                        <label className={`block font-semibold mb-1 ${theme.heading}`}>Supabase Anon Public API Key</label>
                        <input
                          type="password"
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          value={supabaseKey}
                          onChange={e => setSupabaseKey(e.target.value)}
                          className={`w-full min-h-[42px] p-2.5 rounded-xl border font-mono ${theme.inputBg}`}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 pt-1">
                      <button
                        onClick={handleSaveSupabaseConfig}
                        disabled={isTestingSupabase}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-teal-600/20"
                      >
                        {isTestingSupabase ? <RefreshCw className="animate-spin" size={14} /> : <Check size={14} />}
                        <span>บันทึก & ทดสอบเชื่อมต่อ</span>
                      </button>

                      <button
                        onClick={handleCopySqlSchema}
                        className="min-h-[42px] px-4 py-2 rounded-xl border border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 text-teal-700 dark:text-teal-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5"
                      >
                        <Copy size={14} />
                        <span>คัดลอก SQL Script สร้างตาราง</span>
                      </button>

                      <button
                        onClick={handleSyncToSupabase}
                        disabled={isSyncingSupabase || supabaseStatus !== 'connected'}
                        className="min-h-[42px] px-4 py-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold text-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isSyncingSupabase ? <RefreshCw className="animate-spin" size={14} /> : <Cloud size={14} />}
                        <span>ซิงค์ข้อมูลขึ้น Supabase Cloud</span>
                      </button>
                    </div>
                  </div>

                  {/* จัดการฐานข้อมูลภายในเครื่อง */}
                  <div className={`p-4 sm:p-6 rounded-2xl border ${theme.card} space-y-4`}>
                    <h3 className={`font-bold text-sm sm:text-base ${theme.heading}`}>จัดการฐานข้อมูลภายในเครื่อง (Local Database Management)</h3>
                    <p className={`text-xs ${theme.subText}`}>ระบบจัดเก็บข้อมูลใน Local Storage Database ของเบราว์เซอร์อย่างถาวร</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
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
                </div>
              )}

              {/* TAB 2: จัดการสิทธิ์แอดมิน (Admin Access) */}
              {currentSettingsTab === 'admins' && (
                <div className={`p-4 sm:p-6 rounded-2xl border ${theme.card} space-y-3.5`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-sm sm:text-base ${theme.heading}`}>สิทธิ์ผู้ดูแลระบบ (Admin Access)</h3>
                      <p className={`text-xs ${theme.subText}`}>
                        อีเมล @{ALLOWED_DOMAIN} ที่อยู่ในรายการนี้จะเข้าหน้าเจ้าหน้าที่ห้องพยาบาลได้
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getVisibleAdminEmails().length === 0 ? (
                      <span className={`text-xs ${theme.subText}`}>ใช้บัญชีผู้ดูแลระบบหลัก (ยังไม่ได้เพิ่มอีเมลเจ้าหน้าที่เพิ่มเติม)</span>
                    ) : (
                      getVisibleAdminEmails().map(e => (
                        <span key={e} className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 flex items-center gap-2">
                          <span className="break-all">{e}</span>
                          {adminEmails.includes(e) && (
                            <button
                              onClick={() => handleRemoveAdminEmail(e)}
                              className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 shrink-0"
                              title="ลบสิทธิ์ผู้ดูแล"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={adminEmailInput}
                      onChange={e => setAdminEmailInput(e.target.value)}
                      placeholder={'เช่น nurse01@' + ALLOWED_DOMAIN}
                      className={`flex-1 min-h-[42px] px-3 py-2 rounded-xl border text-xs ${theme.inputBg}`}
                    />
                    <button
                      onClick={handleAddAdminEmail}
                      className="min-h-[42px] px-5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 shrink-0"
                    >
                      เพิ่มผู้ดูแล
                    </button>
                  </div>
                  <p className={`text-[11px] ${theme.subText}`}>รายการที่เพิ่มจะบันทึกในเบราว์เซอร์นี้ หากต้องการให้ใช้ได้ทุกเครื่อง ให้กำหนดตัวแปร VITE_ADMIN_EMAILS ใน Vercel</p>
                </div>
              )}

              {/* TAB 3: นำเข้าข้อมูล CSV / Excel */}
              {currentSettingsTab === 'import' && (
                <div className={`p-4 sm:p-6 rounded-2xl border ${theme.card} space-y-4`}>
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 shrink-0">
                      <Upload size={20} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-sm sm:text-base ${theme.heading}`}>นำเข้าข้อมูลผู้ใช้บริการ (CSV / Excel)</h3>
                      <p className={`text-xs ${theme.subText}`}>นำเข้ารายชื่อนักศึกษา อาจารย์ และบุคลากรเข้าสู่ระบบ</p>
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl border-2 border-dashed border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/10 transition-all text-center cursor-pointer">
                    <SheetIcon size={34} className="mx-auto text-emerald-600 dark:text-emerald-400 mb-2" />
                    <p className="text-xs font-semibold">แตะเพื่อเลือกไฟล์ หรือลากไฟล์ CSV / XLSX มาวางที่นี่</p>
                    <p className={`text-[11px] mt-1 ${theme.subText}`}>รองรับไฟล์ .csv, .xlsx (ขนาดไม่เกิน 25MB)</p>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={() => addToast('ซิงค์ข้อมูลสำเร็จ', 'ดึงข้อมูลนักศึกษาใหม่จากไฟล์นำเข้าเรียบร้อย')}
                      className="w-full sm:w-auto min-h-[42px] px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-md"
                    >
                      ยืนยันการนำเข้าข้อมูล
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })()}

          {/* VIEW 9: USER REQUESTS (คำขอจากผู้ใช้) */}
          {activeTab === 'requests' && (
            <RequestsAdmin
              requests={requests}
              beds={beds}
              medicines={medicines}
              allAllergiesByEmail={allergiesByEmail}
              theme={theme}
              onApproveBed={approveBedRequest}
              onFinishBed={finishBedRequest}
              onApproveMedicine={approveMedicineRequest}
              onApproveAllergy={approveAllergyRequest}
              onReject={rejectRequest}
              onSetStatus={setRequestStatus}
            />
          )}

        </main>
      </div>

      {/* FLOATING AI ASSISTANT WIDGET (มุมขวาล่างสำหรับถาม AI ขณะซักประวัติ) */}
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end">
        {/* POPUP CHAT WINDOW */}
        {showAiPopup && (
          <div className={`mb-3 w-[calc(100vw-1.5rem)] sm:w-96 h-[72vh] sm:h-[520px] max-h-[82vh] rounded-3xl border shadow-2xl flex flex-col overflow-hidden backdrop-blur-2xl animate-in slide-in-from-bottom-5 duration-200 ${
            darkMode ? 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-teal-950/40' : 'bg-white/95 border-slate-200 text-slate-800 shadow-teal-900/10'
          }`}>
            {/* Header */}
            <div className={`p-3.5 sm:p-4 border-b flex items-center justify-between ${darkMode ? 'border-slate-800 bg-slate-900/80' : 'border-slate-100 bg-slate-50/80'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-teal-600/30 shrink-0">
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
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
                title="ปิดหน้าต่าง AI"
              >
                <X size={18} />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 custom-scrollbar text-xs">
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
                  className="whitespace-nowrap text-[10px] px-2.5 py-1.5 rounded-full border border-teal-500/30 bg-teal-500/5 text-teal-700 dark:text-teal-300 hover:bg-teal-500/15 transition-all"
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
                className={`flex-1 min-w-0 min-h-[40px] px-3 py-2 text-xs rounded-xl border focus:outline-none focus:border-teal-500 ${theme.inputBg}`}
              />
              <button
                type="button"
                onClick={() => sendPopupMessage(popupInput)}
                disabled={!popupInput.trim() || popupTyping}
                className="w-10 h-10 rounded-xl bg-teal-600 hover:bg-teal-700 disabled:opacity-40 text-white flex items-center justify-center shrink-0 transition-all shadow-md shadow-teal-600/30"
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        )}

        {/* Floating Toggle Button */}
        <button
          type="button"
          onClick={() => setShowAiPopup(!showAiPopup)}
          className={`min-h-[44px] flex items-center gap-2 px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full text-white font-bold text-xs shadow-2xl transition-all hover:scale-105 active:scale-95 group ${
            showAiPopup
              ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 shadow-slate-900/50'
              : 'bg-gradient-to-r from-teal-600 to-sky-500 hover:brightness-110 shadow-teal-600/40 ring-4 ring-teal-500/20'
          }`}
          title="คลิกเพื่อเปิด AI ผู้ช่วยซักถามอาการคนไข้"
        >
          <div className="relative">
            <Bot size={18} className="stroke-[2.5]" />
            {!showAiPopup && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping" />
            )}
          </div>
          <span>{showAiPopup ? 'ปิด AI' : 'AI ผู้ช่วย'}</span>
        </button>
      </div>

      {/* MODALS */}
      {/* 0. Patient Detail Modal (ดูรายละเอียดผู้ป่วย) */}
      {detailStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className={`max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 rounded-3xl border shadow-2xl relative space-y-4 ${theme.modalBg}`}>
            <button onClick={() => setDetailStudent(null)} className="absolute top-4 right-4 w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <div className="w-12 h-12 rounded-2xl bg-teal-600 text-white flex items-center justify-center text-lg font-black shrink-0">
                {(detailStudent.name || 'U').charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className={`font-bold text-base truncate ${theme.heading}`}>{detailStudent.name}</h3>
                <p className={`text-xs font-mono ${theme.subText}`}>{detailStudent.id} • {detailStudent.role || 'นักศึกษา'}</p>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border text-xs grid grid-cols-2 gap-3 ${theme.cardInner}`}>
              <div>
                <p className={`text-[10px] ${theme.subText}`}>คณะ / หน่วยงาน</p>
                <p className="font-semibold mt-0.5">{detailStudent.faculty || '-'}</p>
              </div>
              <div>
                <p className={`text-[10px] ${theme.subText}`}>สาขาวิชา / ฝ่าย</p>
                <p className="font-semibold mt-0.5">{detailStudent.department || '-'}</p>
              </div>
              <div>
                <p className={`text-[10px] ${theme.subText}`}>กรุ๊ปเลือด</p>
                <p className="font-mono font-bold mt-0.5">{detailStudent.blood || 'ไม่ระบุ'}</p>
              </div>
              <div>
                <p className={`text-[10px] ${theme.subText}`}>เบอร์โทรศัพท์</p>
                <p className="font-mono mt-0.5">{detailStudent.phone || '-'}</p>
              </div>
            </div>

            <div className={`p-3.5 rounded-2xl border text-xs space-y-2 ${detailStudent.allergies && detailStudent.allergies.length > 0 ? 'border-rose-500/30 bg-rose-500/5' : theme.cardInner}`}>
              <p className="font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ShieldAlert size={15} /> ประวัติการแพ้ยา
              </p>
              {detailStudent.allergies && detailStudent.allergies.length > 0 ? (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {detailStudent.allergies.map((alg: string, i: number) => (
                      <span key={i} className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs">
                        {alg}
                      </span>
                    ))}
                  </div>
                  {detailStudent.allergyReaction && (
                    <p className={theme.subText}>อาการเมื่อแพ้: <strong>{detailStudent.allergyReaction}</strong></p>
                  )}
                </>
              ) : (
                <p className="text-emerald-600 dark:text-emerald-400 font-semibold">ไม่มีประวัติการแพ้ยาในระบบ</p>
              )}
            </div>

            {/* ประวัติการเข้ารับบริการของคนนี้ */}
            <div className="space-y-2 text-xs">
              <p className={`font-bold ${theme.heading}`}>
                ประวัติการรับบริการ ({visits.filter(v => (v.patientId || v.studentId) === detailStudent.id).length} ครั้ง)
              </p>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {visits.filter(v => (v.patientId || v.studentId) === detailStudent.id).length === 0 ? (
                  <p className={theme.subText}>ยังไม่มีประวัติการเข้ารับบริการ</p>
                ) : (
                  visits.filter(v => (v.patientId || v.studentId) === detailStudent.id).map(v => (
                    <div key={v.id} className={`p-2.5 rounded-xl border ${theme.cardInner}`}>
                      <div className="flex justify-between font-semibold">
                        <span>{v.symptom}</span>
                        <span className="font-mono text-[11px]">{v.time}</span>
                      </div>
                      <p className={`text-[11px] mt-0.5 ${theme.subText}`}>
                        ยา: {(v.meds || []).join(', ') || '-'} • {v.status}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                onClick={() => { const s = detailStudent; setDetailStudent(null); setAllergyModalStudent(s); }}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl border border-rose-500/30 text-rose-600 dark:text-rose-400 font-bold text-xs hover:bg-rose-500/10"
              >
                + เพิ่มประวัติแพ้ยา
              </button>
              <button
                onClick={() => { const s = detailStudent; setDetailStudent(null); autoFillPatient(s); setActiveTab('visit-record'); }}
                className="flex-1 min-h-[42px] px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700"
              >
                บันทึกการรักษาผู้ป่วยนี้
              </button>
            </div>
          </div>
        </div>
      )}
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
          <div className={`max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 rounded-3xl border shadow-2xl relative ${theme.modalBg}`}>
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

                            <div className={`p-3 rounded-2xl border flex flex-wrap gap-2 items-center ${theme.cardInner}`}>
                <input
                  value={newBedName}
                  onChange={e => setNewBedName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddBed(); }}
                  placeholder="ชื่อเตียงใหม่ เช่น เตียง 7 (โซนหญิง)"
                  className={`flex-1 min-w-[180px] px-3 py-2 rounded-xl border text-xs ${theme.inputBg}`}
                />
                <button
                  onClick={handleAddBed}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center gap-1.5"
                >
                  <Plus size={14} /> เพิ่มเตียง
                </button>
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
                      <div className="mt-2 flex items-center justify-between">
                        <p className={`${theme.subText}`}>พร้อมรับผู้ป่วยพักฟื้น</p>
                        <button onClick={() => handleRemoveBed(b.id)} className="text-[11px] text-rose-500 hover:text-rose-700 flex items-center gap-1"><Trash2 size={12} /> ลบเตียง</button>
                      </div>
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

