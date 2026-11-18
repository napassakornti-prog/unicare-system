import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard, BedDouble, Pill, ShieldAlert, Siren, Clock, CheckCircle2, Plus, Minus,
  Search, AlertTriangle, Send, Trash2, ChevronRight, Activity, XCircle, Wifi,
} from 'lucide-react';
import { checkDrugAllergy, DRUG_FAMILY_OPTIONS } from '../ai';
import { Req, REQ_STATUS } from '../requests';
import { AuthUser } from '../auth';

const SEVERITIES = ['รุนแรงมาก (Anaphylaxis Risk)', 'ปานกลาง (มีผื่นลมพิษ)', 'เล็กน้อย (คลื่นไส้ มึนหัว)'];

const TABS = [
  { id: 'dashboard', label: 'ภาพรวม', icon: LayoutDashboard },
  { id: 'bed', label: 'จองเตียง', icon: BedDouble },
  { id: 'medicine', label: 'ขอยา', icon: Pill },
  { id: 'allergy', label: 'ประวัติแพ้ยา', icon: ShieldAlert },
];

const typeLabel: Record<string, string> = { bed: 'จองเตียงพักฟื้น', medicine: 'ขอยา', allergy: 'แจ้งประวัติแพ้ยา', emergency: 'เรียกฉุกเฉิน' };
const typeIcon: Record<string, any> = { bed: BedDouble, medicine: Pill, allergy: ShieldAlert, emergency: Siren };

const chip = (s: string) => {
  if (s === REQ_STATUS.APPROVED || s === REQ_STATUS.DONE) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  if (s === REQ_STATUS.REJECTED) return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  if (s === REQ_STATUS.ACK) return 'bg-sky-500/10 text-sky-600 border-sky-500/20';
  return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
};

// ขั้นตอนของคำขอแต่ละประเภท
const stepsFor = (r: Req): string[] => {
  if (r.type === 'bed') return ['ส่งคำขอ', 'เจ้าหน้าที่พิจารณา', 'จัดเตียงให้แล้ว', 'เสร็จสิ้น'];
  if (r.type === 'medicine') return ['ส่งคำขอ', 'เจ้าหน้าที่ตรวจสอบ', 'อนุมัติ พร้อมรับยา', 'รับยาแล้ว'];
  if (r.type === 'allergy') return ['ส่งข้อมูล', 'รอเจ้าหน้าที่ยืนยัน', 'ยืนยันแล้ว'];
  return ['ส่งสัญญาณ', 'เจ้าหน้าที่รับทราบ', 'ดูแลเสร็จสิ้น'];
};

const currentStep = (r: Req): number => {
  const n = stepsFor(r).length;
  if (r.status === REQ_STATUS.DONE) return n - 1;
  if (r.type === 'allergy') return r.status === REQ_STATUS.APPROVED ? n - 1 : 1;
  if (r.type === 'emergency') return r.status === REQ_STATUS.ACK ? 1 : 0;
  if (r.status === REQ_STATUS.APPROVED) return 2;
  return 1;
};

function RequestCard({ r, theme }: { r: Req; theme: any; key?: string }) {
  const p = r.payload || {};
  const Icon = typeIcon[r.type] || Activity;
  const steps = stepsFor(r);
  const cur = currentStep(r);
  const rejected = r.status === REQ_STATUS.REJECTED;
  let detail = '';
  if (r.type === 'bed') detail = `${p.symptom || '-'}${p.bedName ? ` • ${p.bedName}` : p.preferredBedName ? ` • ต้องการ ${p.preferredBedName}` : ''}`;
  if (r.type === 'medicine') detail = (p.items || []).map((i: any) => `${i.name} x${i.qty}`).join(', ');
  if (r.type === 'allergy') detail = `${p.drugName} • ${p.reaction || '-'}`;
  if (r.type === 'emergency') detail = p.message || 'เรียกความช่วยเหลือฉุกเฉิน';

  return (
    <div className={`p-4 rounded-2xl border ${theme.cardInner}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 shrink-0"><Icon size={16} /></div>
          <div className="min-w-0">
            <p className="text-xs font-bold">{typeLabel[r.type]}</p>
            <p className={`text-[11px] mt-0.5 truncate ${theme.subText}`}>{detail}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full border text-[10px] font-bold whitespace-nowrap ${chip(r.status)}`}>
          {r.type === 'allergy' && r.status === REQ_STATUS.APPROVED ? 'ยืนยันแล้ว' : r.status}
        </span>
      </div>

      {!rejected ? (
        <div className="mt-4 flex items-center">
          {steps.map((s, i) => (
            <React.Fragment key={s}>
              <div className="flex flex-col items-center text-center w-16 shrink-0">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  i < cur ? 'bg-teal-600 text-white' : i === cur ? 'bg-teal-600 text-white ring-4 ring-teal-500/25' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                }`}>
                  {i < cur ? <CheckCircle2 size={14} /> : i + 1}
                </span>
                <span className={`mt-1 text-[9px] leading-tight ${i <= cur ? 'font-bold' : theme.subText}`}>{s}</span>
              </div>
              {i < steps.length - 1 && <div className={`h-0.5 flex-1 -mt-4 ${i < cur ? 'bg-teal-600' : 'bg-slate-200 dark:bg-slate-700'}`}></div>}
            </React.Fragment>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-rose-600 font-semibold flex items-center gap-1"><XCircle size={13} /> คำขอนี้ไม่ได้รับการอนุมัติ</p>
      )}

      {r.adminNote && <p className="mt-2 text-[11px] text-teal-600">ข้อความจากเจ้าหน้าที่: {r.adminNote}</p>}
      <p className={`mt-2 text-[10px] ${theme.subText}`}>{new Date(r.createdAt).toLocaleString('th-TH')}</p>
    </div>
  );
}

const zoneOf = (name: string) => (name.includes('หญิง') ? 'โซนหญิง' : name.includes('ชาย') ? 'โซนชาย' : name.includes('สำรอง') ? 'เตียงสำรองฉุกเฉิน' : 'ห้องพักฟื้นทั่วไป');

export default function StudentPortal({
  user, theme, beds, medicines, myRequests, onCreate, addToast,
}: {
  user: AuthUser;
  theme: any;
  beds: any[];
  medicines: any[];
  myRequests: Req[];
  onCreate: (type: Req['type'], payload: any) => Promise<void>;
  addToast: Function;
}) {
  const [tab, setTab] = useState('dashboard');

  const freeBeds = beds.filter(b => b.status === 'available');
  const pendingCount = myRequests.filter(r => r.status === REQ_STATUS.PENDING).length;
  const myAllergyReqs = myRequests.filter(r => r.type === 'allergy' && r.status !== REQ_STATUS.REJECTED);
  const myAllergies = myAllergyReqs.map(r => r.payload?.drugName).filter(Boolean) as string[];
  const activeBed = myRequests.find(r => r.type === 'bed' && r.status === REQ_STATUS.APPROVED);
  const latestEmergency = myRequests.find(r => r.type === 'emergency' && r.status !== REQ_STATUS.DONE && r.status !== REQ_STATUS.REJECTED);
  const occupancy = beds.length ? Math.round(((beds.length - freeBeds.length) / beds.length) * 100) : 0;

  const zones = useMemo(() => {
    const m: Record<string, any[]> = {};
    beds.forEach(b => { (m[zoneOf(b.name)] ||= []).push(b); });
    return m;
  }, [beds]);

  // ฟอร์มจองเตียง
  const [bedSymptom, setBedSymptom] = useState('');
  const [preferredBed, setPreferredBed] = useState('');
  const hasOpenBedReq = myRequests.some(r => r.type === 'bed' && (r.status === REQ_STATUS.PENDING || r.status === REQ_STATUS.APPROVED));

  // ฟอร์มขอยา
  const [medSearch, setMedSearch] = useState('');
  const [cart, setCart] = useState<{ id: string; name: string; en: string; unit: string; qty: number }[]>([]);
  const [medSymptom, setMedSymptom] = useState('');
  const filteredMeds = useMemo(() => {
    const q = medSearch.trim().toLowerCase();
    return medicines
      .filter(m => m.category !== 'เวชภัณฑ์/อุปกรณ์')
      .filter(m => !q || m.name.toLowerCase().includes(q) || (m.en || '').toLowerCase().includes(q));
  }, [medicines, medSearch]);

  const addToCart = (m: any) => {
    const warn = checkDrugAllergy(m.name + ' ' + (m.en || ''), myAllergies);
    if (warn) {
      addToast('ไม่สามารถขอยานี้ได้', `คุณแจ้งประวัติแพ้ไว้: ${warn.message}`, 'error');
      return;
    }
    setCart(prev => {
      const ex = prev.find(i => i.id === m.id);
      if (ex) return prev.map(i => i.id === m.id ? { ...i, qty: Math.min(i.qty + 1, 10) } : i);
      return [...prev, { id: m.id, name: m.name, en: m.en || '', unit: m.unit, qty: 1 }];
    });
  };

  // ฟอร์มแพ้ยา
  const [form, setForm] = useState({ drugName: '', drugFamily: DRUG_FAMILY_OPTIONS[0], reaction: '', severity: SEVERITIES[0] });

  const sendEmergency = async () => {
    if (!window.confirm('ต้องการเรียกเจ้าหน้าที่มาดูแลทันทีหรือไม่?')) return;
    await onCreate('emergency', {
      message: 'ผู้ป่วยกดปุ่มเรียกฉุกเฉินขณะพักที่เตียง',
      bedId: activeBed?.payload?.bedId || null,
      bedName: activeBed?.payload?.bedName || null,
    });
    addToast('ส่งสัญญาณฉุกเฉินแล้ว', 'เจ้าหน้าที่ได้รับแจ้งแล้ว กรุณารอสักครู่', 'error');
  };

  const inputCls = `w-full p-3 rounded-xl border text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 ${theme.inputBg}`;
  const primaryBtn = 'w-full py-3 rounded-xl bg-gradient-to-r from-teal-700 to-teal-500 hover:brightness-110 text-white font-bold text-sm shadow-lg shadow-teal-600/25 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 transition-all';

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ===== แถวบน: บัตรสุขภาพดิจิทัล + สถานะเตียง ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 relative overflow-hidden rounded-3xl p-6 sm:p-7 text-white shadow-xl shadow-teal-900/20 bg-gradient-to-br from-teal-900 via-teal-700 to-sky-500">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10"></div>
          <div className="absolute -left-10 -bottom-24 w-64 h-64 rounded-full bg-teal-950/20"></div>
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] text-teal-100">UNICARE HEALTH CARD</p>
              <p className="text-[11px] text-teal-100 mt-0.5">มหาวิทยาลัยกาฬสินธุ์</p>
            </div>
            <div className="w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90"></div>
          </div>
          <div className="relative mt-6 flex items-center gap-4">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="w-16 h-16 rounded-2xl border-2 border-white/60 object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center text-2xl font-black">{user.name.charAt(0)}</div>
            )}
            <div className="min-w-0">
              <p className="text-xl font-black leading-tight truncate">{user.name}</p>
              <p className="text-xs text-teal-100 truncate">{user.email}</p>
            </div>
          </div>
          <div className="relative mt-6 grid grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
              <p className="text-[10px] text-teal-100">สถานะ</p>
              <p className="font-bold mt-0.5">{activeBed ? 'พักที่เตียง' : 'ปกติ'}</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/10 border border-white/15">
              <p className="text-[10px] text-teal-100">คำขอที่รอ</p>
              <p className="font-bold mt-0.5">{pendingCount} รายการ</p>
            </div>
            <div className={`p-3 rounded-2xl border ${myAllergies.length ? 'bg-rose-500/30 border-rose-300/40' : 'bg-white/10 border-white/15'}`}>
              <p className="text-[10px] text-teal-100">แพ้ยา</p>
              <p className="font-bold mt-0.5 truncate">{myAllergies.length ? myAllergies.join(', ') : 'ไม่มีประวัติ'}</p>
            </div>
          </div>
        </div>

        <div className={`rounded-3xl border p-6 flex flex-col justify-between ${theme.card}`}>
          <div className="flex items-center justify-between">
            <p className={`text-xs font-bold ${theme.heading}`}>เตียงพักฟื้นตอนนี้</p>
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600"><Wifi size={11} /> เรียลไทม์</span>
          </div>
          <div className="mt-3">
            <p className="text-5xl font-black text-teal-600 leading-none">{freeBeds.length}<span className={`text-lg font-bold ${theme.subText}`}> / {beds.length}</span></p>
            <p className={`text-xs mt-1 ${theme.subText}`}>เตียงว่างพร้อมให้บริการ</p>
          </div>
          <div className="mt-4">
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div className={`h-full rounded-full ${occupancy >= 80 ? 'bg-rose-500' : occupancy >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${occupancy}%` }}></div>
            </div>
            <p className={`text-[10px] mt-1.5 ${theme.subText}`}>ใช้งานแล้ว {occupancy}%</p>
          </div>
        </div>
      </div>

      {/* ===== ปุ่มฉุกเฉินเมื่ออยู่บนเตียง ===== */}
      {activeBed && (
        <div className="p-5 rounded-3xl border-2 border-rose-500/40 bg-rose-500/5 flex flex-col sm:flex-row items-center gap-5">
          <div className="flex-1 text-center sm:text-left">
            <p className="font-black text-rose-600">คุณกำลังพักที่ {activeBed.payload?.bedName || 'เตียงพยาบาล'}</p>
            <p className={`text-xs mt-1 ${theme.subText}`}>หากอาการแย่ลง เจ็บหน้าอก หายใจลำบาก หรือต้องการความช่วยเหลือ กดปุ่มเรียกเจ้าหน้าที่ได้ทันที</p>
            {latestEmergency && (
              <p className="text-xs mt-2 font-bold text-sky-600">
                {latestEmergency.status === REQ_STATUS.ACK ? 'เจ้าหน้าที่รับทราบแล้ว กำลังไปดูแลคุณ' : 'ส่งสัญญาณแล้ว รอเจ้าหน้าที่ตอบรับ...'}
              </p>
            )}
          </div>
          <button
            onClick={sendEmergency}
            disabled={!!latestEmergency}
            className="w-36 h-36 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-black shadow-2xl shadow-rose-600/40 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-60 animate-pulse disabled:animate-none"
          >
            <Siren size={40} />
            <span className="text-sm">เรียกฉุกเฉิน</span>
          </button>
        </div>
      )}

      {/* ===== เมนูแท็บ ===== */}
      <div className={`p-1.5 rounded-2xl border flex gap-1 overflow-x-auto ${theme.card}`}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[110px] px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-2 whitespace-nowrap transition-all ${
                active ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25' : `${theme.subText} hover:bg-teal-500/10 hover:text-teal-600`
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ---------- ภาพรวม ---------- */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { id: 'bed', icon: BedDouble, title: 'จองเตียงพักฟื้น', desc: `ขณะนี้มีเตียงว่าง ${freeBeds.length} เตียง`, grad: 'from-teal-700 to-teal-500' },
              { id: 'medicine', icon: Pill, title: 'ขอยาตามอาการ', desc: 'ค้นหายาสามัญประจำห้องพยาบาล', grad: 'from-sky-600 to-sky-400' },
              { id: 'allergy', icon: ShieldAlert, title: 'แจ้งประวัติแพ้ยา', desc: myAllergies.length ? `บันทึกไว้แล้ว ${myAllergies.length} รายการ` : 'เพื่อความปลอดภัยของคุณ', grad: 'from-rose-600 to-rose-400' },
            ].map(a => {
              const Icon = a.icon;
              return (
                <button
                  key={a.id}
                  onClick={() => setTab(a.id)}
                  className={`group text-left p-5 rounded-3xl border hover:-translate-y-0.5 hover:shadow-xl transition-all ${theme.card}`}
                >
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${a.grad} text-white flex items-center justify-center shadow-lg`}>
                    <Icon size={22} />
                  </div>
                  <p className={`font-bold mt-4 ${theme.heading}`}>{a.title}</p>
                  <p className={`text-xs mt-1 ${theme.subText}`}>{a.desc}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-teal-600 group-hover:gap-2 transition-all">เริ่มดำเนินการ <ChevronRight size={14} /></span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            <div className={`lg:col-span-3 p-6 rounded-3xl border ${theme.card}`}>
              <h4 className={`text-sm font-bold mb-4 flex items-center gap-2 ${theme.heading}`}><Activity size={16} className="text-teal-600" /> ติดตามสถานะคำขอของฉัน</h4>
              <div className="space-y-3 max-h-[28rem] overflow-y-auto">
                {myRequests.length === 0 && <p className={`text-xs text-center py-10 ${theme.subText}`}>ยังไม่มีคำขอ เลือกบริการด้านบนเพื่อเริ่มต้นได้เลย</p>}
                {myRequests.slice(0, 8).map(r => <RequestCard key={r.id} r={r} theme={theme} />)}
              </div>
            </div>

            <div className={`lg:col-span-2 p-6 rounded-3xl border ${theme.card}`}>
              <h4 className={`text-sm font-bold mb-4 flex items-center gap-2 ${theme.heading}`}><BedDouble size={16} className="text-teal-600" /> ผังเตียง</h4>
              <div className="space-y-4">
                {(Object.entries(zones) as [string, any[]][]).map(([zone, list]) => (
                  <div key={zone}>
                    <p className={`text-[11px] font-bold mb-2 ${theme.subText}`}>{zone}</p>
                    <div className="grid grid-cols-2 gap-2">
                      {list.map(b => {
                        const free = b.status === 'available';
                        return (
                          <div key={b.id} className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${free ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'}`}>
                            <BedDouble size={16} className={free ? 'text-emerald-600' : 'text-rose-500'} />
                            <div className="min-w-0">
                              <p className="font-bold truncate">{b.name.replace(/\s*\(.*\)/, '')}</p>
                              <p className={`text-[10px] font-semibold ${free ? 'text-emerald-600' : 'text-rose-500'}`}>{free ? 'ว่าง' : 'ไม่ว่าง'}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- จองเตียง ---------- */}
      {tab === 'bed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className={`p-6 rounded-3xl border space-y-4 ${theme.card}`}>
            <div>
              <h3 className={`font-bold text-base ${theme.heading}`}>ขอจองเตียงพักฟื้น</h3>
              <p className={`text-xs mt-1 ${theme.subText}`}>ส่งคำขอไปยังเจ้าหน้าที่ เมื่ออนุมัติแล้วจะแสดงเตียงที่จัดให้และปุ่มเรียกฉุกเฉิน</p>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold">อาการ / เหตุผลที่ต้องการพัก *</label>
                <textarea value={bedSymptom} onChange={e => setBedSymptom(e.target.value)} rows={3}
                  placeholder="เช่น ปวดศีรษะ เวียนศีรษะ มีไข้" className={`mt-1.5 ${inputCls}`} />
              </div>
              <div>
                <label className="text-xs font-semibold">เตียงที่ต้องการ (ถ้ามี)</label>
                <select value={preferredBed} onChange={e => setPreferredBed(e.target.value)} className={`mt-1.5 ${inputCls}`}>
                  <option value="">ให้เจ้าหน้าที่เลือกให้</option>
                  {freeBeds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {hasOpenBedReq && <p className="text-xs text-amber-600 font-semibold">คุณมีคำขอจองเตียงที่ยังไม่เสร็จสิ้น ไม่สามารถส่งซ้ำได้</p>}
              <button
                disabled={hasOpenBedReq || !bedSymptom.trim()}
                onClick={async () => {
                  const pb = beds.find(b => b.id === preferredBed);
                  await onCreate('bed', { symptom: bedSymptom.trim(), preferredBedId: pb?.id || null, preferredBedName: pb?.name || null });
                  setBedSymptom(''); setPreferredBed('');
                  addToast('ส่งคำขอจองเตียงแล้ว', 'รอเจ้าหน้าที่พิจารณาอนุมัติ');
                }}
                className={primaryBtn}
              >
                <Send size={15} /> ส่งคำขอจองเตียง
              </button>
            </div>
          </div>
          <div className={`p-6 rounded-3xl border ${theme.card}`}>
            <h4 className={`text-sm font-bold mb-4 ${theme.heading}`}>คำขอจองเตียงของฉัน</h4>
            <div className="space-y-3">
              {myRequests.filter(r => r.type === 'bed').length === 0 && <p className={`text-xs text-center py-10 ${theme.subText}`}>ยังไม่มีคำขอ</p>}
              {myRequests.filter(r => r.type === 'bed').map(r => <RequestCard key={r.id} r={r} theme={theme} />)}
            </div>
          </div>
        </div>
      )}

      {/* ---------- ขอยา ---------- */}
      {tab === 'medicine' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className={`lg:col-span-3 p-6 rounded-3xl border space-y-3 ${theme.card}`}>
            <h3 className={`font-bold text-base ${theme.heading}`}>เลือกยาที่ต้องการขอ</h3>
            <div className="relative">
              <Search size={15} className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${theme.subText}`} />
              <input value={medSearch} onChange={e => setMedSearch(e.target.value)} placeholder="ค้นหาชื่อยา (ไทย / อังกฤษ)"
                className={`${inputCls} !pl-10`} />
            </div>
            <div className="max-h-[26rem] overflow-y-auto space-y-2 pr-1">
              {filteredMeds.map(m => {
                const out = m.stock <= 0;
                const warn = checkDrugAllergy(m.name + ' ' + (m.en || ''), myAllergies);
                return (
                  <div key={m.id} className={`p-3 rounded-2xl border text-xs flex items-center justify-between gap-3 ${theme.cardInner}`}>
                    <div className="min-w-0">
                      <p className="font-semibold">{m.name}</p>
                      {m.en && <p className={`text-[10px] ${theme.subText}`}>({m.en})</p>}
                      {warn && <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1 mt-0.5"><AlertTriangle size={10} /> คุณแจ้งแพ้ยากลุ่มนี้</p>}
                    </div>
                    <button
                      disabled={out || !!warn}
                      onClick={() => addToCart(m)}
                      className="px-3.5 py-2 rounded-xl bg-teal-500/10 text-teal-600 font-bold hover:bg-teal-500/20 disabled:opacity-40 whitespace-nowrap"
                    >
                      {out ? 'หมด' : '+ เพิ่ม'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-5">
            <div className={`p-6 rounded-3xl border space-y-3 ${theme.card}`}>
              <h4 className={`text-sm font-bold ${theme.heading}`}>รายการที่ขอ ({cart.length})</h4>
              {cart.length === 0 && <p className={`text-xs ${theme.subText}`}>ยังไม่ได้เลือกยา</p>}
              {cart.map(i => (
                <div key={i.id} className={`p-3 rounded-2xl border text-xs ${theme.cardInner}`}>
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{i.name}</span>
                    <button onClick={() => setCart(cart.filter(c => c.id !== i.id))} className="text-rose-500"><Trash2 size={14} /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button onClick={() => setCart(cart.map(c => c.id === i.id ? { ...c, qty: Math.max(1, c.qty - 1) } : c))} className="p-1.5 rounded-lg border"><Minus size={12} /></button>
                    <span className="font-bold w-6 text-center">{i.qty}</span>
                    <button onClick={() => setCart(cart.map(c => c.id === i.id ? { ...c, qty: Math.min(10, c.qty + 1) } : c))} className="p-1.5 rounded-lg border"><Plus size={12} /></button>
                    <span className={theme.subText}>{i.unit}</span>
                  </div>
                </div>
              ))}
              <textarea value={medSymptom} onChange={e => setMedSymptom(e.target.value)} rows={2}
                placeholder="อาการที่ต้องการใช้ยา *" className={inputCls} />
              <button
                disabled={cart.length === 0 || !medSymptom.trim()}
                onClick={async () => {
                  await onCreate('medicine', { items: cart.map(({ id, name, en, unit, qty }) => ({ id, name, en, unit, qty })), symptom: medSymptom.trim() });
                  setCart([]); setMedSymptom('');
                  addToast('ส่งคำขอยาแล้ว', 'รอเจ้าหน้าที่ตรวจสอบและอนุมัติ');
                }}
                className={primaryBtn}
              >
                <Send size={15} /> ส่งคำขอยา
              </button>
            </div>
            <div className={`p-6 rounded-3xl border ${theme.card}`}>
              <h4 className={`text-sm font-bold mb-3 ${theme.heading}`}>คำขอยาของฉัน</h4>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {myRequests.filter(r => r.type === 'medicine').length === 0 && <p className={`text-xs text-center py-4 ${theme.subText}`}>ยังไม่มีคำขอ</p>}
                {myRequests.filter(r => r.type === 'medicine').map(r => <RequestCard key={r.id} r={r} theme={theme} />)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- แพ้ยา ---------- */}
      {tab === 'allergy' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className={`p-6 rounded-3xl border space-y-4 ${theme.card}`}>
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="p-3 rounded-2xl bg-rose-500/10 text-rose-600"><ShieldAlert size={22} /></div>
              <div>
                <h3 className={`font-bold text-base ${theme.heading}`}>บันทึกประวัติการแพ้ยา</h3>
                <p className={`text-xs mt-0.5 ${theme.subText}`}>เจ้าหน้าที่จะยืนยันข้อมูลก่อนนำไปใช้ตรวจสอบตอนจ่ายยา</p>
              </div>
            </div>
            <form
              onSubmit={async e => {
                e.preventDefault();
                if (!form.drugName.trim()) return;
                await onCreate('allergy', { ...form, drugName: form.drugName.trim() });
                setForm({ drugName: '', drugFamily: DRUG_FAMILY_OPTIONS[0], reaction: '', severity: SEVERITIES[0] });
                addToast('บันทึกประวัติแพ้ยาแล้ว', 'รอเจ้าหน้าที่ยืนยันข้อมูล');
              }}
              className="space-y-3"
            >
              <div>
                <label className="text-xs font-semibold">ชื่อยาที่แพ้ *</label>
                <input required value={form.drugName} onChange={e => setForm({ ...form, drugName: e.target.value })}
                  placeholder="เช่น อะม็อกซีซิลลิน, ไอบูโพรเฟน" className={`mt-1.5 ${inputCls}`} />
              </div>
              <div>
                <label className="text-xs font-semibold">กลุ่มยา (ถ้าทราบ)</label>
                <select value={form.drugFamily} onChange={e => setForm({ ...form, drugFamily: e.target.value })} className={`mt-1.5 ${inputCls}`}>
                  {DRUG_FAMILY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold">อาการที่เกิดเมื่อแพ้</label>
                <input value={form.reaction} onChange={e => setForm({ ...form, reaction: e.target.value })}
                  placeholder="เช่น ผื่นคัน ลมพิษ แน่นหน้าอก" className={`mt-1.5 ${inputCls}`} />
              </div>
              <div>
                <label className="text-xs font-semibold">ระดับความรุนแรง</label>
                <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className={`mt-1.5 ${inputCls}`}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button className={primaryBtn}><Send size={15} /> บันทึกประวัติแพ้ยา</button>
            </form>
          </div>
          <div className={`p-6 rounded-3xl border ${theme.card}`}>
            <h4 className={`text-sm font-bold mb-4 ${theme.heading}`}>รายการแพ้ยาของฉัน</h4>
            <div className="space-y-3">
              {myAllergyReqs.length === 0 && <p className={`text-xs text-center py-10 ${theme.subText}`}>ยังไม่มีประวัติการแพ้ยา</p>}
              {myAllergyReqs.map(r => (
                <div key={r.id} className={`p-4 rounded-2xl border text-xs flex justify-between items-start gap-2 ${theme.cardInner}`}>
                  <div>
                    <p className="font-bold text-rose-600">{r.payload.drugName} <span className={`font-normal ${theme.subText}`}>({r.payload.drugFamily})</span></p>
                    <p className={`mt-1 ${theme.subText}`}>{r.payload.reaction || '-'} • {r.payload.severity}</p>
                  </div>
                  {r.status === REQ_STATUS.APPROVED ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-bold text-[11px] whitespace-nowrap"><CheckCircle2 size={13} /> ยืนยันแล้ว</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-bold text-[11px] whitespace-nowrap"><Clock size={13} /> รอยืนยัน</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
