import React, { useState } from 'react';
import {
  LayoutDashboard, ClipboardPlus, Pill, Upload, Users, BarChart3, Bot, Settings, Activity,
  AlertTriangle, Search, CheckCircle2, AlertCircle, X, Plus, Bed, QrCode, ShieldCheck,
  FileSpreadsheet as SheetIcon, Sun, Moon, Sparkles, ShieldAlert, Send, RefreshCw, ChevronRight,
  GraduationCap, MessageCircleQuestion, LogOut, Trash2, Clock
} from 'lucide-react';
import { INITIAL_STUDENTS, INITIAL_MEDICINES, INITIAL_VISITS, STANDARD_SYMPTOMS, INITIAL_BEDS } from './data';
import { analyzeSymptoms, checkDrugAllergy, getStockStatus, daysUntil, INTERVIEW_QUESTIONS, assessTriage, DRUG_FAMILY_OPTIONS } from './ai';
import AiChat from './components/AiChat';
import Reports from './components/Reports';
import StudentPortal from './components/StudentPortal';

export default function App() {
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const [students, setStudents] = useState<any[]>(INITIAL_STUDENTS);
  const [medicines, setMedicines] = useState<any[]>(INITIAL_MEDICINES);
  const [visits, setVisits] = useState<any[]>(INITIAL_VISITS);
  const [beds, setBeds] = useState<any[]>(INITIAL_BEDS);

  const [showQrModal, setShowQrModal] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [selectedStandardSymptoms, setSelectedStandardSymptoms] = useState<string[]>([]);
  const [customSymptomNote, setCustomSymptomNote] = useState('');
  const [assignedBedId, setAssignedBedId] = useState('');

  // การจ่ายยา + ตรวจแพ้ยา
  const [dispenseMedId, setDispenseMedId] = useState('');
  const [dispenseQty, setDispenseQty] = useState(1);
  const [dispenseList, setDispenseList] = useState<any[]>([]);
  const [allergyBlock, setAllergyBlock] = useState<any>(null);
  const [triageLevel, setTriageLevel] = useState('ปกติ');
  const [diagnosisInput, setDiagnosisInput] = useState('');

  // AI ซักประวัติอาการ
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [interviewStep, setInterviewStep] = useState(0);
  const [interviewAnswers, setInterviewAnswers] = useState<Record<string, string>>({});
  
  const [allergyModalStudent, setAllergyModalStudent] = useState(null);
  const [newAllergyData, setNewAllergyData] = useState({
    drugName: '',
    drugFamily: DRUG_FAMILY_OPTIONS[0],
    reaction: 'ผื่นคัน แน่นหน้าอก คลื่นไส้',
    severity: 'รุนแรงมาก (Anaphylaxis Risk)'
  });

  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<any>(null);
  const [bedManagementModal, setBedManagementModal] = useState(false);

  const [toasts, setToasts] = useState<any[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');

  const addToast = (title, message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  // นักศึกษาที่ถูกเลือกในหน้าบันทึกเข้าใช้บริการ (ต้องพิมพ์อย่างน้อย 2 ตัวอักษร)
  const q = globalSearch.trim();
  const selectedStudent = q.length >= 2
    ? students.find(s => s.id === q) || students.find(s => s.id.startsWith(q) || s.name.includes(q))
    : null;

  const resetVisitForm = () => {
    setGlobalSearch('');
    setSelectedStandardSymptoms([]);
    setCustomSymptomNote('');
    setAiSuggestion(null);
    setAssignedBedId('');
    setDispenseList([]);
    setDispenseMedId('');
    setDispenseQty(1);
    setAllergyBlock(null);
    setTriageLevel('ปกติ');
    setDiagnosisInput('');
    setInterviewAnswers({});
  };

  const loadStudentById = (studentId: string) => {
    const targetStudent = students.find(s => s.id === studentId.trim());
    if (!targetStudent) {
      addToast('ไม่พบข้อมูล', `ไม่พบรหัสนักศึกษา ${studentId}`, 'error');
      return;
    }
    setGlobalSearch(targetStudent.id);
    setShowQrModal(false);
    setScanInput('');
    setActiveTab('visit-record');
    addToast('สแกนบัตรนักศึกษาสำเร็จ', `โหลดข้อมูล: ${targetStudent.name} (${targetStudent.id})`);
    if (targetStudent.allergies.length > 0) {
      addToast('⚠️ ผู้ป่วยมีประวัติแพ้ยา', `แพ้: ${targetStudent.allergies.join(', ')}`, 'warning');
    }
  };

  const handleSimulateQRScan = (studentId) => loadStudentById(studentId);

  // บันทึกประวัติแพ้ยา (source: 'staff' = เจ้าหน้าที่ยืนยันแล้ว, 'student' = นักศึกษาแจ้งเอง รอยืนยัน)
  const registerAllergy = (studentId: string, data: any, source: 'staff' | 'student' = 'staff') => {
    const isSevere = data.severity.includes('รุนแรงมาก');
    setStudents(prev => prev.map(s => {
      if (s.id !== studentId) return s;
      return {
        ...s,
        allergies: Array.from(new Set([...s.allergies, data.drugName])),
        allergyDetails: [...(s.allergyDetails || []), { ...data, verified: source === 'staff', source }],
        severeAllergies: isSevere || s.severeAllergies,
      };
    }));
    addToast(
      source === 'staff' ? 'ลงทะเบียนประวัติแพ้ยาสำเร็จ' : 'ส่งข้อมูลแพ้ยาแล้ว',
      source === 'staff' ? `เพิ่มประวัติแพ้ยา ${data.drugName} เรียบร้อย` : `ระบบจะใช้ข้อมูล ${data.drugName} ตรวจสอบทันที และรอเจ้าหน้าที่ยืนยัน`
    );
  };

  const verifyAllergy = (studentId: string, drugName: string) => {
    setStudents(prev => prev.map(s => s.id !== studentId ? s : {
      ...s,
      allergyDetails: (s.allergyDetails || []).map(d => d.drugName === drugName ? { ...d, verified: true } : d),
    }));
    addToast('ยืนยันข้อมูลแพ้ยาแล้ว', `${drugName} ได้รับการยืนยันโดยเจ้าหน้าที่`);
  };

  const handleRegisterAllergy = (e) => {
    e.preventDefault();
    if (!allergyModalStudent || !newAllergyData.drugName) return;
    registerAllergy(allergyModalStudent.id, newAllergyData, 'staff');
    setAllergyModalStudent(null);
    setNewAllergyData({ drugName: '', drugFamily: DRUG_FAMILY_OPTIONS[0], reaction: 'ผื่นคัน แน่นหน้าอก', severity: 'รุนแรงมาก (Anaphylaxis Risk)' });
  };

  // เพิ่มยาเข้ารายการจ่าย พร้อมตรวจแพ้ยาอัตโนมัติ
  const addMedToDispense = (medName: string, qty = 1) => {
    const med = medicines.find(m => m.name === medName || m.id === medName);
    if (!med) return;
    if (!selectedStudent) {
      addToast('กรุณาเลือกนักศึกษาก่อน', 'ต้องระบุผู้ป่วยก่อนจ่ายยา เพื่อให้ระบบตรวจสอบการแพ้ยา', 'warning');
      return;
    }
    const conflict = checkDrugAllergy(med.name, selectedStudent.allergies);
    if (conflict) {
      setAllergyBlock({ med: med.name, ...conflict });
      addToast('🚨 ระงับการจ่ายยา', `${med.name}: ${conflict.message}`, 'error');
      return;
    }
    const already = dispenseList.find(d => d.id === med.id)?.qty || 0;
    if (already + qty > med.stock) {
      addToast('สต็อกไม่พอ', `${med.name} คงเหลือ ${med.stock} ${med.unit}`, 'error');
      return;
    }
    setDispenseList(prev => prev.some(d => d.id === med.id)
      ? prev.map(d => d.id === med.id ? { ...d, qty: d.qty + qty } : d)
      : [...prev, { id: med.id, name: med.name, unit: med.unit, qty }]);
    setAllergyBlock(null);
  };

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
        allergies: selectedStudent?.allergies || [],
        medicines,
        answers,
      });
      setAiAnalyzing(false);
      setAiSuggestion(result);
      if (result.triage) setTriageLevel(result.triage.level);
      else if (result.redFlag) setTriageLevel('ฉุกเฉิน');
      if (!diagnosisInput) setDiagnosisInput(result.diagnoses[0]);
      addToast('AI วิเคราะห์อาการสำเร็จ', 'แสดงข้อเสนอแนะสำหรับการพิจารณาของเจ้าหน้าที่');
    }, 900);
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
      setInterviewStep(INTERVIEW_QUESTIONS.length); // หน้าสรุป
    }
  };

  // บันทึกการรักษาจริง: เพิ่ม visit, ตัดสต็อก, ครองเตียง, เตือนสต็อกต่ำ
  const handleSaveVisit = () => {
    if (!selectedStudent) {
      addToast('ยังไม่ได้เลือกผู้ป่วย', 'กรุณาค้นหาหรือสแกนบัตรนักศึกษาก่อนบันทึก', 'warning');
      return;
    }
    if (selectedStandardSymptoms.length === 0 && !customSymptomNote.trim()) {
      addToast('ยังไม่ได้ระบุอาการ', 'เลือกอาการจากรายการมาตรฐานอย่างน้อย 1 รายการ', 'warning');
      return;
    }
    // ตรวจแพ้ยาซ้ำอีกครั้งก่อนบันทึก (Double-check)
    const unsafe = dispenseList.find(d => checkDrugAllergy(d.name, selectedStudent.allergies));
    if (unsafe) {
      addToast('🚨 ไม่สามารถบันทึกได้', `${unsafe.name} ขัดกับประวัติแพ้ยาของผู้ป่วย`, 'error');
      return;
    }

    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} น.`;
    const symptomText = [...selectedStandardSymptoms.map(s => s.split(' (')[0]), customSymptomNote.trim()].filter(Boolean).join(', ');
    const bed = beds.find(b => b.id === assignedBedId);
    const status = bed ? 'นอนพักเตียง' : triageLevel === 'ฉุกเฉิน' ? 'ส่งตัวต่อโรงพยาบาล' : 'รักษาแล้ว';
    const nextNum = Math.max(...visits.map(v => parseInt(v.id.replace('VST-', ''), 10) || 0)) + 1;

    setVisits(prev => [{
      id: `VST-${nextNum}`, time, studentId: selectedStudent.id, studentName: selectedStudent.name,
      faculty: selectedStudent.faculty, symptom: symptomText, triage: triageLevel, status,
      diagnosis: diagnosisInput || '-', meds: dispenseList.map(d => d.name),
      bedId: bed?.id || null,
    }, ...prev]);

    // ตัดสต็อก
    const lowAfter: string[] = [];
    const updatedMeds = medicines.map(m => {
      const d = dispenseList.find(x => x.id === m.id);
      if (!d) return m;
      const stock = m.stock - d.qty;
      if (stock <= m.min) lowAfter.push(`${m.name} (เหลือ ${stock})`);
      return { ...m, stock };
    });
    setMedicines(updatedMeds);

    if (bed) {
      setBeds(prev => prev.map(b => b.id === bed.id ? {
        ...b, status: 'occupied', studentId: selectedStudent.id, studentName: selectedStudent.name,
        symptom: symptomText, timeIn: time,
      } : b));
    }
    setStudents(prev => prev.map(s => s.id === selectedStudent.id ? { ...s, visitsCount: (s.visitsCount || 0) + 1 } : s));

    addToast('บันทึกข้อมูลสำเร็จ', `บันทึก VST-${nextNum}${dispenseList.length ? ` • ตัดสต็อกยา ${dispenseList.length} รายการ` : ''}${bed ? ` • ${bed.name}` : ''}`);
    if (lowAfter.length) addToast('⚠️ แจ้งเตือนสต็อกยา', `ต่ำกว่าจุดสั่งซื้อ: ${lowAfter.join(', ')}`, 'warning');
    resetVisitForm();
  };

  // จำหน่ายผู้ป่วย / คืนเตียง
  const handleDischarge = (bedId: string) => {
    const bed = beds.find(b => b.id === bedId);
    if (!bed) return;
    setBeds(prev => prev.map(b => b.id === bedId ? { ...b, status: 'available', studentId: null, studentName: null, symptom: null, timeIn: null } : b));
    setVisits(prev => prev.map(v => (v.studentId === bed.studentId && v.status === 'นอนพักเตียง') ? { ...v, status: 'รักษาแล้ว (จำหน่ายจากเตียง)' } : v));
    addToast('จำหน่ายผู้ป่วยสำเร็จ', `${bed.name} ว่างพร้อมใช้งานแล้ว`);
  };

  const pendingAllergyCount = students.reduce((n, s) => n + (s.allergyDetails || []).filter(d => !d.verified).length, 0);
  const lowStockMeds = medicines.filter(m => m.stock <= m.min);

  const navItems = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard, category: 'หลัก' },
    { id: 'visit-record', label: 'บันทึกเข้าใช้บริการ', icon: ClipboardPlus, category: 'หลัก' },
    { id: 'inventory', label: 'สต็อกยา & เวชภัณฑ์', icon: Pill, category: 'หลัก', badge: lowStockMeds.length },
    { id: 'data-import', label: 'นำเข้าข้อมูล', icon: Upload, category: 'ข้อมูล' },
    { id: 'students', label: 'ข้อมูลนักศึกษา & แพ้ยา', icon: Users, category: 'ข้อมูล', badge: pendingAllergyCount },
    { id: 'reports', label: 'รายงาน & สถิติ', icon: BarChart3, category: 'ข้อมูล' },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Bot, category: 'ระบบ', highlight: true },
    { id: 'settings', label: 'ตั้งค่า & GAS Sync', icon: Settings, category: 'ระบบ' },
    { id: 'student-portal', label: 'พอร์ทัลนักศึกษา', icon: GraduationCap, category: 'นักศึกษา' },
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
    accentText: darkMode ? 'text-teal-400' : 'text-teal-600',
    badgeActive: darkMode ? 'bg-teal-500/20 text-teal-300 border-teal-500/30' : 'bg-teal-50 text-teal-700 border-teal-200',
    badgeInactive: darkMode ? 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  };

  const availableBedsCount = beds.filter(b => b.status === 'available').length;

  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${theme.bg}`}>
      
      {/* TOAST NOTIFICATION CONTAINER */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-md w-full pointer-events-none">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-2xl backdrop-blur-xl transition-all duration-300 animate-in slide-in-from-top-5 ${
              toast.type === 'error' ? 'bg-rose-950/90 border-rose-500/50 text-rose-200' :
              toast.type === 'warning' ? 'bg-amber-950/90 border-amber-500/50 text-amber-200' :
              darkMode ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200' : 'bg-emerald-900 border-emerald-600 text-white shadow-lg'
            }`}
          >
            {toast.type === 'error' ? <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={20} /> :
             toast.type === 'warning' ? <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={20} /> :
             <CheckCircle2 className="text-emerald-300 shrink-0 mt-0.5" size={20} />}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm leading-tight">{toast.title}</h4>
              <p className="text-xs opacity-90 mt-1">{toast.message}</p>
            </div>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="opacity-70 hover:opacity-100">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

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
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-600 dark:text-teal-300 border border-teal-500/30">GAS+</span>
              </div>
              <p className={`text-[11px] ${theme.subText}`}>ระบบพยาบาลมหาวิทยาลัย</p>
            </div>
          </div>
        </div>

        {/* GAS Sync Indicator */}
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <SheetIcon size={14} />
            <span className="font-medium text-[11px]">Google Sheets Sync</span>
          </div>
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
          {['หลัก', 'ข้อมูล', 'ระบบ', 'นักศึกษา'].map((cat) => (
            <div key={cat}>
              <div className="px-3 text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                {cat}
              </div>
              <div className="space-y-1">
                {navItems.filter(item => item.category === cat).map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                        isActive ? theme.badgeActive : theme.badgeInactive
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={18} className={`transition-colors ${isActive ? theme.accentText : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.badge > 0 && (
                        <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-500/30">
                          {item.badge}
                        </span>
                      )}
                      {item.highlight && !isActive && (
                        <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* User Card */}
        <div className={`p-4 border-t ${theme.sidebarHeader} ${darkMode ? 'bg-slate-900/50' : 'bg-slate-50/80'}`}>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-full bg-teal-100 dark:bg-slate-800 border border-teal-300 dark:border-slate-700 flex items-center justify-center font-semibold text-teal-700 dark:text-teal-400 text-sm">
                พย
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900"></span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold truncate ${theme.heading}`}>พยาบาลวิชาชีพเวร</p>
              <p className={`text-[11px] truncate ${theme.subText}`}>ห้องพยาบาล ม.กาฬสินธุ์</p>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* HEADER */}
        <header className={`h-20 border-b backdrop-blur-md px-8 flex items-center justify-between shrink-0 z-10 transition-colors duration-300 ${theme.header}`}>
          <div className="flex items-center gap-3">
            <h1 className={`text-xl font-bold tracking-tight ${theme.heading}`}>
              {navItems.find(i => i.id === activeTab)?.label}
            </h1>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-lg border ${darkMode ? 'bg-slate-800/80 text-teal-400 border-slate-700/50' : 'bg-teal-50 text-teal-700 border-teal-200'}`}>
              มหาวิทยาลัยกาฬสินธุ์
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setBedManagementModal(true)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                availableBedsCount > 0 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20' 
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300 hover:bg-rose-500/20'
              }`}
            >
              <Bed size={16} />
              <span>เตียงว่าง: <strong className="font-bold">{availableBedsCount}/{beds.length}</strong></span>
            </button>

            <button
              onClick={() => {
                setDarkMode(!darkMode);
                addToast('เปลี่ยนโหมดการแสดงผล', `เปิดใช้งาน ${!darkMode ? 'Dark Mode' : 'Light Mode'} เรียบร้อยแล้ว`, 'info');
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all ${
                darkMode 
                  ? 'bg-slate-900 border-slate-800 text-amber-400 hover:bg-slate-800' 
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 shadow-sm'
              }`}
            >
              {darkMode ? <Sun size={16} className="text-amber-400" /> : <Moon size={16} className="text-indigo-600" />}
            </button>

            <div className="relative hidden sm:block">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="ค้นหารหัสด่วน..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className={`w-52 pl-9 pr-4 py-2 text-xs rounded-xl border focus:outline-none focus:border-teal-500 ${theme.inputBg}`}
              />
            </div>

            <button 
              onClick={() => setShowQrModal(true)}
              className={`p-2.5 rounded-xl border transition-all ${darkMode ? 'bg-slate-900 border-slate-800 text-teal-400 hover:bg-slate-800' : 'bg-white border-slate-200 text-teal-700 hover:bg-slate-50 shadow-sm'}`}
              title="สแกนบัตรนักศึกษา / QR Code"
            >
              <QrCode size={18} />
            </button>

            <button 
              onClick={() => setActiveTab('visit-record')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-semibold text-xs shadow-lg shadow-teal-500/20 hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus size={16} className="stroke-[3]" />
              <span>ลงรับบริการใหม่</span>
            </button>
          </div>
        </header>

        {/* MAIN BODY VIEWS */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          
          {/* VIEW 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-8 max-w-7xl mx-auto">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-900 to-emerald-900 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-white/10 border border-white/20 shrink-0">
                    <ShieldCheck size={26} className="text-teal-300" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">UniCare Digital Clinic System (Google Apps Script Enabled)</h4>
                    <p className="text-xs text-teal-200 mt-0.5">
                      เชื่อมฐานข้อมูล Google Sheets อัตโนมัติ • ปลอดภัยตามมาตรฐาน PDPA • ไม่ส่งข้อมูลระบุตัวตนนักศึกษาไปยัง AI ภายนอก
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setShowQrModal(true)} 
                    className="px-4 py-2 rounded-xl bg-white text-teal-900 font-bold text-xs hover:bg-teal-50 transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    <QrCode size={14} /> สแกนบัตรคิว
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
                      <h3 className={`text-3xl font-black mt-2 tracking-tight ${theme.heading}`}>{medicines.filter(m => m.stock <= m.min).length} <span className={`text-sm font-normal ${theme.subText}`}>รายการ</span></h3>
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
                      <p className={`text-xs font-semibold uppercase tracking-wider ${theme.subText}`}>AI Assistant Status</p>
                      <h3 className={`text-lg font-bold mt-2 tracking-tight text-teal-600 dark:text-teal-400 flex items-center gap-2`}>
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span> พร้อมใช้งาน
                      </h3>
                    </div>
                    <div className="p-3 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                      <Bot size={22} />
                    </div>
                  </div>
                  <div className={`mt-4 flex items-center gap-2 text-xs ${theme.subText}`}>
                    <span>ปลอดภัยตามมาตรฐาน PDPA</span>
                  </div>
                </div>
              </div>

              {/* Live Bed Board */}
              <div className={`rounded-2xl border p-6 ${theme.card}`}>
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className={`font-bold text-base ${theme.heading}`}>ผังเตียงพักฟื้น (เรียลไทม์)</h3>
                    <p className={`text-xs mt-0.5 ${theme.subText}`}>ว่าง {availableBedsCount} จาก {beds.length} เตียง — เลือกเตียงได้ในหน้าบันทึกเข้าใช้บริการ</p>
                  </div>
                  <button onClick={() => setBedManagementModal(true)} className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                    จัดการเตียง <ChevronRight size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {beds.map(b => (
                    <div key={b.id} className={`p-3 rounded-xl border text-xs ${b.status === 'occupied' ? 'bg-rose-500/5 border-rose-500/30' : 'bg-emerald-500/5 border-emerald-500/30'}`}>
                      <div className="flex items-center justify-between">
                        <Bed size={16} className={b.status === 'occupied' ? 'text-rose-500' : 'text-emerald-500'} />
                        <span className={`text-[10px] font-bold ${b.status === 'occupied' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{b.status === 'occupied' ? 'ไม่ว่าง' : 'ว่าง'}</span>
                      </div>
                      <p className={`font-semibold mt-1.5 truncate ${theme.heading}`}>{b.name}</p>
                      {b.status === 'occupied' ? (
                        <>
                          <p className={`truncate text-[11px] ${theme.subText}`}>{b.symptom}</p>
                          <p className={`text-[10px] font-mono ${theme.subText}`}>เข้า {b.timeIn}</p>
                          <button onClick={() => handleDischarge(b.id)} className="mt-1.5 w-full py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300 font-semibold hover:bg-rose-500/20 text-[11px]">คืนเตียง</button>
                        </>
                      ) : (
                        <p className={`text-[11px] ${theme.subText}`}>พร้อมใช้งาน</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Visits Table */}
              <div className={`rounded-2xl border p-6 ${theme.card}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className={`font-bold text-base ${theme.heading}`}>รายการผู้เข้าใช้บริการล่าสุดวันนี้</h3>
                    <p className={`text-xs mt-0.5 ${theme.subText}`}>อัปเดตแบบเรียลไทม์จากระบบห้องพยาบาล</p>
                  </div>
                  <button onClick={() => setActiveTab('visit-record')} className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1">
                    ดูทั้งหมด <ChevronRight size={14} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${theme.tableHeader}`}>
                        <th className="py-3 px-4 font-semibold">เวลา</th>
                        <th className="py-3 px-4 font-semibold">รหัสนักศึกษา</th>
                        <th className="py-3 px-4 font-semibold">ชื่อ-นามสกุล</th>
                        <th className="py-3 px-4 font-semibold">คณะ</th>
                        <th className="py-3 px-4 font-semibold">อาการสำคัญ</th>
                        <th className="py-3 px-4 font-semibold">ระดับความเร่งด่วน</th>
                        <th className="py-3 px-4 font-semibold">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {visits.slice(0, 8).map(v => (
                        <tr key={v.id} className="transition-colors hover:bg-slate-500/5">
                          <td className="py-3.5 px-4 font-mono font-medium">{v.time}</td>
                          <td className="py-3.5 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">{v.studentId}</td>
                          <td className="py-3.5 px-4 font-semibold">{v.studentName}</td>
                          <td className="py-3.5 px-4">{v.faculty}</td>
                          <td className="py-3.5 px-4">{v.symptom}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              v.triage === 'ฉุกเฉิน' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                              v.triage === 'ด่วน' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                              'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                            }`}>
                              {v.triage}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-medium">{v.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 2: VISIT RECORD & AI SYMPTOM SCREENER */}
          {activeTab === 'visit-record' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className={`font-bold text-lg ${theme.heading}`}>บันทึกการเข้าใช้บริการห้องพยาบาล</h3>
                    <p className={`text-xs mt-1 ${theme.subText}`}>สแกนบัตร → เลือกอาการมาตรฐาน → AI ซักประวัติ/แนะนำ → ตรวจแพ้ยาอัตโนมัติ → บันทึก & ตัดสต็อก</p>
                  </div>
                  <button 
                    onClick={() => setShowQrModal(true)}
                    className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/30 text-xs font-semibold hover:bg-teal-500/20"
                  >
                    <QrCode size={16} /> สแกนบัตรนักศึกษา
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* ===== LEFT: Student, Bed, Dispense ===== */}
                  <div className="space-y-4">
                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${theme.subText}`}>① ค้นหารหัส หรือ ชื่อ-นามสกุล (หรือสแกนบัตร)</label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                          type="text" 
                          placeholder="พิมพ์รหัสนักศึกษา เช่น 66010012..."
                          value={globalSearch}
                          onChange={(e) => { setGlobalSearch(e.target.value); setDispenseList([]); setAllergyBlock(null); }}
                          className={`w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border focus:outline-none focus:border-teal-500 ${theme.inputBg}`}
                        />
                      </div>
                    </div>

                    {/* Selected Student Profile Box */}
                    {!selectedStudent ? (
                      <div className={`p-4 rounded-xl border border-dashed text-center text-xs ${theme.subText}`}>
                        กรุณาระบุรหัสนักศึกษาหรือสแกน QR Code เพื่อดึงข้อมูลประวัติสุขภาพและการแพ้ยา
                      </div>
                    ) : (
                      <div className={`p-4 rounded-xl border ${selectedStudent.allergies.length ? 'bg-rose-500/5 border-rose-500/30' : theme.cardInner}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">{selectedStudent.id}</span>
                            <h4 className={`font-bold text-sm mt-1.5 ${theme.heading}`}>{selectedStudent.name}</h4>
                            <p className={`text-xs mt-0.5 ${theme.subText}`}>{selectedStudent.faculty} • {selectedStudent.year} • มาใช้บริการ {selectedStudent.visitsCount || 0} ครั้ง</p>
                          </div>
                          <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800">กรุ๊ปเลือด: {selectedStudent.blood}</span>
                        </div>

                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                              <ShieldAlert size={16} /> ประวัติการแพ้ยา:
                            </span>
                            <button 
                              onClick={() => setAllergyModalStudent(selectedStudent)}
                              className="text-[11px] text-teal-600 dark:text-teal-400 hover:underline font-semibold"
                            >
                              + เพิ่มประวัติแพ้ยา
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {selectedStudent.allergies.length > 0 ? selectedStudent.allergies.map((alg, idx) => {
                              const detail = (selectedStudent.allergyDetails || []).find(d => d.drugName === alg);
                              return (
                                <span key={idx} className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300 text-xs font-bold border border-rose-500/20" title={detail ? `${detail.reaction} • ${detail.severity}` : ''}>
                                  ⚠️ {alg}{detail && !detail.verified ? ' (รอยืนยัน)' : ''}
                                </span>
                              );
                            }) : (
                              <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">ไม่พบประวัติการแพ้ยาในระบบ</span>
                            )}
                          </div>
                          {selectedStudent.emergencyContact && (
                            <p className={`text-[11px] mt-2 ${theme.subText}`}>ผู้ติดต่อฉุกเฉิน: {selectedStudent.emergencyContact}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bed */}
                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${theme.subText}`}>
                        กำหนดเตียงพักฟื้น (ถ้ามี) — <span className={availableBedsCount ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600'}>ว่าง {availableBedsCount}/{beds.length} เตียง</span>
                      </label>
                      <div className="relative">
                        <Bed className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <select 
                          value={assignedBedId}
                          onChange={(e) => setAssignedBedId(e.target.value)}
                          disabled={availableBedsCount === 0}
                          className={`w-full pl-9 pr-4 py-2.5 text-xs rounded-xl border focus:outline-none focus:border-teal-500 ${theme.inputBg}`}
                        >
                          <option value="">{availableBedsCount === 0 ? '-- เตียงเต็ม (กรุณาคืนเตียงก่อน) --' : '-- ไม่ต้องการนอนพักเตียง --'}</option>
                          {beds.filter(b => b.status === 'available').map(b => (
                            <option key={b.id} value={b.id}>{b.name} (ว่าง)</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Dispense medicines with allergy cross-check */}
                    <div className={`p-4 rounded-xl border space-y-3 ${theme.cardInner}`}>
                      <label className={`block text-xs font-bold ${theme.heading}`}>💊 รายการจ่ายยา <span className={`font-normal ${theme.subText}`}>(ระบบตรวจแพ้ยาอัตโนมัติ รวมถึงแพ้ข้ามกลุ่มยา)</span></label>
                      <div className="flex gap-2">
                        <select
                          value={dispenseMedId}
                          onChange={(e) => setDispenseMedId(e.target.value)}
                          className={`flex-1 min-w-0 px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                        >
                          <option value="">-- เลือกยา / เวชภัณฑ์ --</option>
                          {medicines.map(m => {
                            const risk = selectedStudent && checkDrugAllergy(m.name, selectedStudent.allergies);
                            return (
                              <option key={m.id} value={m.id} disabled={m.stock <= 0}>
                                {risk ? '⛔ ' : ''}{m.name} (คงเหลือ {m.stock} {m.unit}){risk ? ' — แพ้ยา!' : ''}
                              </option>
                            );
                          })}
                        </select>
                        <input
                          type="number" min={1} value={dispenseQty}
                          onChange={(e) => setDispenseQty(Math.max(1, parseInt(e.target.value) || 1))}
                          className={`w-16 px-2 py-2 text-xs rounded-xl border text-center ${theme.inputBg}`}
                        />
                        <button
                          onClick={() => { if (dispenseMedId) addMedToDispense(dispenseMedId, dispenseQty); }}
                          className="px-3 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700 flex items-center gap-1"
                        >
                          <Plus size={14} /> เพิ่ม
                        </button>
                      </div>

                      {allergyBlock && (
                        <div className="p-3 rounded-xl bg-rose-600 text-white text-xs space-y-1 animate-pulse">
                          <p className="font-black flex items-center gap-1.5"><AlertTriangle size={16} /> ระงับการจ่ายยา: {allergyBlock.med}</p>
                          <p>{allergyBlock.message}</p>
                          <p className="opacity-90">กรุณาเลือกยาทางเลือกอื่น หรือปรึกษาแพทย์</p>
                        </div>
                      )}

                      {dispenseList.length === 0 ? (
                        <p className={`text-[11px] ${theme.subText}`}>ยังไม่มีรายการยา</p>
                      ) : (
                        <div className="space-y-1.5">
                          {dispenseList.map(d => (
                            <div key={d.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs">
                              <span className="font-semibold text-emerald-700 dark:text-emerald-300">✓ {d.name}</span>
                              <span className="flex items-center gap-3">
                                <span className="font-mono">{d.qty} {d.unit}</span>
                                <button onClick={() => setDispenseList(dispenseList.filter(x => x.id !== d.id))} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ===== RIGHT: Symptoms, AI, Triage ===== */}
                  <div className="space-y-4">
                    <label className={`block text-xs font-semibold ${theme.subText}`}>② เลือกอาการมาตรฐาน (Standard Symptoms) — ใช้ทำสถิติได้แม่นยำ</label>
                    <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto p-2 rounded-xl border bg-slate-50 dark:bg-slate-900/50">
                      {STANDARD_SYMPTOMS.map((sym, idx) => {
                        const isSelected = selectedStandardSymptoms.includes(sym);
                        return (
                          <button
                            key={idx}
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

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>หมายเหตุอาการเพิ่มเติม (พิมพ์เพิ่มได้)</label>
                      <input 
                        type="text" 
                        placeholder="ระบุรายละเอียดอาการเพิ่มเติม เช่น เวียนศีรษะตอนลุกขึ้น..."
                        value={customSymptomNote}
                        onChange={(e) => setCustomSymptomNote(e.target.value)}
                        className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={startInterview}
                        className="py-2.5 rounded-xl border-2 border-teal-500 text-teal-700 dark:text-teal-300 font-bold text-xs hover:bg-teal-500/10 flex items-center justify-center gap-2"
                      >
                        <MessageCircleQuestion size={16} /> AI ซักประวัติอาการ
                      </button>
                      <button 
                        onClick={() => handleRunAiSymptomChecker()}
                        disabled={aiAnalyzing}
                        className="py-2.5 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-500/20 hover:brightness-110 flex items-center justify-center gap-2"
                      >
                        {aiAnalyzing ? <RefreshCw className="animate-spin" size={16} /> : <Sparkles size={16} />}
                        <span>AI วิเคราะห์ & แนะนำ</span>
                      </button>
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${theme.subText}`}>③ ระดับความเร่งด่วน (Triage) — เจ้าหน้าที่ปรับได้</label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { v: 'ปกติ', c: 'emerald' },
                          { v: 'ด่วน', c: 'amber' },
                          { v: 'ฉุกเฉิน', c: 'rose' },
                        ].map(t => (
                          <button
                            key={t.v}
                            onClick={() => setTriageLevel(t.v)}
                            className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                              triageLevel === t.v
                                ? t.c === 'emerald' ? 'bg-emerald-500 text-white border-emerald-500' : t.c === 'amber' ? 'bg-amber-500 text-white border-amber-500' : 'bg-rose-600 text-white border-rose-600'
                                : darkMode ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600 bg-white'
                            }`}
                          >
                            {t.v}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1 ${theme.subText}`}>การวินิจฉัยเบื้องต้น (โดยเจ้าหน้าที่)</label>
                      <input
                        type="text"
                        value={diagnosisInput}
                        onChange={(e) => setDiagnosisInput(e.target.value)}
                        placeholder="เช่น Common cold, Gastritis..."
                        className={`w-full px-3 py-2 text-xs rounded-xl border ${theme.inputBg}`}
                      />
                    </div>
                  </div>
                </div>

                {/* AI Safety Banner & Suggestion Box */}
                {aiSuggestion && (
                  <div className="mt-6 p-5 rounded-2xl bg-teal-500/10 border border-teal-500/30 space-y-3 animate-in fade-in-50">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-2">
                        <Sparkles size={16} /> ข้อเสนอแนะจากระบบ AI Assistant (Anonymized & Secure)
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                        ⚠️ เป็นเพียงข้อเสนอแนะ — ผู้ตัดสินใจสูงสุดคือพยาบาล/เจ้าหน้าที่วิชาชีพ
                      </span>
                    </div>

                    {aiSuggestion.redFlag && (
                      <div className="p-3 rounded-xl bg-rose-600 text-white text-xs font-bold flex items-center gap-2">
                        <AlertTriangle size={16} /> พบอาการกลุ่มเสี่ยง (Red flag) — ประเมินสัญญาณชีพทันที และพิจารณาส่งต่อโรงพยาบาล
                      </div>
                    )}

                    {aiSuggestion.triage && (
                      <div className={`p-3 rounded-xl text-xs border ${aiSuggestion.triage.level === 'ฉุกเฉิน' ? 'bg-rose-500/10 border-rose-500/30' : aiSuggestion.triage.level === 'ด่วน' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-emerald-500/10 border-emerald-500/30'}`}>
                        <span className="font-bold">ผลประเมินจากการซักประวัติ: {aiSuggestion.triage.level}</span>
                        <span className={theme.subText}> — {aiSuggestion.triage.reasons.join(', ')}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-teal-500/20">
                        <p className="font-semibold text-teal-800 dark:text-teal-300">แนวทางการวินิจฉัย:</p>
                        <ul className="mt-1 space-y-0.5 opacity-90 list-disc list-inside">
                          {aiSuggestion.diagnoses.map((d, i) => <li key={i}>{d}</li>)}
                        </ul>
                      </div>
                      <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-teal-500/20">
                        <p className="font-semibold text-teal-800 dark:text-teal-300">ยาที่แนะนำ (ตรวจแพ้ยา & สต็อกแล้ว):</p>
                        {aiSuggestion.suggestedMeds.length === 0 && <p className="mt-1 opacity-80">ไม่แนะนำยา — ดูแลตามอาการ</p>}
                        <div className="mt-1 space-y-1.5">
                          {aiSuggestion.suggestedMeds.map((m, i) => (
                            <div key={i} className="flex items-center justify-between gap-2">
                              <span className={m.allergy ? 'line-through text-rose-600' : ''}>{m.name}</span>
                              {m.allergy ? (
                                <span className="text-[10px] font-bold text-rose-600 shrink-0">⛔ แพ้ยา</span>
                              ) : m.outOfStock ? (
                                <span className="text-[10px] font-bold text-amber-600 shrink-0">หมดสต็อก</span>
                              ) : (
                                <button onClick={() => addMedToDispense(m.name, 1)} className="text-[10px] px-2 py-0.5 rounded bg-teal-600 text-white font-bold shrink-0 hover:bg-teal-700">+ จ่าย</button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/60 dark:bg-slate-900/60 border border-teal-500/20">
                        <p className="font-semibold text-teal-800 dark:text-teal-300">คำแนะนำการดูแล:</p>
                        <ul className="mt-1 space-y-0.5 opacity-90 list-disc list-inside">
                          {aiSuggestion.advice.map((a, i) => <li key={i}>{a}</li>)}
                        </ul>
                      </div>
                    </div>

                    <details className="text-[11px]">
                      <summary className="cursor-pointer font-semibold text-teal-700 dark:text-teal-300">🔒 ดูข้อมูลที่ AI ใช้ประมวลผล (ไม่มีชื่อ / รหัส / เบอร์โทร)</summary>
                      <pre className={`mt-2 p-3 rounded-xl overflow-x-auto font-mono ${darkMode ? 'bg-slate-950' : 'bg-white'}`}>{JSON.stringify(aiSuggestion.anonymizedPayload, null, 2)}</pre>
                    </details>
                  </div>
                )}

                {/* Action Save Button */}
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
                  <button
                    onClick={resetVisitForm}
                    className={`px-5 py-2.5 rounded-xl border text-xs font-semibold ${darkMode ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'}`}
                  >
                    ล้างฟอร์ม
                  </button>
                  <button 
                    onClick={handleSaveVisit}
                    className="px-6 py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-lg shadow-teal-600/20"
                  >
                    บันทึกข้อมูลการรักษาและจ่ายยา
                  </button>
                </div>
              </div>

              {/* All visits history */}
              <div className={`rounded-2xl border p-6 ${theme.card}`}>
                <h3 className={`font-bold text-base mb-4 ${theme.heading}`}>ประวัติการเข้ารับบริการวันนี้ ({visits.length} รายการ)</h3>
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${theme.tableHeader}`}>
                        <th className="py-2.5 px-3 font-semibold">รหัส</th>
                        <th className="py-2.5 px-3 font-semibold">เวลา</th>
                        <th className="py-2.5 px-3 font-semibold">ผู้ป่วย</th>
                        <th className="py-2.5 px-3 font-semibold">อาการ</th>
                        <th className="py-2.5 px-3 font-semibold">Triage</th>
                        <th className="py-2.5 px-3 font-semibold">วินิจฉัย</th>
                        <th className="py-2.5 px-3 font-semibold">ยาที่จ่าย</th>
                        <th className="py-2.5 px-3 font-semibold">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {visits.map(v => (
                        <tr key={v.id} className="hover:bg-slate-500/5">
                          <td className="py-2.5 px-3 font-mono text-teal-600 dark:text-teal-400">{v.id}</td>
                          <td className="py-2.5 px-3 font-mono">{v.time}</td>
                          <td className="py-2.5 px-3 font-semibold">{v.studentName}</td>
                          <td className="py-2.5 px-3">{v.symptom}</td>
                          <td className="py-2.5 px-3">{v.triage}</td>
                          <td className="py-2.5 px-3">{v.diagnosis}</td>
                          <td className="py-2.5 px-3">{(v.meds || []).join(', ') || '-'}</td>
                          <td className="py-2.5 px-3">{v.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: INVENTORY */}
          {activeTab === 'inventory' && (
            <div className="max-w-6xl mx-auto space-y-6">
              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className={`font-bold text-lg ${theme.heading}`}>สต็อกยา & เวชภัณฑ์ห้องพยาบาล</h3>
                    <p className={`text-xs mt-1 ${theme.subText}`}>ตรวจสอบจำนวนคงเหลือ Lot ผลิต และวันหมดอายุแบบเรียลไทม์ (อัปเดตทันทีเมื่อจ่ายยา)</p>
                  </div>
                  <button 
                    onClick={() => addToast('เพิ่มรายการยาสำเร็จ', 'เปิดหน้าต่างเพิ่มเวชภัณฑ์ใหม่')}
                    className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-md flex items-center gap-1.5"
                  >
                    <Plus size={16} /> เพิ่มยาในระบบ
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${theme.tableHeader}`}>
                        <th className="py-3 px-4 font-semibold">รหัสยา</th>
                        <th className="py-3 px-4 font-semibold">ชื่อยา / เวชภัณฑ์</th>
                        <th className="py-3 px-4 font-semibold">หมวดหมู่</th>
                        <th className="py-3 px-4 font-semibold">จำนวนคงเหลือ</th>
                        <th className="py-3 px-4 font-semibold">จุดสั่งซื้อขั้นต่ำ</th>
                        <th className="py-3 px-4 font-semibold">Lot / วันหมดอายุ</th>
                        <th className="py-3 px-4 font-semibold">สถานะสต็อก</th>
                        <th className="py-3 px-4 font-semibold text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {medicines.map(m => {
                        const status = getStockStatus(m);
                        const days = daysUntil(m.expiry);
                        return (
                          <tr key={m.id} className="transition-colors hover:bg-slate-500/5">
                            <td className="py-3.5 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">{m.id}</td>
                            <td className="py-3.5 px-4 font-semibold">{m.name}</td>
                            <td className="py-3.5 px-4">{m.category}</td>
                            <td className="py-3.5 px-4 font-mono font-bold">{m.stock} {m.unit}</td>
                            <td className="py-3.5 px-4 font-mono">{m.min} {m.unit}</td>
                            <td className="py-3.5 px-4 font-mono text-[11px]">
                              {m.lot} <br/>
                              <span className={days <= 60 ? 'text-rose-500 font-bold' : theme.subText}>
                                {m.expiry} ({days < 0 ? 'หมดอายุแล้ว' : `อีก ${days} วัน`})
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                status === 'วิกฤต' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                                status === 'เหลือน้อย' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                                'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              }`}>
                                {status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button 
                                onClick={() => {
                                  setMedicines(medicines.map(med => med.id === m.id ? { ...med, stock: med.stock + 50, status: getStockStatus({ stock: med.stock + 50, min: med.min }) } : med));
                                  addToast('เติมสต็อกสำเร็จ', `เพิ่มจำนวนยา ${m.name} +50 ${m.unit} เรียบร้อย`);
                                }}
                                className="px-3 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold hover:bg-teal-500/20 text-xs"
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
            </div>
          )}

          {/* VIEW 4: DATA IMPORT */}
          {activeTab === 'data-import' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className={`p-8 rounded-2xl border text-center ${theme.card}`}>
                <div className="w-16 h-16 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto mb-4">
                  <Upload size={32} />
                </div>
                <h3 className={`font-bold text-lg ${theme.heading}`}>นำเข้าข้อมูลนักศึกษาผ่านไฟล์ Google Sheets / Excel</h3>
                <p className={`text-xs mt-1 max-w-md mx-auto ${theme.subText}`}>
                  ลากวางไฟล์ CSV หรือ XLSX ลงที่นี่เพื่อซิงค์ฐานข้อมูลรายชื่อนักศึกษาใหม่ประจำปีการศึกษาอัตโนมัติ
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

          {/* VIEW 5: STUDENTS DIRECTORY & ALLERGIES */}
          {activeTab === 'students' && (
            <div className="max-w-6xl mx-auto space-y-6">
              {pendingAllergyCount > 0 && (
                <div className="p-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-amber-700 dark:text-amber-300 font-semibold">
                    <Clock size={18} />
                    <span>มีรายการแพ้ยาที่นักศึกษาแจ้งด้วยตนเองผ่านพอร์ทัล รอเจ้าหน้าที่ตรวจสอบยืนยัน {pendingAllergyCount} รายการ</span>
                  </div>
                </div>
              )}

              <div className={`p-6 rounded-2xl border ${theme.card}`}>
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className={`font-bold text-lg ${theme.heading}`}>รายชื่อนักศึกษา & ข้อมูลการแพ้ยา</h3>
                    <p className={`text-xs mt-1 ${theme.subText}`}>ทะเบียนประวัติสุขภาพรายบุคคลเพื่อความปลอดภัยในการจ่ายยา</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="ค้นหารหัสด่วน..."
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      className={`w-48 pl-9 pr-3 py-1.5 text-xs rounded-xl border ${theme.inputBg}`}
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className={`border-b ${theme.tableHeader}`}>
                        <th className="py-3 px-4 font-semibold">รหัสนักศึกษา</th>
                        <th className="py-3 px-4 font-semibold">ชื่อ-นามสกุล</th>
                        <th className="py-3 px-4 font-semibold">คณะ / ชั้นปี</th>
                        <th className="py-3 px-4 font-semibold">กรุ๊ปเลือด</th>
                        <th className="py-3 px-4 font-semibold">ประวัติการแพ้ยา</th>
                        <th className="py-3 px-4 font-semibold text-right">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {students.filter(s => s.id.includes(globalSearch) || s.name.includes(globalSearch)).map(s => (
                        <tr key={s.id} className="transition-colors hover:bg-slate-500/5">
                          <td className="py-3.5 px-4 font-mono font-bold text-teal-600 dark:text-teal-400">{s.id}</td>
                          <td className="py-3.5 px-4 font-semibold">{s.name}</td>
                          <td className="py-3.5 px-4">{s.faculty} • {s.year}</td>
                          <td className="py-3.5 px-4 font-mono">{s.blood}</td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap gap-1.5 items-center">
                              {s.allergies.length > 0 ? s.allergies.map((alg, i) => {
                                const detail = (s.allergyDetails || []).find(d => d.drugName === alg);
                                return (
                                  <span key={i} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300 text-[11px] font-bold border border-rose-500/20">
                                    ⚠️ {alg}
                                    {detail && !detail.verified && (
                                      <button
                                        onClick={() => verifyAllergy(s.id, alg)}
                                        className="px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] hover:bg-emerald-700"
                                        title="คลิกเพื่อยืนยันประวัติแพ้ยารายการนี้"
                                      >
                                        ยืนยัน
                                      </button>
                                    )}
                                  </span>
                                );
                              }) : (
                                <span className="text-emerald-600 dark:text-emerald-400">ปกติ</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2">
                            <button 
                              onClick={() => setAllergyModalStudent(s)}
                              className="px-3 py-1 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 font-semibold hover:bg-teal-500/20 text-xs"
                            >
                              + เพิ่มแพ้ยา
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
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

          {/* VIEW 8: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-3xl mx-auto p-6 rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 space-y-4">
              <h3 className="font-bold text-base">ตั้งค่าการเชื่อมต่อ Google Apps Script & Google Sheets</h3>
              <p className="text-xs text-slate-500">ซิงค์ฐานข้อมูลออนไลน์และจัดการสิทธิ์พยาบาลผู้ใช้งานระบบ</p>
              <div className="p-4 rounded-xl border bg-emerald-500/5 border-emerald-500/20 text-xs space-y-2">
                <p className="font-bold text-emerald-700 dark:text-emerald-300">✅ สถานะ: เชื่อมต่อ Web App URL สำเร็จ</p>
                <p className="font-mono text-[11px] opacity-80">https://script.google.com/macros/s/AKfycbx.../exec</p>
              </div>
            </div>
          )}

          {/* VIEW 9: STUDENT PORTAL */}
          {activeTab === 'student-portal' && (
            <StudentPortal students={students} theme={theme} onDeclare={registerAllergy} addToast={addToast} />
          )}
        </main>
      </div>

      {/* MODALS */}
      {/* 1. QR Code Scanner Modal */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in-50">
          <div className={`max-w-md w-full p-6 rounded-3xl border shadow-2xl relative ${theme.modalBg}`}>
            <button onClick={() => setShowQrModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>

            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto">
                <QrCode size={28} />
              </div>
              <h3 className={`font-bold text-lg ${theme.heading}`}>สแกนบัตรนักศึกษา / QR Code</h3>
              <p className={`text-xs ${theme.subText}`}>รองรับเครื่องสแกนบาร์โค้ด/QR หรือเลือกจำลองสแกนด้านล่างเพื่อดึงประวัติทันที</p>

              <form
                onSubmit={e => { e.preventDefault(); if (scanInput.trim()) loadStudentById(scanInput); }}
                className="flex gap-2 pt-2"
              >
                <input
                  autoFocus
                  type="text"
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  placeholder="ยิงบาร์โค้ด / พิมพ์รหัส เช่น 66010012"
                  className={`flex-1 px-3 py-2 text-xs rounded-xl border font-mono ${theme.inputBg}`}
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold hover:bg-teal-700">
                  ดึงข้อมูล
                </button>
              </form>

              <div className="grid grid-cols-1 gap-2 pt-3 max-h-64 overflow-y-auto">
                {students.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleSimulateQRScan(s.id)}
                    className={`p-3 rounded-xl border text-left flex justify-between items-center transition-all text-xs font-semibold ${darkMode ? 'hover:bg-slate-800 border-slate-800' : 'hover:bg-teal-50 border-slate-200'}`}
                  >
                    <div>
                      <span className="text-teal-600 dark:text-teal-400 font-mono">{s.id}</span>
                      <p className={`font-bold ${theme.heading}`}>{s.name}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] px-2 py-1 rounded bg-slate-200 dark:bg-slate-800">{s.faculty}</span>
                      {s.allergies.length > 0 && <p className="text-[10px] text-rose-500 font-bold mt-1">⚠️ แพ้ยา {s.allergies.length} รายการ</p>}
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
                  <label className={`block font-semibold mb-1 ${theme.heading}`}>ชื่อยาที่แพ้</label>
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
                  <label className={`block font-semibold mb-1 ${theme.heading}`}>กลุ่มยา (ใช้ตรวจการแพ้ยาข้ามกลุ่ม)</label>
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
