import { fetchList, rpc, isUuid } from './api.js';
import { saveToken, resolveEditToken, getCreatePw, setCreatePw, clearCreatePw } from './auth.js';
import { h, errorMessage, errorText, copyText, pageUrl, toast, DEFAULT_TITLE, storeOf, amazonSearchUrl, mercadoLibreSearchUrl } from './ui.js';
import { mountLayout } from './layout.js';

mountLayout();

const main = document.getElementById('main');
const params = new URLSearchParams(location.search);
const listId = params.get('id');

let uid = 0;
function field(label, input, extra = '') {
  const id = `f${++uid}`;
  input.id = id;
  return h('div', { class: `field ${extra}`.trim() }, h('label', { for: id }, label), input);
}

function showError(e) {
  main.replaceChildren(h('h1', {}, 'No se pudo cargar'), h('p', { class: 'form-error' }, errorMessage(e)), h('a', { class: 'btn btn--ghost', href: 'index.html' }, 'Volver al inicio'));
}

function notFound() {
  main.replaceChildren(h('h1', {}, 'No encontramos esa lista'), h('a', { class: 'btn', href: 'index.html' }, 'Ver todas las listas'));
}

// --- Paso 1: contraseña para crear -----------------------------------------

function renderGate() {
  document.title = 'Crear mi lista · Deseos de Navidad';
  const input = h('input', { type: 'password', autocomplete: 'off', required: true });
  const msg = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const button = h('button', { class: 'btn', type: 'submit' }, 'Continuar');
  const form = h(
    'form',
    {
      class: 'form form--narrow',
      onsubmit: async (e) => {
        e.preventDefault();
        msg.hidden = true;
        button.disabled = true;
        try {
          const r = await rpc('check_create_password', { p_password: input.value });
          if (r.ok) {
            setCreatePw(input.value);
            renderForm({ password: input.value });
            return;
          }
          msg.textContent = errorText(r.error);
        } catch (err) {
          msg.textContent = errorMessage(err);
        }
        msg.hidden = false;
        button.disabled = false;
      },
    },
    field('Contraseña para crear listas', input),
    h('p', { class: 'hint' }, 'Te la dio quien administra el sitio. Ver las listas no requiere contraseña.'),
    msg,
    h('div', { class: 'actions' }, button)
  );
  main.replaceChildren(h('h1', {}, 'Crear mi lista'), h('p', { class: 'lede' }, 'Primero necesitamos confirmar que tienes la contraseña.'), form);
  input.focus();
}

// --- Paso 2: formulario ----------------------------------------------------

function giftRow(g = {}) {
  const nameInput = h('input', { name: 'name', maxlength: 120, value: g.name || '', placeholder: 'Qué te gustaría recibir' });
  const urlInput = h('input', { name: 'url', value: g.url || '', placeholder: 'Pega aquí el enlace del producto', inputmode: 'url', autocapitalize: 'off' });
  const urlHint = h('p', { class: 'hint' });

  const stores = [
    [h('a', { class: 'store-link', target: '_blank', rel: 'noopener noreferrer', href: '#' }, 'Amazon México'), amazonSearchUrl],
    [h('a', { class: 'store-link', target: '_blank', rel: 'noopener noreferrer', href: '#' }, 'Mercado Libre'), mercadoLibreSearchUrl],
  ];

  const sync = () => {
    const q = nameInput.value.trim();
    for (const [a, build] of stores) {
      if (q) {
        a.href = build(q);
        a.removeAttribute('aria-disabled');
      } else {
        a.href = '#';
        a.setAttribute('aria-disabled', 'true');
      }
    }
    const store = storeOf(urlInput.value);
    urlHint.textContent = urlInput.value.trim() ? (store ? `Enlace de ${store}` : '') : 'Busca el producto en una tienda, copia su enlace y pégalo aquí.';
  };
  for (const [a] of stores) {
    a.addEventListener('click', (e) => {
      if (a.getAttribute('aria-disabled') === 'true') {
        e.preventDefault();
        toast('Escribe primero el nombre del regalo');
      }
    });
  }
  nameInput.addEventListener('input', sync);
  urlInput.addEventListener('input', sync);
  sync();

  const urlField = field('Enlace (opcional)', urlInput, 'span-2');
  urlField.append(urlHint);

  const row = h(
    'div',
    { class: 'gift gift--edit' },
    h('span', { class: 'gift__n', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'gift__fields' },
      field('Regalo', nameInput, 'span-2'),
      h('div', { class: 'gift__search span-2' }, h('span', {}, 'Buscar en:'), stores.map(([a]) => a)),
      urlField,
      field('Precio aproximado (opcional)', h('input', { name: 'price', maxlength: 30, value: g.price || '', placeholder: '$500' })),
      field('Nota (opcional)', h('input', { name: 'note', maxlength: 300, value: g.note || '', placeholder: 'Talla, color, modelo…' })),
      h('div', { class: 'gift__remove' }, h('button', { class: 'linklike linklike--danger', type: 'button', onclick: () => removeRow(row) }, 'Quitar este regalo'))
    )
  );
  return row;
}

let giftsBox;
function removeRow(row) {
  if (giftsBox.children.length === 1) {
    row.replaceWith(giftRow());
    return;
  }
  row.remove();
}

function cleanUrl(value) {
  let v = value.trim();
  if (!v) return '';
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    if (!u.hostname.includes('.')) return null;
    const store = storeOf(u.href);
    if (store === 'Amazon') {
      // Los enlaces de Amazon traen mucho rastreo: se deja solo el producto.
      const m = u.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
      if (m) return `${u.origin}/dp/${m[1]}`;
    }
    if (store === 'Mercado Libre') {
      u.hash = '';
      u.search = '';
    }
    return u.href;
  } catch {
    return null;
  }
}

function collect(form, errorBox, title) {
  const fail = (text) => {
    errorBox.textContent = text;
    errorBox.hidden = false;
    errorBox.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return null;
  };
  errorBox.hidden = true;
  const items = [];
  for (const row of giftsBox.children) {
    const get = (n) => row.querySelector(`[name="${n}"]`).value.trim();
    const name = get('name');
    if (!name) continue;
    const url = cleanUrl(get('url'));
    if (url === null) return fail(`El enlace de «${name}» no parece válido.`);
    if (url.length > 500) return fail(`El enlace de «${name}» es demasiado largo. Copia el enlace del producto sin parámetros extra.`);
    items.push({ name, url, price: get('price'), note: get('note'), priority: 2 });
  }
  if (!items.length) return fail('Agrega al menos un regalo con nombre.');
  return {
    p_owner: form.elements.owner.value.trim(),
    p_title: title,
    p_event_date: form.elements.event_date.value || null,
    p_note: form.elements.note.value.trim() || null,
    p_items: items,
  };
}

function renderForm({ list = null, token = null, password = null }) {
  const editing = Boolean(list);
  document.title = `${editing ? 'Editar lista' : 'Crear mi lista'} · Deseos de Navidad`;

  giftsBox = h('div', { class: 'gifts gifts--edit' });
  const startItems = editing ? list.items : [{}, {}, {}];
  startItems.forEach((g) => giftsBox.append(giftRow(g)));

  const errorBox = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const submit = h('button', { class: 'btn', type: 'submit' }, editing ? 'Guardar cambios' : 'Publicar lista');

  const form = h(
    'form',
    {
      class: 'form',
      novalidate: false,
      onsubmit: async (e) => {
        e.preventDefault();
        const data = collect(form, errorBox, editing ? list.title : DEFAULT_TITLE);
        if (!data) return;
        submit.disabled = true;
        try {
          if (editing) {
            const r = await rpc('update_list', { p_list_id: list.id, p_token: token, ...data });
            if (!r.ok) throw new Error(r.error);
            location.href = `lista.html?id=${list.id}`;
          } else {
            const r = await rpc('create_list', { p_password: password, ...data });
            if (!r.ok) {
              if (r.error === 'contrasena_incorrecta') clearCreatePw();
              throw new Error(r.error);
            }
            saveToken(r.id, r.token);
            renderSuccess(r.id, r.token);
          }
        } catch (err) {
          errorBox.textContent = errorMessage(err);
          errorBox.hidden = false;
          submit.disabled = false;
        }
      },
    },
    h(
      'section',
      { class: 'form__block' },
      field('Tu nombre', h('input', { name: 'owner', required: true, maxlength: 60, value: editing ? list.owner_name : '', autocomplete: 'given-name' })),
      field('Fecha del evento (opcional)', h('input', { name: 'event_date', type: 'date', value: editing && list.event_date ? list.event_date : '2026-12-25' })),
      field('Mensaje (opcional)', h('textarea', { name: 'note', rows: 3, maxlength: 500, placeholder: 'Algo que quieras que sepan antes de elegir' }, editing && list.note ? list.note : ''))
    ),
    h('section', { class: 'form__block' }, h('h2', {}, 'Tus regalos'), giftsBox, h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => giftsBox.append(giftRow()) }, 'Agregar otro regalo')),
    errorBox,
    h('div', { class: 'actions' }, submit, h('a', { class: 'btn btn--ghost', href: editing ? `lista.html?id=${list.id}` : 'index.html' }, 'Cancelar'))
  );

  main.replaceChildren(h('h1', {}, editing ? 'Editar lista' : 'Crear mi lista'), form);
}

// --- Paso 3: lista publicada -----------------------------------------------

function linkBlock(label, hint, url) {
  const input = h('input', { type: 'text', readonly: true, value: url, 'aria-label': label });
  input.addEventListener('focus', () => input.select());
  return h(
    'div',
    { class: 'linkblock' },
    h('p', { class: 'linkblock__label' }, label),
    h('p', { class: 'hint' }, hint),
    h('div', { class: 'linkblock__row' }, input, h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => copyText(url) }, 'Copiar'))
  );
}

function renderSuccess(id, token) {
  document.title = 'Lista publicada · Deseos de Navidad';
  history.replaceState(null, '', pageUrl('crear.html'));
  main.replaceChildren(
    h('h1', {}, 'Tu lista ya está publicada'),
    h('p', { class: 'lede' }, 'Aparece en la página principal. Comparte el primer enlace con quien quieras.'),
    linkBlock('Enlace para compartir', 'Cualquiera con este enlace puede ver tu lista.', pageUrl('lista.html', `?id=${id}`)),
    linkBlock('Enlace para editar', 'Guárdalo. Solo con él puedes cambiar o borrar tu lista desde otro dispositivo. No lo compartas.', pageUrl('lista.html', `?id=${id}&k=${token}`)),
    h('div', { class: 'actions' }, h('a', { class: 'btn', href: `lista.html?id=${id}` }, 'Ver mi lista'), h('a', { class: 'btn btn--ghost', href: 'index.html' }, 'Ir al inicio'))
  );
  toast('Lista publicada');
}

// --- Arranque --------------------------------------------------------------

async function initEdit() {
  if (!isUuid(listId)) return notFound();
  const k = params.get('k');
  if (k) {
    saveToken(listId, k);
    history.replaceState(null, '', pageUrl('crear.html', `?id=${listId}`));
  }
  const list = await fetchList(listId);
  if (!list) return notFound();
  const token = await resolveEditToken(listId);
  if (!token) {
    main.replaceChildren(
      h('h1', {}, 'No puedes editar esta lista'),
      h('p', { class: 'lede' }, 'Solo quien la creó puede cambiarla, usando su enlace de edición. Si lo perdiste, pide ayuda a quien administra el sitio.'),
      h('a', { class: 'btn', href: `lista.html?id=${listId}` }, 'Ver la lista')
    );
    return;
  }
  renderForm({ list, token });
}

async function initNew() {
  const pw = getCreatePw();
  if (pw) {
    const r = await rpc('check_create_password', { p_password: pw });
    if (r.ok) return renderForm({ password: pw });
    clearCreatePw();
  }
  renderGate();
}

(async () => {
  main.replaceChildren(h('p', { class: 'status' }, 'Cargando…'));
  try {
    if (listId) await initEdit();
    else await initNew();
  } catch (e) {
    showError(e);
  }
})();
