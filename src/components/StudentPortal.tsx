import React, { useState } from 'react';
import { GraduationCap, ShieldAlert, LogOut, CheckCircle2, Clock, Bed, User, Activity, AlertTriangle, ArrowLeft } from 'lucide-react';
import { DRUG_FAMILY_OPTIONS } from '../ai';

const SEVERITIES = ['รุนแรงมาก (Anaphylaxis Risk)', 'ปานกลาง (มีผื่นลมพิษ)', 'เล็กน้อย (คลื่นไส้ มึนหัว)'];

export default function StudentPortal({ 
  students, 
  beds,
  visits,
  theme, 
  onDeclare, 
  addToast,
  onExitPortal 
}: { 
  students: any[]; 
  beds?: any[];
  visits?: any[];
  theme: any; 
  onDeclare: Function; 
  addToast: Function;
  onExitPortal?: () => void;
}) {
  const [loginId, setLoginId] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [form, setForm] = useState({ drugName: '', drugFamily: DRUG_FAMILY_OPTIONS[0], reaction: '', severity: SEVERITIES[0] });

  const student = students.find(s => s.id === studentId);
  const studentVisits = (visits || []).filter(v => v.studentId === studentId || v.patientId === studentId);
  const freeBeds = (beds || []).filter(b => b.status === 'available').length;

  if (!student) {
    return (
      <div className="max-w-md mx-auto space-y-4 pt-4">
        {onExitPortal && (
          <button
            onClick={onExitPortal}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${theme.subText} hover:text-teal-600 transition-colors`}
          >
            <ArrowLeft size={16} /> กลับหน้าหลัก / เลือกสิทธิ์เข้าใช้งาน
          </button>
        )}
        <div className={`p-8 rounded-3xl border text-center space-y-4 shadow-xl ${theme.card}`}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-teal-500/25">
            <GraduationCap size={32} />
          </div>
          <div>
            <h3 className={`font-black text-xl tracking-tight ${theme.heading}`}>พอร์ทัลนักศึกษาและบุคลากร</h3>
            <p className={`text-xs mt-1 ${theme.subText}`}>
              ตรวจสอบประวัติการรักษา • แจ้งประวัติการแพ้ยา • บัตรสุขภาพดิจิทัล
            </p>
          </div>
          
          <form
            onSubmit={e => {
              e.preventDefault();
              const trimmed = loginId.trim();
              if (!trimmed) return;
              const found = students.find(s => s.id.toLowerCase() === trimmed.toLowerCase());
              if (found) {
                setStudentId(found.id);
                addToast('เข้าสู่ระบบสำเร็จ', `ยินดีต้อนรับ ${found.name}`);
              } else {
                addToast('ไม่พบรหัสในระบบ', 'หากยังไม่เคยลงทะเบียน กรุณาติดต่อห้องพยาบาล หรือตรวจสอบรหัสอีกครั้ง', 'error');
              }
            }}
            className="space-y-3 pt-2"
          >
            <div>
              <label className={`block text-xs font-semibold text-left mb-1.5 ${theme.subText}`}>รหัสนักศึกษา / รหัสบุคลากร</label>
              <input 
                value={loginId} 
                onChange={e => setLoginId(e.target.value)} 
                placeholder="เช่น 66010012 หรือ T-1002" 
                className={`w-full px-4 py-3 text-sm rounded-2xl border text-center font-mono font-bold focus:outline-none focus:border-teal-500 ${theme.inputBg}`} 
              />
            </div>
            <button className="w-full py-3 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-500 text-white font-bold text-xs shadow-lg shadow-teal-500/25 hover:brightness-110 active:scale-95 transition-all">
              เข้าสู่พอร์ทัลผู้รับบริการ
            </button>
          </form>

          {/* ข้อมูลแนะนำรหัสทดสอบ */}
          {students.length > 0 && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 text-left">
              <p className={`text-[11px] font-semibold mb-1.5 ${theme.subText}`}>รหัสในระบบสำหรับทดสอบ:</p>
              <div className="flex flex-wrap gap-1.5">
                {students.slice(0, 4).map(s => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setLoginId(s.id); setStudentId(s.id); }}
                    className="text-[10px] px-2 py-1 rounded-lg border border-teal-500/30 bg-teal-500/5 text-teal-700 dark:text-teal-300 hover:bg-teal-500/15 font-mono"
                  >
                    {s.id} ({s.role || 'นศ.'})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2">
            <span className={`text-[10px] ${theme.subText}`}>ระบบสารสนเทศห้องพยาบาล มหาวิทยาลัยกาฬสินธุ์</span>
          </div>
        </div>
      </div>
    );
  }

  const details = student.allergyDetails || [];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {onExitPortal && (
          <button
            onClick={onExitPortal}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${theme.subText} hover:text-teal-600 transition-colors`}
          >
            <ArrowLeft size={16} /> สลับไปหน้าเจ้าหน้าที่ / เลือกสิทธิ์
          </button>
        )}
        <div className="flex items-center gap-3 ml-auto">
          {beds && (
            <span className="text-xs px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/20 flex items-center gap-1.5">
              <Bed size={14} /> ห้องพยาบาลเตียงว่าง {freeBeds}/{beds.length} เตียง
            </span>
          )}
          <button 
            onClick={() => setStudentId(null)} 
            className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-500/20 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all font-semibold`}
          >
            <LogOut size={13} /> ออกจากระบบ
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT (5 cols): บัตรประจำตัวสุขภาพดิจิทัล (Digital Health Card) */}
        <div className="lg:col-span-5 space-y-4">
          <div className={`p-6 rounded-3xl border shadow-xl relative overflow-hidden ${theme.card}`}>
            {/* Top Card Banner */}
            <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600"></div>

            <div className="relative pt-6 flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-2xl bg-white dark:bg-slate-900 border-4 border-white dark:border-slate-800 shadow-xl flex items-center justify-center text-teal-600 mb-3">
                <User size={38} className="stroke-[2]" />
              </div>

              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20 mb-1.5">
                {student.role || 'นักศึกษา'} • มหาวิทยาลัยกาฬสินธุ์
              </span>
              <h3 className={`font-black text-lg ${theme.heading}`}>{student.name}</h3>
              <p className={`text-xs font-mono font-bold mt-0.5 text-teal-600 dark:text-teal-400`}>รหัส: {student.id}</p>
            </div>

            {/* Profile Info Details */}
            <div className="mt-5 space-y-2 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className={theme.subText}>คณะ:</span>
                <span className="font-semibold text-right max-w-[65%] truncate">{student.faculty || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className={theme.subText}>สาขาวิชา:</span>
                <span className="font-semibold text-right">{student.department || '-'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                <span className={theme.subText}>กรุ๊ปเลือด:</span>
                <span className="font-bold text-teal-600 dark:text-teal-400">{student.blood || 'ไม่ระบุ'}</span>
              </div>
              {student.phone && (
                <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800/60">
                  <span className={theme.subText}>เบอร์ติดต่อ:</span>
                  <span className="font-mono">{student.phone}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className={theme.subText}>สถิติรับบริการ:</span>
                <span className="font-semibold">{student.visitsCount || studentVisits.length || 0} ครั้ง</span>
              </div>
            </div>

            {/* Active Allergies Alert Badge */}
            <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400 mb-2">
                <ShieldAlert size={16} /> ประวัติการแพ้ยาในระบบ:
              </div>
              {student.allergies && student.allergies.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {student.allergies.map((alg: string, idx: number) => (
                    <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold shadow-sm">
                      ⚠️ {alg}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center">
                  ✓ ไม่พบประวัติการแพ้ยาในระบบ
                </div>
              )}
              {student.allergyReaction && (
                <p className={`text-[11px] mt-2 ${theme.subText}`}>
                  อาการที่เคยแสดง: <span className="font-medium">{student.allergyReaction}</span>
                </p>
              )}
            </div>
          </div>

          {/* ประวัติการรักษาที่ผ่านมาของตนเอง */}
          <div className={`p-5 rounded-3xl border shadow-sm ${theme.card}`}>
            <h4 className={`text-xs font-bold mb-3 flex items-center gap-1.5 ${theme.heading}`}>
              <Activity size={16} className="text-teal-600" /> ประวัติการเข้ารับบริการที่ผ่านมา ({studentVisits.length} รายการ)
            </h4>
            {studentVisits.length === 0 ? (
              <p className={`text-xs text-center py-4 ${theme.subText}`}>ยังไม่มีประวัติการเข้ารับบริการ</p>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {studentVisits.map((v, i) => (
                  <div key={i} className={`p-2.5 rounded-xl border text-xs ${theme.cardInner}`}>
                    <div className="flex justify-between font-semibold">
                      <span className="text-teal-600 font-mono">{v.id}</span>
                      <span className={theme.subText}>{v.time}</span>
                    </div>
                    <p className="mt-1 font-medium">{v.symptom}</p>
                    {v.meds && v.meds.length > 0 && (
                      <p className={`text-[11px] mt-0.5 ${theme.subText}`}>ยาที่ได้รับ: {v.meds.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT (7 cols): แบบฟอร์มแจ้งประวัติการแพ้ยาด้วยตนเอง */}
        <div className="lg:col-span-7 space-y-6">
          <div className={`p-6 rounded-3xl border shadow-xl space-y-4 ${theme.card}`}>
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600">
                <ShieldAlert size={22} />
              </div>
              <div>
                <h3 className={`font-bold text-base ${theme.heading}`}>แจ้งประวัติการแพ้ยาด้วยตนเอง</h3>
                <p className={`text-xs mt-0.5 ${theme.subText}`}>
                  ข้อมูลที่แจ้งจะถูกเชื่อมต่อเข้าสู่ระบบตรวจสอบอัตโนมัติ เพื่อป้องกันการจ่ายยาผิดพลาดเมื่อมารับบริการ
                </p>
              </div>
            </div>

            <form
              onSubmit={e => {
                e.preventDefault();
                if (!form.drugName.trim()) return;
                onDeclare(student.id, { ...form, drugName: form.drugName.trim() }, 'student');
                setForm({ drugName: '', drugFamily: DRUG_FAMILY_OPTIONS[0], reaction: '', severity: SEVERITIES[0] });
              }}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs"
            >
              <div>
                <label className={`block font-semibold mb-1.5 ${theme.heading}`}>ชื่อยาที่แพ้ *</label>
                <input 
                  required 
                  value={form.drugName} 
                  onChange={e => setForm({ ...form, drugName: e.target.value })} 
                  placeholder="เช่น Amoxicillin, Ibuprofen..." 
                  className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`} 
                />
              </div>
              <div>
                <label className={`block font-semibold mb-1.5 ${theme.heading}`}>กลุ่มยา (ถ้าทราบ)</label>
                <select 
                  value={form.drugFamily} 
                  onChange={e => setForm({ ...form, drugFamily: e.target.value })} 
                  className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`}
                >
                  {DRUG_FAMILY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={`block font-semibold mb-1.5 ${theme.heading}`}>อาการที่เกิดเมื่อแพ้</label>
                <input 
                  value={form.reaction} 
                  onChange={e => setForm({ ...form, reaction: e.target.value })} 
                  placeholder="เช่น ผื่นคัน ลมพิษ แน่นหน้าอก ปากบวม..." 
                  className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`} 
                />
              </div>
              <div className="sm:col-span-2">
                <label className={`block font-semibold mb-1.5 ${theme.heading}`}>ระดับความรุนแรงของอาการ</label>
                <select 
                  value={form.severity} 
                  onChange={e => setForm({ ...form, severity: e.target.value })} 
                  className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`}
                >
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="sm:col-span-2 pt-2 flex justify-end">
                <button className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-lg shadow-teal-600/25 transition-all">
                  ยืนยันและส่งข้อมูลประวัติแพ้ยา
                </button>
              </div>
            </form>

            {/* รายการประวัติแพ้ยาที่บันทึกไว้ */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h4 className={`text-xs font-bold mb-3 ${theme.heading}`}>รายการแพ้ยาที่บันทึกไว้ในระบบ</h4>
              {details.length === 0 && (!student.allergies || student.allergies.length === 0) && (
                <div className={`p-4 rounded-xl border text-center text-xs ${theme.subText}`}>
                  ยังไม่มีประวัติการแพ้ยาที่แจ้งไว้
                </div>
              )}
              <div className="space-y-2">
                {details.map((d: any, i: number) => (
                  <div key={i} className={`p-3 rounded-2xl border text-xs flex justify-between items-start ${theme.cardInner}`}>
                    <div>
                      <p className="font-bold text-rose-600 dark:text-rose-400">⚠️ {d.drugName} <span className={theme.subText}>({d.drugFamily})</span></p>
                      <p className={`mt-0.5 ${theme.subText}`}>{d.reaction || '-'} • {d.severity}</p>
                    </div>
                    {d.verified ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]"><CheckCircle2 size={13} /> ยืนยันแล้ว</span>
                    ) : (
                      <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold text-[11px]"><Clock size={13} /> รอเจ้าหน้าที่ยืนยัน</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
