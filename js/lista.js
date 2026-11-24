import { fetchList, rpc, isUuid } from './api.js';
import { resolveEditToken, saveToken } from './auth.js';
import { h, longDate, countdown, errorMessage, copyText, pageUrl, toast } from './ui.js';
import { mountLayout } from './layout.js';

mountLayout();

const main = document.getElementById('main');
const params = new URLSearchParams(location.search);
const id = params.get('id');

const PRIORITY = {
  1: { label: 'Me haría mucha ilusión', strong: true },
  2: { label: 'Me gustaría', strong: false },
  3: { label: 'Si se puede', strong: false },
};

const back = () => h('a', { class: 'back', href: 'index.html' }, '← Todas las listas');

function notFound() {
  document.title = 'Lista no encontrada · Deseos de Navidad';
  main.replaceChildren(
    back(),
    h('h1', {}, 'No encontramos esa lista'),
    h('p', { class: 'lede' }, 'Puede que el enlace esté incompleto o que la lista ya se haya eliminado.'),
    h('a', { class: 'btn', href: 'index.html' }, 'Ver todas las listas')
  );
}

function gift(item) {
  const p = PRIORITY[item.priority] || PRIORITY[2];
  let link = null;
  if (item.url) {
    link = h('a', { class: 'gift__link', href: item.url, target: '_blank', rel: 'noopener noreferrer nofollow' }, 'Ver enlace');
  }
  return h(
    'li',
    { class: 'gift' },
    h('span', { class: 'gift__n', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'gift__body' },
      h('p', { class: 'gift__name' }, item.name),
      item.note ? h('p', { class: 'gift__note' }, item.note) : null,
      h('p', { class: 'gift__tags' }, h('span', { class: p.strong ? 'prio prio--high' : 'prio' }, p.label), link ? ' · ' : null, link)
    ),
    item.price ? h('span', { class: 'gift__price' }, item.price) : null
  );
}

function render(list, token) {
  document.title = `${list.owner_name} · Deseos de Navidad`;
  const when = list.event_date ? `${longDate(list.event_date)} · ${countdown(list.event_date)}` : null;

  const actions = [
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => copyText(location.href) }, 'Copiar enlace'),
  ];
  if (token) {
    actions.push(
      h('a', { class: 'btn btn--ghost', href: `crear.html?id=${list.id}` }, 'Editar'),
      h(
        'button',
        {
          class: 'btn btn--danger',
          type: 'button',
          onclick: async () => {
            if (!confirm(`¿Eliminar la lista de ${list.owner_name}? No se puede deshacer.`)) return;
            try {
              const r = await rpc('delete_list', { p_list_id: list.id, p_token: token });
              if (!r.ok) throw new Error(r.error);
              location.href = 'index.html';
            } catch (e) {
              toast(errorMessage(e));
            }
          },
        },
        'Eliminar'
      )
    );
  }

  main.replaceChildren(
    ...[
      back(),
      h('header', { class: 'list-head' }, h('h1', {}, list.owner_name), h('p', { class: 'list-head__title' }, list.title), when ? h('p', { class: 'muted' }, when) : null),
      list.note ? h('blockquote', { class: 'note' }, list.note) : null,
      h('div', { class: 'actions' }, actions),
      h('ol', { class: 'gifts' }, (list.items || []).map(gift)),
    ].filter(Boolean)
  );
}

async function init() {
  if (!isUuid(id)) return notFound();
  main.replaceChildren(h('p', { class: 'status' }, 'Cargando lista…'));
  try {
    const k = params.get('k');
    if (k) {
      saveToken(id, k);
      history.replaceState(null, '', pageUrl('lista.html', `?id=${id}`));
    }
    const list = await fetchList(id);
    if (!list) return notFound();
    render(list, null);
    const token = await resolveEditToken(id);
    if (token) render(list, token);
  } catch (e) {
    main.replaceChildren(back(), h('p', { class: 'form-error' }, errorMessage(e)));
  }
}

init();
