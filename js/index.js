import { fetchLists } from './api.js';
import { h, shortDate, plural, errorMessage, DEFAULT_TITLE } from './ui.js';
import { mountLayout } from './layout.js';

mountLayout();

const box = document.getElementById('lists');
const search = document.getElementById('q');
let all = [];

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function row(list) {
  const count = list.items && list.items[0] ? list.items[0].count : 0;
  const meta = [plural(count, 'regalo', 'regalos')];
  if (list.event_date) meta.push(shortDate(list.event_date));
  return h(
    'a',
    { class: 'row', href: `lista.html?id=${list.id}` },
    h('span', { class: 'row__main' }, h('span', { class: 'row__name' }, list.owner_name), list.title !== DEFAULT_TITLE ? h('span', { class: 'row__title' }, list.title) : null),
    h('span', { class: 'row__meta' }, meta.join(' · '))
  );
}

function render() {
  const q = norm(search.value.trim());
  const shown = q ? all.filter((l) => norm(`${l.owner_name} ${l.title}`).includes(q)) : all;

  if (!all.length) {
    box.replaceChildren(
      h(
        'div',
        { class: 'empty' },
        h('p', { class: 'empty__title' }, 'Todavía no hay listas.'),
        h('p', { class: 'muted' }, 'Cuando alguien publique la suya, aparecerá aquí.'),
        h('a', { class: 'btn', href: 'crear.html' }, 'Crear la primera lista')
      )
    );
    return;
  }
  if (!shown.length) {
    box.replaceChildren(h('p', { class: 'status' }, 'Ninguna lista coincide con tu búsqueda.'));
    return;
  }
  box.replaceChildren(h('p', { class: 'count' }, plural(shown.length, 'lista publicada', 'listas publicadas')), ...shown.map(row));
}

async function load() {
  box.replaceChildren(h('p', { class: 'status' }, 'Cargando listas…'));
  try {
    all = await fetchLists();
    render();
  } catch (e) {
    box.replaceChildren(
      h(
        'div',
        { class: 'empty' },
        h('p', { class: 'form-error' }, errorMessage(e)),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: load }, 'Reintentar')
      )
    );
  }
}

search.addEventListener('input', render);
load();
