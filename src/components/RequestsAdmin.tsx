import React, { useState } from 'react';
import { Bed, Pill, ShieldAlert, Siren, Inbox } from 'lucide-react';
import { checkDrugAllergy } from '../ai';
import { Req, REQ_STATUS } from '../requests';

const FILTERS = [
  { id: 'pending', label: 'รอดำเนินการ' },
  { id: 'bed', label: 'จองเตียง' },
  { id: 'medicine', label: 'ขอยา' },
  { id: 'allergy', label: 'แจ้งแพ้ยา' },
  { id: 'emergency', label: 'ฉุกเฉิน' },
  { id: 'all', label: 'ทั้งหมด' },
];

const typeMeta: Record<string, { label: string; icon: any; cls: string }> = {
  bed: { label: 'จองเตียง', icon: Bed, cls: 'bg-emerald-500/10 text-emerald-600' },
  medicine: { label: 'ขอยา', icon: Pill, cls: 'bg-blue-500/10 text-blue-600' },
  allergy: { label: 'แจ้งแพ้ยา', icon: ShieldAlert, cls: 'bg-amber-500/10 text-amber-600' },
  emergency: { label: 'เรียกฉุกเฉิน', icon: Siren, cls: 'bg-rose-500/10 text-rose-600' },
};

const chip = (s: string) =>
  s === REQ_STATUS.APPROVED || s === REQ_STATUS.DONE ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
  : s === REQ_STATUS.REJECTED ? 'bg-rose-500/10 text-rose-600 border-rose-500/20'
  : s === REQ_STATUS.ACK ? 'bg-blue-500/10 text-blue-600 border-blue-500/20'
  : 'bg-amber-500/10 text-amber-600 border-amber-500/20';

export default function RequestsAdmin({
  requests, beds, medicines, allAllergiesByEmail, theme,
  onApproveBed, onFinishBed, onApproveMedicine, onApproveAllergy, onReject, onSetStatus,
}: {
  requests: Req[];
  beds: any[];
  medicines: any[];
  allAllergiesByEmail: (email: string) => string[];
  theme: any;
  onApproveBed: (r: Req, bedId: string) => void;
  onFinishBed: (r: Req) => void;
  onApproveMedicine: (r: Req) => void;
  onApproveAllergy: (r: Req) => void;
  onReject: (r: Req, note: string) => void;
  onSetStatus: (r: Req, status: string) => void;
}) {
  const [filter, setFilter] = useState('pending');
  const [bedChoice, setBedChoice] = useState<Record<string, string>>({});
  const freeBeds = beds.filter(b => b.status === 'available');

  const list = requests.filter(r => {
    if (filter === 'all') return true;
    if (filter === 'pending') return r.status === REQ_STATUS.PENDING || (r.type === 'emergency' && r.status === REQ_STATUS.ACK);
    return r.type === filter;
  });

  const reject = (r: Req) => {
    const note = window.prompt('เหตุผลที่ปฏิเสธ (แสดงให้ผู้ขอเห็น)', '') ;
    if (note === null) return;
    onReject(r, note);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5">
      <div className={`p-4 sm:p-6 rounded-2xl border ${theme.card}`}>
        <h3 className={`font-bold text-base sm:text-lg ${theme.heading}`}>คำขอออนไลน์จากนักศึกษา / อาจารย์ / บุคลากร</h3>
        <p className={`text-xs mt-1 ${theme.subText}`}>พิจารณาอนุมัติการจองเตียง การขอยา ยืนยันประวัติแพ้ยา และตอบรับการเรียกฉุกเฉิน (อัปเดตอัตโนมัติ)</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${filter === f.id ? 'bg-teal-600 text-white border-teal-600' : `${theme.cardInner} hover:border-teal-500/50`}`}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 && (
        <div className={`p-10 rounded-2xl border text-center ${theme.card}`}>
          <Inbox size={36} className={`mx-auto mb-2 ${theme.subText}`} />
          <p className={`text-sm ${theme.subText}`}>ไม่มีคำขอในหมวดนี้</p>
        </div>
      )}

      <div className="space-y-3">
        {list.map(r => {
          const meta = typeMeta[r.type];
          const Icon = meta.icon;
          const p = r.payload || {};
          const pending = r.status === REQ_STATUS.PENDING;
          const known = Array.from(new Set([...allAllergiesByEmail(r.email)]));
          return (
            <div key={r.id} className={`p-5 rounded-2xl border space-y-3 ${r.type === 'emergency' && pending ? 'border-rose-500 bg-rose-500/5' : theme.card}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${meta.cls}`}><Icon size={20} /></div>
                  <div>
                    <p className={`font-bold text-sm ${theme.heading}`}>{meta.label} • {r.name}</p>
                    <p className={`text-[11px] ${theme.subText}`}>{r.email} • {new Date(r.createdAt).toLocaleString('th-TH')}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap ${chip(r.status)}`}>{r.status}</span>
              </div>

              {/* รายละเอียดตามประเภท */}
              <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${theme.cardInner}`}>
                {r.type === 'bed' && (
                  <>
                    <p>อาการ: <strong>{p.symptom}</strong></p>
                    {p.preferredBedName && <p className={theme.subText}>เตียงที่ต้องการ: {p.preferredBedName}</p>}
                    {p.bedName && <p className="text-emerald-600 font-semibold">จัดให้: {p.bedName}</p>}
                  </>
                )}
                {r.type === 'medicine' && (
                  <>
                    <p>อาการ: <strong>{p.symptom}</strong></p>
                    {(p.items || []).map((i: any) => {
                      const med = medicines.find(m => m.id === i.id || m.name === i.name);
                      const warn = checkDrugAllergy(i.name + ' ' + (i.en || ''), known);
                      return (
                        <p key={i.id} className="flex flex-wrap gap-x-2 items-center">
                          <span className="font-semibold">{i.name}</span>
                          <span>x{i.qty} {i.unit}</span>
                          <span className={med && med.stock >= i.qty ? 'text-emerald-600' : 'text-rose-600 font-bold'}>(คงเหลือ {med ? med.stock : 0})</span>
                          {warn && <span className="text-rose-600 font-bold">⚠️ {warn.message}</span>}
                        </p>
                      );
                    })}
                  </>
                )}
                {r.type === 'allergy' && (
                  <p>ยา: <strong>{p.drugName}</strong> ({p.drugFamily}) • อาการ: {p.reaction || '-'} • {p.severity}</p>
                )}
                {r.type === 'emergency' && (
                  <p className="text-rose-600 font-bold">{p.message}{p.bedName ? ` • ${p.bedName}` : ''}</p>
                )}
                {r.adminNote && <p className="text-blue-600">หมายเหตุ: {r.adminNote}</p>}
              </div>

              {/* ปุ่มดำเนินการ */}
              <div className="flex flex-wrap items-center gap-2">
                {r.type === 'bed' && pending && (
                  <>
                    <select
                      value={bedChoice[r.id] ?? (freeBeds.find(b => b.id === p.preferredBedId)?.id || freeBeds[0]?.id || '')}
                      onChange={e => setBedChoice({ ...bedChoice, [r.id]: e.target.value })}
                      className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs ${theme.inputBg}`}
                    >
                      {freeBeds.length === 0 && <option value="">ไม่มีเตียงว่าง</option>}
                      {freeBeds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                    <button
                      disabled={freeBeds.length === 0}
                      onClick={() => onApproveBed(r, bedChoice[r.id] ?? (freeBeds.find(b => b.id === p.preferredBedId)?.id || freeBeds[0]?.id))}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50"
                    >อนุมัติ & จัดเตียง</button>
                  </>
                )}
                {r.type === 'bed' && r.status === REQ_STATUS.APPROVED && (
                  <button onClick={() => onFinishBed(r)} className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800">จำหน่าย / คืนเตียง</button>
                )}
                {r.type === 'medicine' && pending && (
                  <button onClick={() => onApproveMedicine(r)} className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">อนุมัติ & ตัดสต็อก</button>
                )}
                {r.type === 'medicine' && r.status === REQ_STATUS.APPROVED && (
                  <button onClick={() => onSetStatus(r, REQ_STATUS.DONE)} className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800">ผู้ขอรับยาแล้ว</button>
                )}
                {r.type === 'allergy' && pending && (
                  <button onClick={() => onApproveAllergy(r)} className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">ยืนยันข้อมูลแพ้ยา</button>
                )}
                {r.type === 'emergency' && pending && (
                  <button onClick={() => onSetStatus(r, REQ_STATUS.ACK)} className="min-h-[42px] px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700">รับทราบ กำลังไปดูแล</button>
                )}
                {r.type === 'emergency' && (pending || r.status === REQ_STATUS.ACK) && (
                  <button onClick={() => onSetStatus(r, REQ_STATUS.DONE)} className="min-h-[42px] px-4 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800">ดูแลเสร็จสิ้น</button>
                )}
                {pending && r.type !== 'emergency' && (
                  <button onClick={() => reject(r)} className="min-h-[42px] px-4 py-2 rounded-xl border border-rose-500/40 text-rose-600 text-xs font-bold hover:bg-rose-500/10">ปฏิเสธ</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
