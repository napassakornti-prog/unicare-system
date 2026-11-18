import React, { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertCircle, ShieldCheck, Moon, Sun, BedDouble, Pill, Siren, HeartPulse,
  GraduationCap, Briefcase, Stethoscope, Check, ChevronDown, Mail, Lock, Eye, EyeOff,
  User, ArrowLeft, Loader2, CheckCircle2,
} from 'lucide-react';
import {
  ALLOWED_DOMAIN, LoginRole, getSelectedLoginRole, isUniversityEmail,
  signInWithPassword, signUpWithPassword, sendPasswordReset,
} from '../auth';

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.6l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

const FEATURES = [
  { icon: BedDouble, text: 'จองเตียงพักฟื้นล่วงหน้า ดูเตียงว่างแบบเรียลไทม์' },
  { icon: Pill, text: 'ขอยาสามัญประจำห้องพยาบาลผ่านระบบออนไลน์' },
  { icon: HeartPulse, text: 'บันทึกประวัติการแพ้ยาเพื่อความปลอดภัยของคุณ' },
  { icon: Siren, text: 'ปุ่มเรียกฉุกเฉิน แจ้งเจ้าหน้าที่ทันทีขณะพักที่เตียง' },
];

const ROLE_OPTIONS: { id: LoginRole; label: string; desc: string; icon: any }[] = [
  { id: 'student', label: 'นักศึกษา', desc: 'จองเตียง ขอยา แจ้งแพ้ยา', icon: GraduationCap },
  { id: 'personnel', label: 'บุคลากรทั่วไป', desc: 'อาจารย์และบุคลากรสายสนับสนุน', icon: Briefcase },
  { id: 'admin', label: 'เจ้าหน้าที่ห้องพยาบาล', desc: 'พยาบาลและผู้ดูแลระบบ', icon: Stethoscope },
];

// ---------- ตัวเลือกประเภทผู้ใช้งาน (Dropdown บนเดสก์ท็อป / Bottom sheet บนมือถือ) ----------
function RoleSelector({ value, onChange, options = ROLE_OPTIONS }: { value: LoginRole; onChange: (r: LoginRole) => void; options?: typeof ROLE_OPTIONS }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = options.find(r => r.id === value) || options[0];
  const CurIcon = current.icon;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const list = (
    <ul role="listbox" className="p-1.5 space-y-0.5">
      {options.map(o => {
        const Icon = o.icon;
        const active = o.id === value;
        return (
          <li key={o.id}>
            <button
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => { onChange(o.id); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${active ? 'bg-teal-50' : 'hover:bg-slate-50'}`}
            >
              <span className={`p-2 rounded-lg shrink-0 ${active ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600'}`}><Icon size={16} /></span>
              <span className="flex-1 min-w-0">
                <span className={`block text-xs font-bold ${active ? 'text-teal-900' : 'text-slate-800'}`}>{o.label}</span>
                <span className="block text-[11px] text-slate-500 truncate">{o.desc}</span>
              </span>
              {active && <Check size={16} className="text-teal-600 shrink-0" />}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div ref={ref} className="relative">
      <p className="text-[11px] font-bold text-slate-500 mb-1.5">เข้าใช้งานในฐานะ</p>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-slate-200 bg-white hover:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 transition-all"
      >
        <span className="p-2 rounded-lg bg-teal-600 text-white shrink-0"><CurIcon size={16} /></span>
        <span className="flex-1 text-left text-sm font-bold text-slate-800 truncate">{current.label}</span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          {/* เดสก์ท็อป: Dropdown */}
          <div className="hidden sm:block absolute z-30 left-0 right-0 mt-1.5 rounded-2xl border border-slate-200 bg-white shadow-xl animate-pop">
            {list}
          </div>
          {/* มือถือ: Drawer ด้านล่าง */}
          <div className="sm:hidden fixed inset-0 z-40">
            <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
            <div className="absolute bottom-0 inset-x-0 rounded-t-3xl bg-white pb-4 animate-sheet">
              <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full bg-slate-300" />
              <p className="px-5 pt-2 pb-1 text-sm font-black text-teal-900">เลือกประเภทผู้ใช้งาน</p>
              {list}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------- ช่องกรอกข้อมูล ----------
function Field({
  label, icon: Icon, type = 'text', value, onChange, placeholder, autoComplete, error, right, helper,
}: {
  label: string; icon: any; type?: string; value: string; onChange: (v: string) => void;
  placeholder?: string; autoComplete?: string; error?: string; right?: React.ReactNode; helper?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] font-bold text-slate-500">{label}</span>
      <div className={`mt-1.5 flex items-center gap-2 px-3 rounded-xl border bg-white transition-all focus-within:ring-2 ${error ? 'border-rose-400 focus-within:ring-rose-500/20' : 'border-slate-200 focus-within:border-teal-500 focus-within:ring-teal-500/20'}`}>
        <Icon size={16} className="text-slate-400 shrink-0" />
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="flex-1 min-w-0 py-3 text-sm bg-transparent outline-none text-slate-800 placeholder-slate-400"
        />
        {right}
      </div>
      {error
        ? <span className="block mt-1 text-[11px] text-rose-600">{error}</span>
        : helper && <span key={helper} className="block mt-1 text-[11px] text-slate-400 animate-fade-in">{helper}</span>}
    </label>
  );
}

type Mode = 'login' | 'register' | 'forgot';

export default function LoginPage({
  darkMode, onToggleDark, onGoogle, error, loading, configured,
}: {
  darkMode: boolean;
  onToggleDark: () => void;
  onGoogle: (role: LoginRole) => void;
  error: string;
  loading: boolean;
  configured: boolean;
}) {
  const [mode, setMode] = useState<Mode>('login');
  const [role, setRole] = useState<LoginRole>(() => getSelectedLoginRole() || 'student');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);

  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [success, setSuccess] = useState('');
  const [fieldErr, setFieldErr] = useState<Record<string, string>>({});

  const switchMode = (m: Mode) => {
    setMode(m); setFormError(''); setSuccess(''); setFieldErr({}); setPassword(''); setConfirm('');
    // หน้าสมัครสมาชิกไม่มีสิทธิ์เจ้าหน้าที่ ให้กลับเป็นนักศึกษา
    if (m === 'register' && role === 'admin') setRole('student');
  };

  const emailHelper = role === 'admin'
    ? 'เจ้าหน้าที่ห้องพยาบาลเข้าสู่ระบบด้วยปุ่ม Google ด้านล่าง'
    : role === 'personnel'
      ? 'กรุณาใช้อีเมลมหาวิทยาลัยของบุคลากร'
      : 'กรุณาใช้อีเมลมหาวิทยาลัยของนักศึกษา';

  const eyeBtn = (
    <button type="button" onClick={() => setShowPw(s => !s)} className="p-1 text-slate-400 hover:text-slate-600" aria-label={showPw ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}>
      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (mode === 'register' && fullName.trim().length < 3) errs.name = 'กรุณากรอกชื่อ-นามสกุล';
    if (!email.trim()) errs.email = 'กรุณากรอกอีเมล';
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    else if (mode !== 'login' && !isUniversityEmail(email)) errs.email = `ต้องใช้อีเมลมหาวิทยาลัย (@${ALLOWED_DOMAIN}) เท่านั้น`;
    if (mode !== 'forgot') {
      if (!password) errs.password = 'กรุณากรอกรหัสผ่าน';
      else if (mode === 'register' && password.length < 8) errs.password = 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
    }
    if (mode === 'register' && confirm !== password) errs.confirm = 'รหัสผ่านไม่ตรงกัน';
    setFieldErr(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(''); setSuccess('');
    if (mode !== 'forgot' && role === 'admin') {
      setFormError('เจ้าหน้าที่ห้องพยาบาลต้องเข้าสู่ระบบด้วยปุ่ม Google เท่านั้น');
      return;
    }
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === 'login') {
        const err = await signInWithPassword(email, password, role);
        if (err) setFormError(err);
      } else if (mode === 'register') {
        const { error: err, needsConfirm } = await signUpWithPassword(fullName, email, password, role);
        if (err) setFormError(err);
        else if (needsConfirm) {
          setSuccess('สมัครสมาชิกสำเร็จ! เราส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ');
          setPassword(''); setConfirm('');
        }
        // ถ้าไม่ต้องยืนยันอีเมล ระบบจะเข้าสู่ระบบให้อัตโนมัติผ่าน initAuth
      } else {
        const err = await sendPasswordReset(email);
        if (err) setFormError(err);
        else setSuccess('ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมลของคุณแล้ว');
      }
    } finally {
      setBusy(false);
    }
  };

  const disabled = busy || loading || !configured;
  const shownError = formError || error;
  const title = mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สมัครสมาชิก' : 'ลืมรหัสผ่าน';
  const subtitle = mode === 'login' ? 'ยินดีต้อนรับกลับ กรุณาเข้าสู่ระบบเพื่อใช้งาน'
    : mode === 'register' ? `สร้างบัญชีด้วยอีเมลมหาวิทยาลัย (@${ALLOWED_DOMAIN})`
    : 'กรอกอีเมลเพื่อรับลิงก์ตั้งรหัสผ่านใหม่';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-teal-900 via-teal-700 to-teal-400 relative overflow-hidden">
      <style>{`
        @keyframes uc-pop { from { opacity: 0; transform: translateY(-6px) scale(.98); } to { opacity: 1; transform: none; } }
        @keyframes uc-sheet { from { transform: translateY(100%); } to { transform: none; } }
        @keyframes uc-fade { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
        .animate-pop { animation: uc-pop .15s ease-out; }
        .animate-sheet { animation: uc-sheet .22s ease-out; }
        .animate-fade-in { animation: uc-fade .25s ease-out; }
      `}</style>
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/10 blur-2xl"></div>
      <div className="absolute -bottom-40 -right-24 w-[28rem] h-[28rem] rounded-full bg-teal-300/20 blur-2xl"></div>

      <button
        onClick={onToggleDark}
        className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/15 text-white hover:bg-white/25 transition-all"
        title="สลับโหมดมืด/สว่าง"
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="relative w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl shadow-teal-950/40 grid grid-cols-1 md:grid-cols-5 bg-white">
        {/* ซ้าย: แนะนำระบบ */}
        <div className="hidden md:flex md:col-span-2 relative bg-gradient-to-br from-teal-800 to-teal-600 text-white p-9 flex-col justify-between gap-8 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5"></div>
          <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-teal-950/20"></div>

          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
              <Activity size={26} className="stroke-[2.5]" />
            </div>
            <div className="leading-tight">
              <p className="text-xl font-black tracking-tight">UniCare</p>
              <p className="text-[11px] text-teal-100">ระบบห้องพยาบาล ม.กาฬสินธุ์</p>
            </div>
          </div>

          <div className="relative space-y-5">
            <h1 className="text-3xl font-black leading-tight">ดูแลสุขภาพของคุณ<br />ง่ายขึ้นในที่เดียว</h1>
            <ul className="space-y-3">
              {FEATURES.map(f => {
                const Icon = f.icon;
                return (
                  <li key={f.text} className="flex items-start gap-3 text-sm text-teal-50">
                    <span className="mt-0.5 p-1.5 rounded-lg bg-white/15"><Icon size={15} /></span>
                    <span>{f.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <p className="relative text-[11px] text-teal-200">Smart University Infirmary Management System</p>
        </div>

        {/* ขวา: ฟอร์ม */}
        <div className="md:col-span-3 p-6 sm:p-10 flex flex-col justify-center text-slate-800">
          {/* โลโก้บนมือถือ */}
          <div className="md:hidden flex items-center gap-2.5 mb-5">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center"><Activity size={22} /></div>
            <div className="leading-tight">
              <p className="font-black text-teal-900">UniCare</p>
              <p className="text-[10px] text-slate-500">ระบบห้องพยาบาล ม.กาฬสินธุ์</p>
            </div>
          </div>

          <div key={mode} className="animate-fade-in">
            {mode === 'forgot' && (
              <button type="button" onClick={() => switchMode('login')} className="mb-3 flex items-center gap-1 text-xs font-semibold text-teal-700 hover:underline">
                <ArrowLeft size={14} /> กลับไปหน้าเข้าสู่ระบบ
              </button>
            )}
            <h2 className="text-2xl font-black text-teal-900">{title}</h2>
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>

            <form onSubmit={submit} className="mt-5 space-y-3.5" noValidate>
              {mode !== 'forgot' && (
                <RoleSelector
                  value={role}
                  onChange={setRole}
                  options={mode === 'register' ? ROLE_OPTIONS.filter(o => o.id !== 'admin') : ROLE_OPTIONS}
                />
              )}

              {mode === 'register' && (
                <Field label="ชื่อ-นามสกุล" icon={User} value={fullName} onChange={setFullName} placeholder="เช่น สมชาย ใจดี" autoComplete="name" error={fieldErr.name} />
              )}

              <Field
                label={mode === 'login' ? 'อีเมล' : `อีเมลมหาวิทยาลัย (@${ALLOWED_DOMAIN})`}
                icon={Mail} type="email" value={email} onChange={setEmail}
                placeholder={`เช่น somchai.ja@${ALLOWED_DOMAIN}`} autoComplete="email" error={fieldErr.email}
                helper={mode === 'forgot' ? undefined : emailHelper}
              />

              {mode !== 'forgot' && (
                <Field
                  label="รหัสผ่าน" icon={Lock} type={showPw ? 'text' : 'password'} value={password} onChange={setPassword}
                  placeholder={mode === 'register' ? 'อย่างน้อย 8 ตัวอักษร' : 'รหัสผ่าน'}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={fieldErr.password} right={eyeBtn}
                />
              )}

              {mode === 'register' && (
                <Field
                  label="ยืนยันรหัสผ่าน" icon={Lock} type={showPw ? 'text' : 'password'} value={confirm} onChange={setConfirm}
                  placeholder="กรอกรหัสผ่านอีกครั้ง" autoComplete="new-password" error={fieldErr.confirm}
                />
              )}

              {mode === 'login' && (
                <div className="flex justify-end -mt-1">
                  <button type="button" onClick={() => switchMode('forgot')} className="text-xs font-semibold text-teal-700 hover:underline">ลืมรหัสผ่าน?</button>
                </div>
              )}

              {shownError && (
                <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" /><span>{shownError}</span>
                </div>
              )}
              {success && (
                <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex gap-2">
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" /><span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={disabled}
                className="w-full py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-700/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                {mode === 'login' ? 'เข้าสู่ระบบ' : mode === 'register' ? 'สมัครสมาชิก' : 'ส่งลิงก์ตั้งรหัสผ่านใหม่'}
              </button>
            </form>

            {mode !== 'forgot' && (
              <>
                <div className="my-4 flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="h-px flex-1 bg-slate-200"></span>หรือ<span className="h-px flex-1 bg-slate-200"></span>
                </div>
                <button
                  type="button"
                  onClick={() => onGoogle(role)}
                  disabled={disabled}
                  className="w-full py-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-teal-300 font-bold text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <GoogleLogo />
                  {loading ? 'กำลังตรวจสอบ...' : 'ดำเนินการต่อด้วย Google'}
                </button>

                <p className="mt-5 text-center text-xs text-slate-500">
                  {mode === 'login' ? 'ยังไม่มีบัญชี? ' : 'มีบัญชีอยู่แล้ว? '}
                  <button type="button" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')} className="font-bold text-teal-700 hover:underline">
                    {mode === 'login' ? 'สมัครสมาชิก' : 'กลับไปเข้าสู่ระบบ'}
                  </button>
                </p>
              </>
            )}

            {!configured && (
              <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ
              </p>
            )}

            <p className="mt-4 flex items-start gap-1.5 text-[11px] text-slate-400">
              <ShieldCheck size={14} className="shrink-0 mt-px text-teal-600" />
              ข้อมูลสุขภาพของคุณได้รับการปกป้อง เฉพาะอีเมลมหาวิทยาลัย @{ALLOWED_DOMAIN} เท่านั้น
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
