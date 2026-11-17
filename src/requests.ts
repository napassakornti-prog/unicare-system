import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './supabase';

export type ReqType = 'bed' | 'medicine' | 'allergy' | 'emergency';

export interface Req {
  id: string;
  type: ReqType;
  status: string; // รอดำเนินการ | อนุมัติ | ปฏิเสธ | รับทราบ | เสร็จสิ้น
  email: string;
  name: string;
  role: string;
  payload: any;
  adminNote: string;
  createdAt: string;
  updatedAt: string;
}

export const REQ_STATUS = {
  PENDING: 'รอดำเนินการ',
  APPROVED: 'อนุมัติ',
  REJECTED: 'ปฏิเสธ',
  ACK: 'รับทราบ',
  DONE: 'เสร็จสิ้น',
};

const LS_KEY = 'unicare_requests_v1';

const readLocal = (): Req[] => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
};
const writeLocal = (list: Req[]) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)); } catch {}
};

const toRow = (r: Req) => ({
  id: r.id, type: r.type, status: r.status,
  requester_email: r.email, requester_name: r.name, requester_role: r.role,
  payload: r.payload, admin_note: r.adminNote, created_at: r.createdAt, updated_at: r.updatedAt,
});

const fromRow = (x: any): Req => ({
  id: x.id, type: x.type, status: x.status || REQ_STATUS.PENDING,
  email: x.requester_email || '', name: x.requester_name || '', role: x.requester_role || '',
  payload: x.payload || {}, adminNote: x.admin_note || '',
  createdAt: x.created_at, updatedAt: x.updated_at || x.created_at,
});

const sortDesc = (a: Req, b: Req) => (a.createdAt < b.createdAt ? 1 : -1);

export async function listRequests(): Promise<Req[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb.from('requests').select('*').order('created_at', { ascending: false }).limit(500);
      if (!error && data) return data.map(fromRow);
    } catch {}
  }
  return readLocal().sort(sortDesc);
}

export async function createRequest(input: { type: ReqType; email: string; name: string; role: string; payload: any }): Promise<Req> {
  const now = new Date().toISOString();
  const req: Req = {
    id: 'REQ-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
    type: input.type, status: REQ_STATUS.PENDING,
    email: input.email, name: input.name, role: input.role,
    payload: input.payload, adminNote: '', createdAt: now, updatedAt: now,
  };
  const sb = getSupabase();
  if (sb) {
    try {
      const { error } = await sb.from('requests').insert(toRow(req));
      if (!error) return req;
    } catch {}
  }
  writeLocal([req, ...readLocal()]);
  return req;
}

export async function updateRequest(id: string, patch: Partial<Pick<Req, 'status' | 'adminNote' | 'payload'>>): Promise<void> {
  const updatedAt = new Date().toISOString();
  const sb = getSupabase();
  if (sb) {
    try {
      const row: any = { updated_at: updatedAt };
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.adminNote !== undefined) row.admin_note = patch.adminNote;
      if (patch.payload !== undefined) row.payload = patch.payload;
      const { error } = await sb.from('requests').update(row).eq('id', id);
      if (!error) return;
    } catch {}
  }
  writeLocal(readLocal().map(r => (r.id === id ? { ...r, ...patch, updatedAt } : r)));
}

// โหลดคำขอแบบอัปเดตอัตโนมัติ (ดึงซ้ำทุก intervalMs มิลลิวินาที)
export function useRequests(enabled: boolean, intervalMs = 5000) {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loaded, setLoaded] = useState(false);
  const refresh = useCallback(async () => {
    const list = await listRequests();
    setRequests(list);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!enabled) return;
    refresh();
    const t = setInterval(refresh, intervalMs);
    const onStorage = (e: StorageEvent) => { if (e.key === LS_KEY) refresh(); };
    window.addEventListener('storage', onStorage);
    return () => { clearInterval(t); window.removeEventListener('storage', onStorage); };
  }, [enabled, intervalMs, refresh]);
  return { requests, loaded, refresh };
}
