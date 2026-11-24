import { rpc } from './api.js';

// No hay cuentas. Cada lista tiene un código secreto que se guarda en este navegador
// (localStorage). La contraseña de creación y la de administración solo viven
// mientras la pestaña está abierta (sessionStorage).

const store = (area) => ({
  get(key) {
    try {
      return window[area].getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window[area].setItem(key, value);
    } catch {
      /* almacenamiento bloqueado */
    }
  },
  del(key) {
    try {
      window[area].removeItem(key);
    } catch {
      /* almacenamiento bloqueado */
    }
  },
});

const local = store('localStorage');
const session = store('sessionStorage');

export const saveToken = (listId, token) => local.set(`xw:k:${listId}`, token);
export const getToken = (listId) => local.get(`xw:k:${listId}`);

export const getAdmin = () => session.get('xw:admin');
export const setAdmin = (pw) => session.set('xw:admin', pw);
export const clearAdmin = () => session.del('xw:admin');

export const getCreatePw = () => session.get('xw:cp');
export const setCreatePw = (pw) => session.set('xw:cp', pw);
export const clearCreatePw = () => session.del('xw:cp');

// Devuelve el primer código que el servidor acepte para editar la lista, o null.
export async function resolveEditToken(listId) {
  const candidates = [getToken(listId), getAdmin()].filter(Boolean);
  for (const token of candidates) {
    try {
      const r = await rpc('verify_edit', { p_list_id: listId, p_token: token });
      if (r && r.ok) return token;
    } catch {
      /* sigue con el siguiente */
    }
  }
  return null;
}
