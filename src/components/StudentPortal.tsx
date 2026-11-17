import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard, Bed, Pill, ShieldAlert, Siren, Clock, CheckCircle2, Plus, Minus,
  Search, Activity, AlertTriangle, Send, Trash2,
} from 'lucide-react';
import { checkDrugAllergy, DRUG_FAMILY_OPTIONS } from '../ai';
import { Req, REQ_STATUS } from '../requests';
import { AuthUser } from '../auth';

const SEVERITIES = ['รุนแรงมาก (Anaphylaxis Risk)', 'ปานกลาง (มีผื่นลมพิษ)', 'เล็กน้อย (คลื่นไส้ มึนหัว)'];

const TABS = [
  { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
  { id: 'bed', label: 'จองเตียง', icon: Bed },
  { id: 'medicine', label: 'ขอยา', icon: Pill },
  { id: 'allergy', label: 'ประวัติแพ้ยา', icon: ShieldAlert },
];

const statusChip = (s: string) => {
  if (s === REQ_STATUS.APPROVED || s === REQ_STATUS.DONE) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
  if (s === REQ_STATUS.REJECTED) return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
  if (s === REQ_STATUS.ACK) return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
  return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
};

const statusText = (r: Req) => {
  if (r.type === 'allergy' && r.status === REQ_STATUS.APPROVED) return 'ยืนยันแล้ว';
  return r.status;
};

const typeLabel: Record<string, string> = { bed: 'จองเตียง', medicine: 'ขอยา', allergy: 'แจ้งแพ้ยา', emergency: 'เรียกฉุกเฉิน' };

function RequestRow({ r, theme }: { r: Req; theme: any; key?: string }) {
  const p = r.payload || {};
  let detail = '';
  if (r.type === 'bed') detail = `${p.symptom || '-'}${p.bedName ? ` • ${p.bedName}` : p.preferredBedName ? ` • ต้องการ ${p.preferredBedName}` : ''}`;
  if (r.type === 'medicine') detail = (p.items || []).map((i: any) => `${i.name} x${i.qty}`).join(', ');
  if (r.type === 'allergy') detail = `${p.drugName} • ${p.reaction || '-'}`;
  if (r.type === 'emergency') detail = p.message || 'เรียกความช่วยเหลือฉุกเฉิน';
  return (
    <div className={`p-3 rounded-2xl border text-xs ${theme.cardInner}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold">{typeLabel[r.type]}</span>
        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-semibold ${statusChip(r.status)}`}>{statusText(r)}</span>
      </div>
      <p className={`mt-1 ${theme.subText}`}>{detail}</p>
      <p className={`mt-1 text-[10px] ${theme.subText}`}>{new Date(r.createdAt).toLocaleString('th-TH')}</p>
      {r.adminNote && <p className="mt-1 text-[11px] text-blue-600">ข้อความจากเจ้าหน้าที่: {r.adminNote}</p>}
    </div>
  );
}

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

  // ---- ข้อมูลจากคำขอของฉัน ----
  const freeBeds = beds.filter(b => b.status === 'available');
  const pendingCount = myRequests.filter(r => r.status === REQ_STATUS.PENDING).length;
  const myAllergyReqs = myRequests.filter(r => r.type === 'allergy' && r.status !== REQ_STATUS.REJECTED);
  const myAllergies = myAllergyReqs.map(r => r.payload?.drugName).filter(Boolean) as string[];
  const activeBed = myRequests.find(r => r.type === 'bed' && r.status === REQ_STATUS.APPROVED);
  const latestEmergency = myRequests.find(r => r.type === 'emergency' && r.status !== REQ_STATUS.DONE && r.status !== REQ_STATUS.REJECTED);

  // ---- ฟอร์มจองเตียง ----
  const [bedSymptom, setBedSymptom] = useState('');
  const [preferredBed, setPreferredBed] = useState('');
  const hasOpenBedReq = myRequests.some(r => r.type === 'bed' && (r.status === REQ_STATUS.PENDING || r.status === REQ_STATUS.APPROVED));

  // ---- ฟอร์มขอยา ----
  const [medSearch, setMedSearch] = useState('');
  const [cart, setCart] = useState<{ id: string; name: string; en: string; unit: string; qty: number; stock: number }[]>([]);
  const [medSymptom, setMedSymptom] = useState('');
  const filteredMeds = useMemo(() => {
    const q = medSearch.trim().toLowerCase();
    return medicines.filter(m => m.category !== 'เวชภัณฑ์/อุปกรณ์')
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
      return [...prev, { id: m.id, name: m.name, en: m.en || '', unit: m.unit, qty: 1, stock: m.stock }];
    });
  };

  // ---- ฟอร์มแพ้ยา ----
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

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* แท็บเมนู */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap border transition-all ${
                active ? 'bg-teal-600 text-white border-teal-600 shadow-lg shadow-teal-600/20' : `${theme.card} hover:border-teal-500/50`
              }`}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ปุ่มฉุกเฉินเมื่อกำลังนอนเตียง */}
      {activeBed && (
        <div className="p-5 rounded-3xl border-2 border-rose-500/40 bg-rose-500/5 flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1 text-center sm:text-left">
            <p className="font-black text-rose-600 text-sm">คุณกำลังพักที่ {activeBed.payload?.bedName || 'เตียงพยาบาล'}</p>
            <p className={`text-xs mt-0.5 ${theme.subText}`}>หากรู้สึกไม่สบายมากขึ้น เจ็บหน้าอก หายใจลำบาก หรือต้องการความช่วยเหลือ กดปุ่มเรียกเจ้าหน้าที่ได้ทันที</p>
            {latestEmergency && (
              <p className="text-xs mt-2 font-bold text-blue-600">
                {latestEmergency.status === REQ_STATUS.ACK ? 'เจ้าหน้าที่รับทราบแล้ว กำลังไปดูแลคุณ' : 'ส่งสัญญาณแล้ว รอเจ้าหน้าที่ตอบรับ...'}
              </p>
            )}
          </div>
          <button
            onClick={sendEmergency}
            disabled={!!latestEmergency}
            className="w-40 h-40 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-black shadow-2xl shadow-rose-600/40 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all disabled:opacity-60 animate-pulse disabled:animate-none"
          >
            <Siren size={44} />
            <span className="text-sm">เรียกฉุกเฉิน</span>
          </button>
        </div>
      )}

      {/* ---------- แดชบอร์ด ---------- */}
      {tab === 'dashboard' && (
        <div className="space-y-5">
          <div className={`p-6 rounded-3xl border ${theme.card}`}>
            <h3 className={`font-black text-lg ${theme.heading}`}>สวัสดี {user.name}</h3>
            <p className={`text-xs mt-1 ${theme.subText}`}>{user.email}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'เตียงว่าง', value: `${freeBeds.length}/${beds.length}`, cls: 'text-emerald-600' },
              { label: 'คำขอรอดำเนินการ', value: pendingCount, cls: 'text-amber-600' },
              { label: 'คำขอทั้งหมดของฉัน', value: myRequests.length, cls: 'text-teal-600' },
              { label: 'ยาที่แจ้งว่าแพ้', value: myAllergies.length, cls: 'text-rose-600' },
            ].map(c => (
              <div key={c.label} className={`p-4 rounded-2xl border ${theme.card}`}>
                <p className={`text-[11px] font-semibold ${theme.subText}`}>{c.label}</p>
                <p className={`text-2xl font-black mt-1 ${c.cls}`}>{c.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className={`p-5 rounded-3xl border ${theme.card}`}>
              <h4 className={`text-xs font-bold mb-3 flex items-center gap-1.5 ${theme.heading}`}><Bed size={15} className="text-teal-600" /> สถานะเตียงปัจจุบัน</h4>
              <div className="grid grid-cols-2 gap-2">
                {beds.map(b => (
                  <div key={b.id} className={`p-3 rounded-xl border text-xs ${b.status === 'available' ? 'bg-emerald-500/5 border-emerald-500/30' : 'bg-rose-500/5 border-rose-500/30'}`}>
                    <p className="font-bold">{b.name}</p>
                    <p className={b.status === 'available' ? 'text-emerald-600' : 'text-rose-600'}>{b.status === 'available' ? 'ว่าง' : 'ไม่ว่าง'}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className={`p-5 rounded-3xl border ${theme.card}`}>
              <h4 className={`text-xs font-bold mb-3 flex items-center gap-1.5 ${theme.heading}`}><Activity size={15} className="text-teal-600" /> คำขอล่าสุดของฉัน</h4>
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {myRequests.length === 0 && <p className={`text-xs text-center py-6 ${theme.subText}`}>ยังไม่มีคำขอ</p>}
                {myRequests.slice(0, 6).map(r => <RequestRow key={r.id} r={r} theme={theme} />)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- จองเตียง ---------- */}
      {tab === 'bed' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className={`p-6 rounded-3xl border space-y-4 ${theme.card}`}>
            <h3 className={`font-bold text-base ${theme.heading}`}>ขอจองเตียงพักฟื้น</h3>
            <p className={`text-xs ${theme.subText}`}>ส่งคำขอไปยังเจ้าหน้าที่ เมื่ออนุมัติแล้วจะแสดงเตียงที่จัดให้</p>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold">อาการ / เหตุผลที่ต้องการพัก *</label>
                <textarea
                  value={bedSymptom} onChange={e => setBedSymptom(e.target.value)} rows={3}
                  placeholder="เช่น ปวดศีรษะ เวียนศีรษะ มีไข้"
                  className={`mt-1 w-full p-2.5 rounded-xl border ${theme.inputBg}`}
                />
              </div>
              <div>
                <label className="font-semibold">เตียงที่ต้องการ (ถ้ามี)</label>
                <select value={preferredBed} onChange={e => setPreferredBed(e.target.value)} className={`mt-1 w-full p-2.5 rounded-xl border ${theme.inputBg}`}>
                  <option value="">ให้เจ้าหน้าที่เลือกให้</option>
                  {freeBeds.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              {hasOpenBedReq && <p className="text-amber-600 font-semibold">คุณมีคำขอจองเตียงที่ยังไม่เสร็จสิ้น ไม่สามารถส่งซ้ำได้</p>}
              <button
                disabled={hasOpenBedReq || !bedSymptom.trim()}
                onClick={async () => {
                  const pb = beds.find(b => b.id === preferredBed);
                  await onCreate('bed', { symptom: bedSymptom.trim(), preferredBedId: pb?.id || null, preferredBedName: pb?.name || null });
                  setBedSymptom(''); setPreferredBed('');
                  addToast('ส่งคำขอจองเตียงแล้ว', 'รอเจ้าหน้าที่พิจารณาอนุมัติ');
                }}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={14} /> ส่งคำขอจองเตียง
              </button>
            </div>
          </div>
          <div className={`p-6 rounded-3xl border ${theme.card}`}>
            <h4 className={`text-xs font-bold mb-3 ${theme.heading}`}>คำขอจองเตียงของฉัน</h4>
            <div className="space-y-2">
              {myRequests.filter(r => r.type === 'bed').length === 0 && <p className={`text-xs text-center py-6 ${theme.subText}`}>ยังไม่มีคำขอ</p>}
              {myRequests.filter(r => r.type === 'bed').map(r => <RequestRow key={r.id} r={r} theme={theme} />)}
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
              <Search size={14} className={`absolute left-3 top-1/2 -translate-y-1/2 ${theme.subText}`} />
              <input value={medSearch} onChange={e => setMedSearch(e.target.value)} placeholder="ค้นหาชื่อยา (ไทย / อังกฤษ)"
                className={`w-full pl-9 pr-3 py-2 rounded-xl border text-xs ${theme.inputBg}`} />
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1.5">
              {filteredMeds.map(m => {
                const out = m.stock <= 0;
                const warn = checkDrugAllergy(m.name + ' ' + (m.en || ''), myAllergies);
                return (
                  <div key={m.id} className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${theme.cardInner}`}>
                    <div className="min-w-0">
                      <p className="font-semibold">{m.name}</p>
                      {m.en && <p className={`text-[10px] ${theme.subText}`}>({m.en})</p>}
                      {warn && <p className="text-[10px] text-rose-600 font-bold flex items-center gap-1"><AlertTriangle size={10} /> คุณแจ้งแพ้ยากลุ่มนี้</p>}
                    </div>
                    <button
                      disabled={out || !!warn}
                      onClick={() => addToCart(m)}
                      className="px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-600 font-semibold hover:bg-teal-500/20 disabled:opacity-40 whitespace-nowrap"
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
              <h4 className={`text-xs font-bold ${theme.heading}`}>รายการที่ขอ ({cart.length})</h4>
              {cart.length === 0 && <p className={`text-xs ${theme.subText}`}>ยังไม่ได้เลือกยา</p>}
              {cart.map(i => (
                <div key={i.id} className={`p-2.5 rounded-xl border text-xs ${theme.cardInner}`}>
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{i.name}</span>
                    <button onClick={() => setCart(cart.filter(c => c.id !== i.id))} className="text-rose-500"><Trash2 size={13} /></button>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <button onClick={() => setCart(cart.map(c => c.id === i.id ? { ...c, qty: Math.max(1, c.qty - 1) } : c))} className="p-1 rounded border"><Minus size={12} /></button>
                    <span className="font-bold w-6 text-center">{i.qty}</span>
                    <button onClick={() => setCart(cart.map(c => c.id === i.id ? { ...c, qty: Math.min(10, c.qty + 1) } : c))} className="p-1 rounded border"><Plus size={12} /></button>
                    <span className={theme.subText}>{i.unit}</span>
                  </div>
                </div>
              ))}
              <textarea
                value={medSymptom} onChange={e => setMedSymptom(e.target.value)} rows={2}
                placeholder="อาการที่ต้องการใช้ยา *"
                className={`w-full p-2.5 rounded-xl border text-xs ${theme.inputBg}`}
              />
              <button
                disabled={cart.length === 0 || !medSymptom.trim()}
                onClick={async () => {
                  await onCreate('medicine', { items: cart.map(({ id, name, en, unit, qty }) => ({ id, name, en, unit, qty })), symptom: medSymptom.trim() });
                  setCart([]); setMedSymptom('');
                  addToast('ส่งคำขอยาแล้ว', 'รอเจ้าหน้าที่ตรวจสอบและอนุมัติ');
                }}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Send size={14} /> ส่งคำขอยา
              </button>
            </div>
            <div className={`p-6 rounded-3xl border ${theme.card}`}>
              <h4 className={`text-xs font-bold mb-3 ${theme.heading}`}>คำขอยาของฉัน</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {myRequests.filter(r => r.type === 'medicine').length === 0 && <p className={`text-xs text-center py-4 ${theme.subText}`}>ยังไม่มีคำขอ</p>}
                {myRequests.filter(r => r.type === 'medicine').map(r => <RequestRow key={r.id} r={r} theme={theme} />)}
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
                <h3 className={`font-bold text-base ${theme.heading}`}>บันทึกประวัติการแพ้ยาของฉัน</h3>
                <p className={`text-xs mt-0.5 ${theme.subText}`}>เจ้าหน้าที่จะยืนยันข้อมูลก่อนใช้ตรวจสอบความปลอดภัยตอนจ่ายยา</p>
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
              className="space-y-3 text-xs"
            >
              <div>
                <label className="font-semibold">ชื่อยาที่แพ้ *</label>
                <input required value={form.drugName} onChange={e => setForm({ ...form, drugName: e.target.value })}
                  placeholder="เช่น อะม็อกซีซิลลิน, ไอบูโพรเฟน" className={`mt-1 w-full p-2.5 rounded-xl border ${theme.inputBg}`} />
              </div>
              <div>
                <label className="font-semibold">กลุ่มยา (ถ้าทราบ)</label>
                <select value={form.drugFamily} onChange={e => setForm({ ...form, drugFamily: e.target.value })} className={`mt-1 w-full p-2.5 rounded-xl border ${theme.inputBg}`}>
                  {DRUG_FAMILY_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="font-semibold">อาการที่เกิดเมื่อแพ้</label>
                <input value={form.reaction} onChange={e => setForm({ ...form, reaction: e.target.value })}
                  placeholder="เช่น ผื่นคัน ลมพิษ แน่นหน้าอก" className={`mt-1 w-full p-2.5 rounded-xl border ${theme.inputBg}`} />
              </div>
              <div>
                <label className="font-semibold">ระดับความรุนแรง</label>
                <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className={`mt-1 w-full p-2.5 rounded-xl border ${theme.inputBg}`}>
                  {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <button className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold">บันทึกประวัติแพ้ยา</button>
            </form>
          </div>
          <div className={`p-6 rounded-3xl border ${theme.card}`}>
            <h4 className={`text-xs font-bold mb-3 ${theme.heading}`}>รายการแพ้ยาของฉัน</h4>
            <div className="space-y-2">
              {myAllergyReqs.length === 0 && <p className={`text-xs text-center py-6 ${theme.subText}`}>ยังไม่มีประวัติการแพ้ยา</p>}
              {myAllergyReqs.map(r => (
                <div key={r.id} className={`p-3 rounded-2xl border text-xs flex justify-between items-start gap-2 ${theme.cardInner}`}>
                  <div>
                    <p className="font-bold text-rose-600">⚠️ {r.payload.drugName} <span className={theme.subText}>({r.payload.drugFamily})</span></p>
                    <p className={`mt-0.5 ${theme.subText}`}>{r.payload.reaction || '-'} • {r.payload.severity}</p>
                  </div>
                  {r.status === REQ_STATUS.APPROVED ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold text-[11px] whitespace-nowrap"><CheckCircle2 size={13} /> ยืนยันแล้ว</span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-600 font-semibold text-[11px] whitespace-nowrap"><Clock size={13} /> รอยืนยัน</span>
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
