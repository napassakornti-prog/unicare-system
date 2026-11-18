import React from 'react';
import { Activity, AlertCircle, ShieldCheck, Moon, Sun, BedDouble, Pill, Siren, HeartPulse } from 'lucide-react';
import { ALLOWED_DOMAIN } from '../auth';

const GoogleLogo = () => (
  <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
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

export default function LoginPage({
  darkMode, onToggleDark, onGoogle, error, loading, configured,
}: {
  darkMode: boolean;
  onToggleDark: () => void;
  onGoogle: () => void;
  error: string;
  loading: boolean;
  configured: boolean;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-teal-900 via-teal-700 to-teal-400 relative overflow-hidden">
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
        <div className="md:col-span-3 relative bg-gradient-to-br from-teal-800 to-teal-600 text-white p-8 sm:p-10 flex flex-col justify-between gap-8 overflow-hidden">
          <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-white/5"></div>
          <div className="absolute -bottom-24 -left-10 w-72 h-72 rounded-full bg-teal-950/20"></div>

          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
              <Activity size={26} className="stroke-[2.5]" />
            </div>
            <div className="leading-tight">
              <p className="text-xl font-black tracking-tight">UniCare</p>
              <p className="text-[11px] text-teal-100">ระบบห้องพยาบาล มหาวิทยาลัยกาฬสินธุ์</p>
            </div>
          </div>

          <div className="relative space-y-5">
            <h1 className="text-3xl sm:text-4xl font-black leading-tight">
              ดูแลสุขภาพของคุณ<br />ง่ายขึ้นในที่เดียว
            </h1>
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

        {/* ขวา: เข้าสู่ระบบ */}
        <div className="md:col-span-2 p-8 sm:p-10 flex flex-col justify-center text-slate-800">
          <h2 className="text-2xl font-black text-teal-900">เข้าสู่ระบบ</h2>
          <p className="text-xs text-slate-500 mt-1">ใช้บัญชี Google ของมหาวิทยาลัย (@{ALLOWED_DOMAIN}) เท่านั้น</p>

          {error && (
            <div className="mt-5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex gap-2">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={onGoogle}
            disabled={loading || !configured}
            className="mt-6 w-full py-3.5 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-teal-300 font-bold text-sm flex items-center justify-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <GoogleLogo />
            {loading ? 'กำลังตรวจสอบ...' : 'ลงชื่อเข้าใช้ด้วย Google'}
          </button>

          {!configured && (
            <p className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
              ระบบยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ
            </p>
          )}

          <div className="mt-6 p-3 rounded-xl bg-teal-50 border border-teal-100 text-[11px] text-teal-900 flex gap-2">
            <ShieldCheck size={16} className="shrink-0 mt-0.5 text-teal-600" />
            <span>ข้อมูลสุขภาพของคุณได้รับการปกป้อง ระบบจะนำเข้าสู่หน้าที่เหมาะกับสิทธิ์ของคุณโดยอัตโนมัติ</span>
          </div>
        </div>
      </div>
    </div>
  );
}
