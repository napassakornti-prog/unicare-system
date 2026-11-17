import React, { useState } from 'react';
import { Activity, AlertCircle, ShieldCheck, ChevronDown, Moon, Sun } from 'lucide-react';
import { ALLOWED_DOMAIN } from '../auth';
import { getSupabaseConfig, saveSupabaseConfig } from '../supabase';

const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
    <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3.1-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.1z" />
    <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.6l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
  </svg>
);

export default function LoginPage({
  darkMode, onToggleDark, onGoogle, error, loading, configured, onConfigSaved,
}: {
  darkMode: boolean;
  onToggleDark: () => void;
  onGoogle: () => void;
  error: string;
  loading: boolean;
  configured: boolean;
  onConfigSaved: () => void;
}) {
  const [showCfg, setShowCfg] = useState(!configured);
  const [url, setUrl] = useState(() => getSupabaseConfig().url);
  const [key, setKey] = useState(() => getSupabaseConfig().key);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-blue-800 via-blue-600 to-sky-500 relative">
      <button
        onClick={onToggleDark}
        className="absolute top-4 right-4 p-2.5 rounded-xl bg-white/15 text-white hover:bg-white/25 transition-all"
        title="สลับโหมดมืด/สว่าง"
      >
        {darkMode ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      <div className="w-full max-w-4xl rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-2 bg-white">
        {/* ซ้าย: Welcome */}
        <div className="relative bg-gradient-to-br from-blue-700 to-blue-600 text-white p-8 sm:p-10 flex flex-col justify-center min-h-[260px] overflow-hidden">
          <div className="absolute -top-16 -left-16 w-64 h-64 rounded-full bg-blue-500/50"></div>
          <div className="absolute -bottom-20 -right-10 w-72 h-72 rounded-full bg-blue-800/60"></div>
          <div className="relative space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 flex items-center justify-center">
              <Activity size={30} className="stroke-[2.5]" />
            </div>
            <div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-wide">WELCOME</h1>
              <p className="text-lg font-bold mt-1">UniCare ห้องพยาบาลอัจฉริยะ</p>
            </div>
            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
              ระบบบริหารจัดการห้องพยาบาล มหาวิทยาลัยกาฬสินธุ์ จองเตียง ขอยา แจ้งประวัติการแพ้ยา และเรียกความช่วยเหลือฉุกเฉินได้ในที่เดียว
            </p>
          </div>
        </div>

        {/* ขวา: Sign in */}
        <div className="p-8 sm:p-10 flex flex-col justify-center text-slate-800">
          <h2 className="text-3xl font-black text-blue-900">เข้าสู่ระบบ</h2>
          <p className="text-xs text-slate-500 mt-1">เข้าสู่ระบบด้วยบัญชี Google ของมหาวิทยาลัยเท่านั้น</p>

          {error && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={onGoogle}
            disabled={loading || !configured}
            className="mt-6 w-full py-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GoogleLogo />
            {loading ? 'กำลังตรวจสอบ...' : 'ลงชื่อเข้าใช้ด้วย Google'}
          </button>

          <div className="mt-4 p-3 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-900 flex gap-2">
            <ShieldCheck size={16} className="shrink-0 mt-0.5 text-blue-600" />
            <span>
              รองรับเฉพาะอีเมล <strong>@{ALLOWED_DOMAIN}</strong> เช่น napssakorn.ti@{ALLOWED_DOMAIN}
              <br />ระบบจะพาเข้าหน้าตามสิทธิ์ให้อัตโนมัติ (เจ้าหน้าที่ / นักศึกษา อาจารย์ บุคลากร)
            </span>
          </div>

          {!configured && (
            <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              ยังไม่ได้เชื่อมต่อฐานข้อมูล Supabase กรุณากรอกค่าด้านล่างก่อน จึงจะเข้าสู่ระบบด้วย Google ได้
            </p>
          )}

          <button
            onClick={() => setShowCfg(!showCfg)}
            className="mt-5 text-[11px] font-semibold text-slate-500 hover:text-blue-700 flex items-center gap-1 self-start"
          >
            <ChevronDown size={14} className={showCfg ? 'rotate-180 transition-transform' : 'transition-transform'} />
            ตั้งค่าการเชื่อมต่อฐานข้อมูล (สำหรับผู้ดูแลระบบ)
          </button>
          {showCfg && (
            <div className="mt-2 space-y-2">
              <input
                value={url} onChange={e => setUrl(e.target.value)} placeholder="Supabase Project URL"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-mono focus:outline-none focus:border-blue-500"
              />
              <input
                value={key} onChange={e => setKey(e.target.value)} placeholder="Supabase Publishable / Anon Key"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-[11px] font-mono focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => { saveSupabaseConfig(url, key); onConfigSaved(); }}
                className="px-4 py-2 rounded-lg bg-blue-700 text-white text-[11px] font-bold hover:bg-blue-800"
              >
                บันทึกการเชื่อมต่อ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
