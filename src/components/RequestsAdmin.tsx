import React, { useState } from 'react';
import { Bed, Pill, ShieldAlert, Siren, Inbox, Clock, CheckCircle2 } from 'lucide-react';
import { checkDrugAllergy } from '../ai';
import { Req, REQ_STATUS } from '../requests';

const FILTERS = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'pending', label: 'รอดำเนินการ' },
  { id: 'emergency', label: 'ฉุกเฉิน' },
  { id: 'bed', label: 'จองเตียง' },
  { id: 'medicine', label: 'ขอยา' },
  { id: 'allergy', label: 'แจ้งแพ้ยา' },
];

const typeMeta: Record<string, { label: string; icon: any; cls: string }> = {
  bed: { label: 'จองเตียง', icon: Bed, cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  medicine: { label: 'ขอยา', icon: Pill, cls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
  allergy: { label: 'แจ้งแพ้ยา', icon: ShieldAlert, cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  emergency: { label: 'เรียกฉุกเฉิน', icon: Siren, cls: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
};

const chip = (s: string) =>
  s === REQ_STATUS.APPROVED || s === REQ_STATUS.DONE ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
  : s === REQ_STATUS.REJECTED ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
  : s === REQ_STATUS.ACK ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';

const isActiveReq = (r: Req) =>
  r.status === REQ_STATUS.PENDING ||
  r.status === REQ_STATUS.ACK ||
  ((r.type === 'bed' || r.type === 'medicine') && r.status === REQ_STATUS.APPROVED);

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
  const [filter, setFilter] = useState('all');
  const [bedChoice, setBedChoice] = useState<Record<string, string>>({});
  const freeBeds = beds.filter(b => b.status === 'available');

  const emergencyActiveCount = requests.filter(r => r.type === 'emergency' && (r.status === REQ_STATUS.PENDING || r.status === REQ_STATUS.ACK)).length;
  const bedPendingCount = requests.filter(r => r.type === 'bed' && r.status === REQ_STATUS.PENDING).length;
  const medPendingCount = requests.filter(r => r.type === 'medicine' && r.status === REQ_STATUS.PENDING).length;
  const allergyPendingCount = requests.filter(r => r.type === 'allergy' && r.status === REQ_STATUS.PENDING).length;

  const filterCount = (id: string) => {
    if (id === 'all') return requests.length;
    if (id === 'pending') return requests.filter(isActiveReq).length;
    return requests.filter(r => r.type === id).length;
  };

  const activeQueue = requests
    .filter(r => {
      if (!isActiveReq(r)) return false;
      if (filter === 'all' || filter === 'pending') return true;
      return r.type === filter;
    })
    .sort((a, b) => {
      if (a.type === 'emergency' && b.type !== 'emergency') return -1;
      if (b.type === 'emergency' && a.type !== 'emergency') return 1;
      if (a.status === REQ_STATUS.PENDING && b.status !== REQ_STATUS.PENDING) return -1;
      if (b.status === REQ_STATUS.PENDING && a.status !== REQ_STATUS.PENDING) return 1;
      return 0;
    });

  const historyQueue = filter === 'pending'
    ? []
    : requests.filter(r => {
        if (isActiveReq(r)) return false;
        if (filter === 'all') return true;
        return r.type === filter;
      });

  const reject = (r: Req) => {
    const note = window.prompt('เหตุผลที่ปฏิเสธ (แสดงให้ผู้ขอเห็น)', '');
    if (note === null) return;
    onReject(r, note);
  };

  const kpiCards = [
    { id: 'emergency', label: 'เคสฉุกเฉิน', count: emergencyActiveCount, hint: 'ต้องดูแลทันที', icon: Siren, cls: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
    { id: 'bed', label: 'จองเตียงรอตรวจ', count: bedPendingCount, hint: `ว่าง ${freeBeds.length}/${beds.length} เตียง`, icon: Bed, cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { id: 'medicine', label: 'ขอยารออนุมัติ', count: medPendingCount, hint: 'รอตรวจและตัดสต็อก', icon: Pill, cls: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
    { id: 'allergy', label: 'ยืนยันแพ้ยา', count: allergyPendingCount, hint: 'รอพยาบาลตรวจสอบ', icon: ShieldAlert, cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
  ];

  return (
    <div className="max-w-[1440px] mx-auto space-y-5">
      {/* 4 Clickable KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpiCards.map(c => {
          const Icon = c.icon;
          const active = filter === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setFilter(active ? 'all' : c.id)}
              className={`p-4 rounded-2xl border text-left transition-all hover:-translate-y-0.5 ${theme.card} ${
                active ? 'ring-2 ring-teal-500/40 border-teal-500/50' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-wider ${theme.subText}`}>{c.label}</p>
                  <p className={`text-2xl sm:text-3xl font-black mt-1 ${c.cls}`}>{c.count}</p>
                </div>
                <div className={`p-2.5 rounded-xl shrink-0 ${c.bg} ${c.cls}`}>
                  <Icon size={18} />
                </div>
              </div>
              <p className={`text-[11px] mt-2 ${theme.subText}`}>{c.hint}</p>
            </button>
          );
        })}
      </div>

      {/* Header + Filter Pills */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${theme.card}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h3 className={`font-bold text-base sm:text-lg ${theme.heading}`}>คำขอออนไลน์จากนักศึกษา / อาจารย์ / บุคลากร</h3>
            <p className={`text-xs mt-1 ${theme.subText}`}>พิจารณาอนุมัติการจองเตียง การขอยา ยืนยันประวัติแพ้ยา และตอบรับการเรียกฉุกเฉิน (อัปเดตอัตโนมัติ)</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                  filter === f.id 
                    ? 'bg-teal-50 text-teal-700 border-teal-300 dark:bg-teal-950/70 dark:text-teal-300 dark:border-teal-800 shadow-xs' 
                    : `${theme.cardInner} hover:border-teal-500/50`
                }`}
              >
                <span>{f.label}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  filter === f.id 
                    ? 'bg-teal-200/70 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200' 
                    : 'bg-slate-100 text-slate-600 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                }`}>
                  {filterCount(f.id)}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2-Column Request Management Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
        {/* LEFT COLUMN (xl:col-span-7): Active Queue */}
        <div className="xl:col-span-7 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className={`font-bold text-sm flex items-center gap-2 ${theme.heading}`}>
              <Clock size={16} className="text-amber-500" />
              คำขอที่รอดำเนินการ / กำลังดูแล ({activeQueue.length})
            </h4>
          </div>

          {activeQueue.length === 0 ? (
            <div className={`p-10 rounded-2xl border text-center ${theme.card}`}>
              <Inbox size={36} className={`mx-auto mb-2 ${theme.subText}`} />
              <p className={`text-sm font-semibold ${theme.heading}`}>ไม่มีคำขอที่รอดำเนินการ</p>
              <p className={`text-xs mt-1 ${theme.subText}`}>คำขอใหม่จากนักศึกษาและบุคลากรจะแสดงที่นี่โดยอัตโนมัติ</p>
            </div>
          ) : (
            activeQueue.map(r => {
              const meta = typeMeta[r.type];
              const Icon = meta.icon;
              const p = r.payload || {};
              const pending = r.status === REQ_STATUS.PENDING;
              const known = Array.from(new Set([...allAllergiesByEmail(r.email)]));
              return (
                <div key={r.id} className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${r.type === 'emergency' && pending ? 'border-rose-500 bg-rose-500/5' : theme.card}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl shrink-0 ${meta.cls}`}><Icon size={20} /></div>
                      <div className="min-w-0">
                        <p className={`font-bold text-sm truncate ${theme.heading}`}>{meta.label} • {r.name}</p>
                        <p className={`text-[11px] truncate ${theme.subText}`}>{r.email} • {new Date(r.createdAt).toLocaleString('th-TH')}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold whitespace-nowrap shrink-0 ${chip(r.status)}`}>{r.status}</span>
                  </div>

                  {/* รายละเอียดตามประเภท */}
                  <div className={`p-3 rounded-xl border text-xs space-y-1.5 ${theme.cardInner}`}>
                    {r.type === 'bed' && (
                      <>
                        <p>อาการ: <strong>{p.symptom}</strong></p>
                        {p.preferredBedName && <p className={theme.subText}>เตียงที่ต้องการ: {p.preferredBedName}</p>}
                        {p.bedName && <p className="text-emerald-600 dark:text-emerald-400 font-semibold">จัดให้: {p.bedName}</p>}
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
                              <span className={med && med.stock >= i.qty ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 font-bold'}>(คงเหลือ {med ? med.stock : 0})</span>
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
                      <p className="text-rose-600 dark:text-rose-400 font-bold">{p.message}{p.bedName ? ` • ${p.bedName}` : ''}</p>
                    )}
                    {r.adminNote && <p className="text-blue-600 dark:text-blue-400">หมายเหตุ: {r.adminNote}</p>}
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
            })
          )}
        </div>

        {/* RIGHT COLUMN (xl:col-span-5): Processed History */}
        <div className="xl:col-span-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h4 className={`font-bold text-sm flex items-center gap-2 ${theme.heading}`}>
              <CheckCircle2 size={16} className="text-emerald-500" />
              ประวัติคำขอที่ดำเนินการแล้ว ({historyQueue.length})
            </h4>
          </div>

          <div className={`p-4 rounded-2xl border space-y-2.5 ${theme.card}`}>
            {filter === 'pending' ? (
              <div className="py-6 text-center space-y-2 text-xs">
                <p className={theme.subText}>กำลังกรองเฉพาะรายการที่รอดำเนินการ</p>
                <button
                  onClick={() => setFilter('all')}
                  className="px-3 py-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold hover:bg-teal-500/20"
                >
                  แสดงประวัติย้อนหลังด้วย
                </button>
              </div>
            ) : historyQueue.length === 0 ? (
              <div className="py-8 text-center text-xs">
                <p className={theme.subText}>ยังไม่มีประวัติคำขอที่เสร็จสิ้นหรือถูกปฏิเสธ</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[38rem] overflow-y-auto custom-scrollbar">
                {historyQueue.map(r => {
                  const meta = typeMeta[r.type];
                  const Icon = meta.icon;
                  const p = r.payload || {};
                  const summary = r.type === 'bed'
                    ? `${p.symptom || '-'}${p.bedName ? ` • ${p.bedName}` : ''}`
                    : r.type === 'medicine'
                      ? (p.items || []).map((i: any) => `${i.name} x${i.qty}`).join(', ')
                      : r.type === 'allergy'
                        ? `${p.drugName || '-'} (${p.drugFamily || '-'})`
                        : (p.message || 'เหตุฉุกเฉิน');

                  return (
                    <div key={r.id} className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${theme.cardInner}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`p-1.5 rounded-lg shrink-0 ${meta.cls}`}><Icon size={14} /></span>
                          <div className="min-w-0">
                            <p className={`font-bold truncate ${theme.heading}`}>{meta.label} • {r.name}</p>
                            <p className={`text-[10px] ${theme.subText}`}>{new Date(r.createdAt).toLocaleString('th-TH')}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold whitespace-nowrap shrink-0 ${chip(r.status)}`}>
                          {r.type === 'allergy' && r.status === REQ_STATUS.APPROVED ? 'ยืนยันแล้ว' : r.status}
                        </span>
                      </div>
                      <p className={`text-[11px] truncate ${theme.subText}`}>{summary}</p>
                      {r.adminNote && <p className="text-[11px] text-teal-600 dark:text-teal-400">หมายเหตุ: {r.adminNote}</p>}
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
}
