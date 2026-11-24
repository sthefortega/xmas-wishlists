import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const BASE = `${SUPABASE_URL}/rest/v1`;
const HEADERS = { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' };

async function call(url, init = {}) {
  let res;
  try {
    res = await fetch(url, { ...init, headers: { ...HEADERS, ...init.headers } });
  } catch {
    throw new Error('sin_conexion');
  }
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* respuesta sin JSON */
  }
  if (!res.ok) throw new Error((data && data.message) || 'error');
  return data;
}

export const isUuid = (s) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');

export function fetchLists() {
  return call(
    `${BASE}/lists?select=id,owner_name,title,event_date,created_at,items(count)&order=created_at.desc&limit=500`
  );
}

export async function fetchList(id) {
  const rows = await call(`${BASE}/lists?select=*,items(*)&id=eq.${id}&items.order=position.asc`);
  return rows[0] || null;
}

export function rpc(name, args) {
  return call(`${BASE}/rpc/${name}`, { method: 'POST', body: JSON.stringify(args) });
}
