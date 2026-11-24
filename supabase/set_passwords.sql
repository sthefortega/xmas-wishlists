-- Define las dos contraseñas del sitio.
--
-- 1. Copia este contenido en Supabase > SQL Editor.
-- 2. Cambia los dos textos entre comillas por tus contraseñas.
-- 3. Presiona Run. No guardes esta consulta con tus contraseñas reales
--    ni subas a GitHub una versión modificada de este archivo.
--
-- Se guardan cifradas (bcrypt). Para cambiarlas después, vuelve a ejecutarlo.
--
--   contraseña de creación: la que compartes con quienes pueden crear listas.
--   contraseña de administración: solo para ti; permite editar o borrar cualquier lista.

insert into public.settings (key, value) values
  ('create_password_hash', extensions.crypt('CAMBIA-LA-CONTRASENA-DE-CREACION', extensions.gen_salt('bf'))),
  ('admin_password_hash',  extensions.crypt('CAMBIA-LA-CONTRASENA-DE-ADMIN',    extensions.gen_salt('bf')))
on conflict (key) do update set value = excluded.value;
