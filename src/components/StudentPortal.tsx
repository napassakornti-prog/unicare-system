import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { GraduationCap, ShieldAlert, QrCode, LogOut, CheckCircle2, Clock } from 'lucide-react';
import { DRUG_FAMILY_OPTIONS } from '../ai';

const SEVERITIES = ['รุนแรงมาก (Anaphylaxis Risk)', 'ปานกลาง (มีผื่นลมพิษ)', 'เล็กน้อย (คลื่นไส้ มึนหัว)'];

export default function StudentPortal({ students, theme, onDeclare, addToast }: { students: any[]; theme: any; onDeclare: Function; addToast: Function }) {
  const [loginId, setLoginId] = useState('');
  const [studentId, setStudentId] = useState<string | null>(null);
  const [form, setForm] = useState({ drugName: '', drugFamily: DRUG_FAMILY_OPTIONS[0], reaction: '', severity: SEVERITIES[0] });

  const student = students.find(s => s.id === studentId);

  if (!student) {
    return (
      <div className="max-w-md mx-auto">
        <div className={`p-8 rounded-2xl border text-center space-y-4 ${theme.card}`}>
          <div className="w-14 h-14 rounded-2xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mx-auto"><GraduationCap size={28} /></div>
          <h3 className={`font-bold text-lg ${theme.heading}`}>พอร์ทัลนักศึกษา</h3>
          <p className={`text-xs ${theme.subText}`}>นักศึกษาลงทะเบียนประวัติแพ้ยาด้วยตนเอง และรับ QR Health Pass ไว้ยื่นที่ห้องพยาบาล</p>
          <form
            onSubmit={e => {
              e.preventDefault();
              if (students.some(s => s.id === loginId.trim())) setStudentId(loginId.trim());
              else addToast('ไม่พบรหัสนักศึกษา', 'กรุณาตรวจสอบรหัสอีกครั้ง', 'error');
            }}
            className="space-y-3"
          >
            <input value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="กรอกรหัสนักศึกษา เช่น 67020045" className={`w-full px-4 py-2.5 text-sm rounded-xl border text-center font-mono ${theme.inputBg}`} />
            <button className="w-full py-2.5 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700">เข้าสู่ระบบ</button>
          </form>
          <p className={`text-[10px] ${theme.subText}`}>(ระบบจริงควรยืนยันตัวตนผ่านบัญชีมหาวิทยาลัย / SSO)</p>
        </div>
      </div>
    );
  }

  const details = student.allergyDetails || [];

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6">
      {/* QR Health Pass */}
      <div className={`md:col-span-2 p-6 rounded-2xl border text-center space-y-3 ${theme.card}`}>
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold flex items-center gap-1.5 text-teal-600 dark:text-teal-400"><QrCode size={14} /> QR Health Pass</span>
          <button onClick={() => setStudentId(null)} className={`text-[11px] flex items-center gap-1 ${theme.subText} hover:text-rose-500`}><LogOut size={12} /> ออก</button>
        </div>
        <div className="bg-white p-4 rounded-2xl inline-block border">
          <QRCodeSVG value={student.id} size={170} level="M" />
        </div>
        <div>
          <p className={`font-bold ${theme.heading}`}>{student.name}</p>
          <p className={`text-xs font-mono ${theme.subText}`}>{student.id} • {student.faculty}</p>
        </div>
        <p className={`text-[11px] ${theme.subText}`}>แสดง QR นี้ให้เจ้าหน้าที่สแกนเมื่อมาใช้บริการ — ไม่ต้องพิมพ์ชื่อ</p>
        {student.allergies.length > 0 && (
          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-300 font-bold">
            ⚠️ แพ้ยา: {student.allergies.join(', ')}
          </div>
        )}
      </div>

      {/* Allergy self-declaration */}
      <div className={`md:col-span-3 p-6 rounded-2xl border space-y-4 ${theme.card}`}>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600"><ShieldAlert size={20} /></div>
          <div>
            <h3 className={`font-bold text-base ${theme.heading}`}>แจ้งประวัติการแพ้ยาด้วยตนเอง</h3>
            <p className={`text-xs ${theme.subText}`}>ข้อมูลจะใช้ตรวจสอบอัตโนมัติก่อนจ่ายยา เพื่อป้องกันการจ่ายยาผิด</p>
          </div>
        </div>

        <form
          onSubmit={e => {
            e.preventDefault();
            if (!form.drugName.trim()) return;
            onDeclare(student.id, { ...form, drugName: form.drugName.trim() }, 'student');
            setForm({ drugName: '', drugFamily: DRUG_FAMILY_OPTIONS[0], reaction: '', severity: SEVERITIES[0] });
          }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
        >
          <div>
            <label className={`block font-semibold mb-1 ${theme.heading}`}>ชื่อยาที่แพ้ *</label>
            <input required value={form.drugName} onChange={e => setForm({ ...form, drugName: e.target.value })} placeholder="เช่น Amoxicillin" className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`} />
          </div>
          <div>
            <label className={`block font-semibold mb-1 ${theme.heading}`}>กลุ่มยา</label>
            <select value={form.drugFamily} onChange={e => setForm({ ...form, drugFamily: e.target.value })} className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`}>
              {DRUG_FAMILY_OPTIONS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className={`block font-semibold mb-1 ${theme.heading}`}>อาการที่เกิดเมื่อแพ้</label>
            <input value={form.reaction} onChange={e => setForm({ ...form, reaction: e.target.value })} placeholder="เช่น ผื่นขึ้น ปากบวม" className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`} />
          </div>
          <div>
            <label className={`block font-semibold mb-1 ${theme.heading}`}>ความรุนแรง</label>
            <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className={`w-full p-2.5 rounded-xl border ${theme.inputBg}`}>
              {SEVERITIES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button className="px-5 py-2.5 rounded-xl bg-teal-600 text-white font-bold hover:bg-teal-700">ส่งข้อมูลการแพ้ยา</button>
          </div>
        </form>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
          <p className={`text-xs font-bold mb-2 ${theme.heading}`}>รายการที่แจ้งไว้</p>
          {details.length === 0 && student.allergies.length === 0 && <p className={`text-xs ${theme.subText}`}>ยังไม่มีข้อมูล</p>}
          <div className="space-y-2">
            {details.map((d: any, i: number) => (
              <div key={i} className={`p-3 rounded-xl border text-xs flex justify-between items-start ${theme.cardInner}`}>
                <div>
                  <p className="font-bold">{d.drugName} <span className={theme.subText}>({d.drugFamily})</span></p>
                  <p className={theme.subText}>{d.reaction || '-'} • {d.severity}</p>
                </div>
                {d.verified ? (
                  <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold"><CheckCircle2 size={14} /> ยืนยันแล้ว</span>
                ) : (
                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold"><Clock size={14} /> รอเจ้าหน้าที่ยืนยัน</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
