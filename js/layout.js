import { h, errorText } from './ui.js';
import { rpc } from './api.js';
import { getAdmin, setAdmin, clearAdmin } from './auth.js';

export function mountLayout() {
  const header = document.getElementById('site-header');
  header.className = 'site-header';
  header.append(
    h(
      'div',
      { class: 'wrap site-header__in' },
      h('a', { class: 'brand', href: 'index.html' }, h('span', { class: 'brand__mark', 'aria-hidden': 'true' }), 'Deseos de Navidad'),
      h('a', { class: 'btn btn--small', href: 'crear.html' }, 'Crear mi lista')
    )
  );

  const footer = document.getElementById('site-footer');
  footer.className = 'site-footer';
  const admin = getAdmin();
  footer.append(
    h(
      'div',
      { class: 'wrap site-footer__in' },
      h('p', {}, 'Listas de regalos para compartir en familia. Sin cuentas, sin anuncios.'),
      h(
        'p',
        { class: 'site-footer__links' },
        h('a', { href: 'privacidad.html' }, 'Privacidad'),
        ' · ',
        admin
          ? h('button', { class: 'linklike', type: 'button', onclick: () => { clearAdmin(); location.reload(); } }, 'Salir del modo administración')
          : h('button', { class: 'linklike', type: 'button', onclick: openAdminDialog }, 'Administrar')
      )
    )
  );
}

function openAdminDialog() {
  const input = h('input', { id: 'admin-pw', type: 'password', autocomplete: 'current-password', required: true });
  const msg = h('p', { class: 'form-error', role: 'alert', hidden: true });
  const form = h(
    'form',
    {
      class: 'dlg__form',
      onsubmit: async (e) => {
        e.preventDefault();
        msg.hidden = true;
        try {
          const r = await rpc('verify_admin', { p_password: input.value });
          if (r.ok) {
            setAdmin(input.value);
            location.reload();
            return;
          }
          msg.textContent = errorText(r.error);
        } catch (err) {
          msg.textContent = errorText(err.message);
        }
        msg.hidden = false;
      },
    },
    h('h2', { class: 'dlg__title' }, 'Modo administración'),
    h('p', { class: 'muted' }, 'Con esta contraseña puedes editar o borrar cualquier lista.'),
    h('div', { class: 'field' }, h('label', { for: 'admin-pw' }, 'Contraseña de administración'), input),
    msg,
    h(
      'div',
      { class: 'actions' },
      h('button', { class: 'btn', type: 'submit' }, 'Entrar'),
      h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => dlg.close() }, 'Cancelar')
    )
  );
  const dlg = h('dialog', { class: 'dlg', onclose: () => dlg.remove() }, form);
  document.body.append(dlg);
  dlg.showModal();
  input.focus();
}
