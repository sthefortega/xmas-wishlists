// Utilidades de interfaz. Todo el contenido de usuarios se inserta con textContent
// (nunca innerHTML), así que no puede inyectar HTML ni scripts.

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid.nodeType ? kid : document.createTextNode(kid));
  }
  return el;
}

const parseDate = (s) => new Date(`${s}T00:00:00`);
const longFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', year: 'numeric' });
const shortFmt = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short' });

export const longDate = (s) => longFmt.format(parseDate(s));
export const shortDate = (s) => shortFmt.format(parseDate(s)).replace('.', '');

export function countdown(s) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((parseDate(s) - today) / 86400000);
  if (days > 1) return `faltan ${days} días`;
  if (days === 1) return 'es mañana';
  if (days === 0) return 'es hoy';
  return 'ya pasó';
}

// Las listas ya no piden título; este es el valor interno que se guarda.
export const DEFAULT_TITLE = 'Lista de Navidad';

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

const MESSAGES = {
  contrasena_incorrecta: 'La contraseña no es correcta.',
  demasiados_intentos: 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.',
  sin_permiso: 'No tienes permiso para modificar esta lista.',
  sin_regalos: 'Agrega al menos un regalo con nombre.',
  regalos_invalidos: 'Hay un problema con los regalos de la lista.',
  sin_conexion: 'No hay conexión. Revisa tu internet e inténtalo otra vez.',
};

export const errorText = (code) => MESSAGES[code] || 'Algo salió mal. Inténtalo de nuevo.';
export const errorMessage = (e) => errorText(e && e.message);

let toastTimer;
export function toast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status' });
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 2200);
}

export async function copyText(text, done = 'Enlace copiado') {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = h('textarea', { style: 'position:fixed;opacity:0' }, text);
    document.body.append(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  }
  toast(done);
}

// Tienda de un enlace: 'Amazon', 'Mercado Libre' o null.
export function storeOf(value) {
  let v = String(value || '').trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  let host;
  try {
    host = new URL(v).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (/(^|\.)amazon\.[a-z.]+$/.test(host) || ['amzn.to', 'amzn.com', 'a.co'].includes(host)) return 'Amazon';
  if (/(^|\.)mercadoli(b|v)re\./.test(host) || host === 'meli.la') return 'Mercado Libre';
  return null;
}

export const amazonSearchUrl = (q) => `https://www.amazon.com.mx/s?k=${encodeURIComponent(q)}`;
export const mercadoLibreSearchUrl = (q) => `https://www.mercadolibre.com.mx/jm/search?as_word=${encodeURIComponent(q)}`;

export const pageUrl = (page, query = '') => new URL(`${page}${query}`, location.href).href;
