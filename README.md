# UniCare — VS Code

## วิธีเปิดโปรเจกต์
1. แตก ZIP แล้วเปิดโฟลเดอร์ `unicare-vscode` ด้วย VS Code
2. ติดตั้ง Node.js รุ่น LTS หากยังไม่มี: https://nodejs.org/
3. เปิด Terminal ใน VS Code แล้วรัน `npm install`
4. รัน `npm run dev`
5. เปิด URL ที่ Terminal แสดง (ปกติคือ http://localhost:5173)

## โครงสร้าง
- `src/App.tsx` — หน้าจอและการทำงานหลักของแอป
- `src/data.ts` — ข้อมูลตัวอย่างนักศึกษา ยา ผู้รับบริการ อาการ และเตียง
- `src/main.tsx` — จุดเริ่มต้น React
- `src/index.css` — Tailwind CSS
- `tailwind.config.js`, `postcss.config.js` — ตั้งค่า Tailwind

## หมายเหตุ
ข้อมูลในชุดนี้เป็นข้อมูลตัวอย่างและทำงานในหน่วยความจำของหน้าเว็บ ยังไม่ได้เชื่อมฐานข้อมูลหรือ Google Sheets จริง แม้หน้าจอจะแสดงสถานะ Sync ก็ตาม และผล AI คัดกรองเป็นตัวอย่างจำลอง ไม่ควรใช้แทนการประเมินของบุคลากรทางการแพทย์
