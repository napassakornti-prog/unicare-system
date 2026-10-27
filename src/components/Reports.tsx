import React from 'react';
import { BarChart3, Download, Printer, Sparkles } from 'lucide-react';
import { computeStats, answerQuestion } from '../ai';

function BarList({ title, rows, color, theme }: { title: string; rows: [string, number][]; color: string; theme: any }) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return (
    <div className={`p-5 rounded-2xl border ${theme.card}`}>
      <h4 className={`font-bold text-sm mb-4 ${theme.heading}`}>{title}</h4>
      {rows.length === 0 && <p className={`text-xs ${theme.subText}`}>ยังไม่มีข้อมูล</p>}
      <div className="space-y-2.5">
        {rows.map(([label, value]) => (
          <div key={label} className="text-xs">
            <div className="flex justify-between mb-1">
              <span className="font-medium truncate pr-2">{label}</span>
              <span className="font-mono font-bold">{value}</span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${(value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HourChart({ rows, theme }: { rows: [string, number][]; theme: any }) {
  const max = Math.max(1, ...rows.map(r => r[1]));
  return (
    <div className={`p-5 rounded-2xl border ${theme.card}`}>
      <h4 className={`font-bold text-sm mb-4 ${theme.heading}`}>ช่วงเวลาที่มีผู้ใช้บริการ</h4>
      <div className="flex items-end gap-3 h-40">
        {rows.map(([hour, v]) => (
          <div key={hour} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <span className="text-[10px] font-bold">{v}</span>
            <div className="w-full rounded-t-lg bg-gradient-to-t from-teal-600 to-emerald-400" style={{ height: `${(v / max) * 100}%` }} />
            <span className={`text-[10px] font-mono ${theme.subText}`}>{hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Reports({ data, theme, addToast }: { data: any; theme: any; addToast: Function }) {
  const { visits, students } = data;
  const stats = computeStats(visits, students);
  const triageColor: Record<string, string> = { 'ฉุกเฉิน': 'bg-rose-500', 'ด่วน': 'bg-amber-500', 'ปกติ': 'bg-emerald-500' };

  const exportCsv = () => {
    // ส่งออกแบบไม่ระบุชื่อ (ใช้รหัสอ้างอิงการรับบริการแทน) เพื่อนำไปทำสถิติ
    const header = ['รหัสการรับบริการ', 'เวลา', 'คณะ', 'อาการ', 'ระดับความเร่งด่วน', 'การวินิจฉัย', 'ยาที่จ่าย', 'สถานะ'];
    const rows = visits.map((v: any) => [v.id, v.time, v.faculty, v.symptom, v.triage, v.diagnosis, (v.meds || []).join(' | '), v.status]);
    const csv = [header, ...rows].map(r => r.map((c: any) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unicare-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast('ส่งออกรายงานสำเร็จ', `ดาวน์โหลดไฟล์ CSV (${visits.length} รายการ, ไม่ระบุชื่อ) เปิดด้วย Excel ได้ทันที`);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className={`p-6 rounded-2xl border ${theme.card} flex flex-col md:flex-row md:items-center justify-between gap-4`}>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400"><BarChart3 size={22} /></div>
          <div>
            <h3 className={`font-bold text-lg ${theme.heading}`}>รายงาน & สถิติห้องพยาบาล</h3>
            <p className={`text-xs ${theme.subText}`}>คำนวณจากข้อมูลการเข้ารับบริการจริงในระบบ (อัปเดตทันทีเมื่อมีการบันทึก)</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="px-4 py-2 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-md flex items-center gap-1.5">
            <Download size={14} /> ส่งออก Excel (CSV)
          </button>
          <button onClick={() => window.print()} className="px-4 py-2 rounded-xl border border-teal-500/30 text-teal-700 dark:text-teal-300 font-bold text-xs hover:bg-teal-500/10 flex items-center gap-1.5">
            <Printer size={14} /> พิมพ์ / PDF
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'ผู้รับบริการทั้งหมด', value: stats.total },
          { label: 'กรณีฉุกเฉิน', value: visits.filter((v: any) => v.triage === 'ฉุกเฉิน').length },
          { label: 'ส่งต่อโรงพยาบาล', value: visits.filter((v: any) => v.status.includes('ส่งตัว')).length },
          { label: 'จำนวนการจ่ายยา', value: visits.reduce((s: number, v: any) => s + (v.meds?.length || 0), 0) },
        ].map(k => (
          <div key={k.label} className={`p-4 rounded-2xl border ${theme.card}`}>
            <p className={`text-[11px] font-semibold ${theme.subText}`}>{k.label}</p>
            <p className={`text-2xl font-black mt-1 ${theme.heading}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* AI Summary */}
      <div className="p-5 rounded-2xl bg-teal-500/10 border border-teal-500/30">
        <p className="text-xs font-bold text-teal-700 dark:text-teal-300 flex items-center gap-2 mb-2"><Sparkles size={14} /> AI สรุปภาพรวมอัตโนมัติ</p>
        <p className="text-xs whitespace-pre-line leading-relaxed">{answerQuestion('สรุปสถิติวันนี้', data)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <BarList title="กลุ่มอาการที่พบบ่อย (จากรายการอาการมาตรฐาน)" rows={stats.symptomCounts.slice(0, 8) as any} color="bg-teal-500" theme={theme} />
        <BarList title="ผู้ใช้บริการแยกตามคณะ" rows={stats.facultyCounts as any} color="bg-indigo-500" theme={theme} />
        <HourChart rows={stats.hourCounts as any} theme={theme} />
        <div className={`p-5 rounded-2xl border ${theme.card}`}>
          <h4 className={`font-bold text-sm mb-4 ${theme.heading}`}>ระดับความเร่งด่วน (Triage)</h4>
          <div className="flex h-6 rounded-full overflow-hidden mb-4">
            {stats.triageCounts.map(([k, v]) => (
              <div key={k} className={triageColor[k] || 'bg-slate-400'} style={{ width: `${(v / Math.max(1, stats.total)) * 100}%` }} title={`${k}: ${v}`} />
            ))}
          </div>
          <div className="space-y-1.5 text-xs">
            {stats.triageCounts.map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="flex items-center gap-2"><span className={`w-3 h-3 rounded ${triageColor[k] || 'bg-slate-400'}`} />{k}</span>
                <span className="font-mono font-bold">{v} ({Math.round((v / Math.max(1, stats.total)) * 100)}%)</span>
              </div>
            ))}
          </div>
        </div>
        <BarList title="ยาที่จ่ายบ่อย" rows={stats.medCounts.slice(0, 6) as any} color="bg-amber-500" theme={theme} />
        <BarList title="สารที่นักศึกษาแพ้ (ข้อมูลรวม)" rows={stats.allergenCounts.slice(0, 6) as any} color="bg-rose-500" theme={theme} />
      </div>
    </div>
  );
}
