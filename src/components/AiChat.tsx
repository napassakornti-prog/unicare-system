import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, Sparkles, ShieldCheck, User } from 'lucide-react';
import { answerQuestion, SUGGESTED_QUESTIONS } from '../ai';

type Msg = { role: 'ai' | 'user'; text: string };

export default function AiChat({ data, theme, darkMode }: { data: any; theme: any; darkMode: boolean }) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'ai',
      text: 'สวัสดีครับ ผมคือ UniCare AI Assistant 🤖\nช่วยสรุปสถิติ ตอบคำถามเกี่ยวกับข้อมูลห้องพยาบาล และเตือนสต็อกยา\n\n🔒 ประมวลผลภายในระบบ ไม่ส่งข้อมูลระบุตัวตนผู้ป่วยออกภายนอก (PDPA)',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // แจ้งเตือนสต็อกอัตโนมัติเมื่อเปิดหน้าแชท
  const alerted = useRef(false);
  useEffect(() => {
    if (alerted.current) return;
    alerted.current = true;
    const low = data.medicines.filter((m: any) => m.stock <= m.min);
    if (low.length) {
      setMessages(prev => [...prev, { role: 'ai', text: answerQuestion('ยาใกล้หมด', data) }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || typing) return;
    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');
    setTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { role: 'ai', text: answerQuestion(q, data) }]);
      setTyping(false);
    }, 500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className={`p-6 rounded-2xl border ${theme.card} flex flex-col h-[640px]`}>
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Bot size={22} />
            </div>
            <div>
              <h3 className={`font-bold text-base ${theme.heading}`}>UniCare AI Assistant (Secure & Local PII Shield)</h3>
              <p className={`text-xs ${theme.subText}`}>สรุปสถิติ • ตอบคำถามจากข้อมูลในระบบ • เตือนสต็อกยา</p>
            </div>
          </div>
          <span className="hidden md:flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold">
            <ShieldCheck size={12} /> Local processing
          </span>
        </div>

        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-2">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${m.role === 'ai' ? 'bg-teal-600 text-white' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200'}`}>
                {m.role === 'ai' ? <Sparkles size={16} /> : <User size={16} />}
              </div>
              <div
                className={`max-w-lg p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-line ${
                  m.role === 'user'
                    ? 'bg-teal-600 text-white'
                    : darkMode ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                <Sparkles size={16} />
              </div>
              <div className={`p-4 rounded-2xl text-xs ${darkMode ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>กำลังวิเคราะห์ข้อมูล...</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="flex flex-wrap gap-1.5 pb-3">
          {SUGGESTED_QUESTIONS.map(s => (
            <button
              key={s}
              onClick={() => send(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-teal-500/30 bg-teal-500/5 text-teal-700 dark:text-teal-300 hover:bg-teal-500/15"
            >
              {s}
            </button>
          ))}
        </div>

        <form
          onSubmit={e => { e.preventDefault(); send(input); }}
          className="pt-3 border-t border-slate-200 dark:border-slate-800 flex gap-3"
        >
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="พิมพ์คำถาม เช่น ยาอะไรใกล้หมด, สรุปสถิติวันนี้, มีไข้ควรจ่ายยาอะไร..."
            className={`flex-1 px-4 py-3 text-xs rounded-xl border focus:outline-none focus:border-teal-500 ${theme.inputBg}`}
          />
          <button type="submit" className="px-5 py-3 rounded-xl bg-teal-600 text-white font-bold text-xs hover:bg-teal-700 shadow-md flex items-center gap-2">
            <Send size={16} /> ส่ง
          </button>
        </form>
        <p className={`text-[10px] mt-2 ${theme.subText}`}>⚠️ คำตอบของ AI เป็นข้อเสนอแนะเพื่อประกอบการตัดสินใจ ผู้ตัดสินใจสูงสุดคือพยาบาล/เจ้าหน้าที่</p>
      </div>
    </div>
  );
}
