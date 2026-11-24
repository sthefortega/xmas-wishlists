-- Listas de deseos de Navidad: esquema de base de datos para Supabase.
-- Pégalo completo en Supabase > SQL Editor > New query y presiona Run.
-- Es seguro ejecutarlo más de una vez.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

-- Guarda los hashes de las contraseñas (nunca la contraseña en texto plano).
create table if not exists public.settings (
  key   text primary key,
  value text not null
);

-- Intentos fallidos de contraseña, para frenar adivinanzas por fuerza bruta.
create table if not exists public.attempts (
  id bigint generated always as identity primary key,
  at timestamptz not null default now()
);

create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  owner_name text not null check (char_length(owner_name) between 1 and 60),
  title      text not null check (char_length(title) between 1 and 100),
  event_date date,
  note       text check (note is null or char_length(note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Código secreto de cada lista (hash). Solo quien creó la lista conoce el original.
create table if not exists public.list_secrets (
  list_id    uuid primary key references public.lists(id) on delete cascade,
  token_hash text not null
);

create table if not exists public.items (
  id       uuid primary key default gen_random_uuid(),
  list_id  uuid not null references public.lists(id) on delete cascade,
  position int  not null default 0,
  name     text not null check (char_length(name) between 1 and 120),
  url      text check (url is null or (url ~* '^https?://' and char_length(url) <= 500)),
  price    text check (price is null or char_length(price) <= 30),
  note     text check (note is null or char_length(note) <= 300),
  priority smallint not null default 2 check (priority in (1, 2, 3))
);

create index if not exists items_list_position_idx on public.items (list_id, position);

-- ---------------------------------------------------------------------------
-- Seguridad a nivel de fila: el público solo puede LEER listas y regalos.
-- Todo lo que escribe pasa por las funciones de más abajo, que piden contraseña.
-- ---------------------------------------------------------------------------

alter table public.settings     enable row level security;
alter table public.attempts     enable row level security;
alter table public.list_secrets enable row level security;
alter table public.lists        enable row level security;
alter table public.items        enable row level security;

revoke all on public.settings, public.attempts, public.list_secrets from anon, authenticated;
revoke insert, update, delete, truncate on public.lists, public.items from anon, authenticated;

drop policy if exists "lectura publica" on public.lists;
create policy "lectura publica" on public.lists for select to anon, authenticated using (true);

drop policy if exists "lectura publica" on public.items;
create policy "lectura publica" on public.items for select to anon, authenticated using (true);

-- ---------------------------------------------------------------------------
-- Funciones internas (no se pueden llamar desde el sitio)
-- ---------------------------------------------------------------------------

create or replace function public._throttle() returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.attempts where at < now() - interval '1 hour';
  if (select count(*) from public.attempts where at > now() - interval '10 minutes') >= 30 then
    raise exception 'demasiados_intentos';
  end if;
end $$;

create or replace function public._is_create_pw(p text) returns boolean
language sql security definer set search_path = public, extensions as $$
  select coalesce((select value = crypt(p, value) from public.settings where key = 'create_password_hash'), false);
$$;

create or replace function public._is_admin_pw(p text) returns boolean
language sql security definer set search_path = public, extensions as $$
  select coalesce((select value = crypt(p, value) from public.settings where key = 'admin_password_hash'), false);
$$;

create or replace function public._can_edit(p_list_id uuid, p_token text) returns boolean
language sql security definer set search_path = public, extensions as $$
  select p_token is not null and (
    public._is_admin_pw(p_token)
    or exists (
      select 1 from public.list_secrets s
      where s.list_id = p_list_id and s.token_hash = crypt(p_token, s.token_hash)
    )
  );
$$;

create or replace function public._replace_items(p_list_id uuid, p_items jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from public.items where list_id = p_list_id;
  insert into public.items (list_id, position, name, url, price, note, priority)
  select p_list_id,
         t.ord::int,
         trim(t.e ->> 'name'),
         nullif(trim(coalesce(t.e ->> 'url', '')), ''),
         nullif(trim(coalesce(t.e ->> 'price', '')), ''),
         nullif(trim(coalesce(t.e ->> 'note', '')), ''),
         coalesce((t.e ->> 'priority')::smallint, 2)
  from jsonb_array_elements(p_items) with ordinality as t(e, ord)
  where trim(coalesce(t.e ->> 'name', '')) <> '';
end $$;

revoke execute on function
  public._throttle(), public._is_create_pw(text), public._is_admin_pw(text),
  public._can_edit(uuid, text), public._replace_items(uuid, jsonb)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funciones públicas (las que usa el sitio)
-- ---------------------------------------------------------------------------

create or replace function public.check_create_password(p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._throttle();
  if public._is_create_pw(p_password) or public._is_admin_pw(p_password) then
    return jsonb_build_object('ok', true);
  end if;
  insert into public.attempts default values;
  return jsonb_build_object('ok', false, 'error', 'contrasena_incorrecta');
end $$;

create or replace function public.verify_admin(p_password text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._throttle();
  if public._is_admin_pw(p_password) then
    return jsonb_build_object('ok', true);
  end if;
  insert into public.attempts default values;
  return jsonb_build_object('ok', false, 'error', 'contrasena_incorrecta');
end $$;

create or replace function public.verify_edit(p_list_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._throttle();
  if public._can_edit(p_list_id, p_token) then
    return jsonb_build_object('ok', true);
  end if;
  insert into public.attempts default values;
  return jsonb_build_object('ok', false, 'error', 'sin_permiso');
end $$;

create or replace function public.create_list(
  p_password   text,
  p_owner      text,
  p_title      text,
  p_event_date date,
  p_note       text,
  p_items      jsonb
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id    uuid;
  v_token text;
begin
  perform public._throttle();
  if not (public._is_create_pw(p_password) or public._is_admin_pw(p_password)) then
    insert into public.attempts default values;
    return jsonb_build_object('ok', false, 'error', 'contrasena_incorrecta');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 60 then
    return jsonb_build_object('ok', false, 'error', 'regalos_invalidos');
  end if;

  insert into public.lists (owner_name, title, event_date, note)
  values (trim(p_owner), trim(p_title), p_event_date, nullif(trim(coalesce(p_note, '')), ''))
  returning id into v_id;

  v_token := encode(gen_random_bytes(18), 'hex');
  insert into public.list_secrets (list_id, token_hash)
  values (v_id, crypt(v_token, gen_salt('bf')));

  perform public._replace_items(v_id, p_items);
  if not exists (select 1 from public.items where list_id = v_id) then
    raise exception 'sin_regalos';
  end if;

  return jsonb_build_object('ok', true, 'id', v_id, 'token', v_token);
end $$;

create or replace function public.update_list(
  p_list_id    uuid,
  p_token      text,
  p_owner      text,
  p_title      text,
  p_event_date date,
  p_note       text,
  p_items      jsonb
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._throttle();
  if not public._can_edit(p_list_id, p_token) then
    insert into public.attempts default values;
    return jsonb_build_object('ok', false, 'error', 'sin_permiso');
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) > 60 then
    return jsonb_build_object('ok', false, 'error', 'regalos_invalidos');
  end if;

  update public.lists
     set owner_name = trim(p_owner),
         title      = trim(p_title),
         event_date = p_event_date,
         note       = nullif(trim(coalesce(p_note, '')), ''),
         updated_at = now()
   where id = p_list_id;

  perform public._replace_items(p_list_id, p_items);
  if not exists (select 1 from public.items where list_id = p_list_id) then
    raise exception 'sin_regalos';
  end if;

  return jsonb_build_object('ok', true);
end $$;

create or replace function public.delete_list(p_list_id uuid, p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform public._throttle();
  if not public._can_edit(p_list_id, p_token) then
    insert into public.attempts default values;
    return jsonb_build_object('ok', false, 'error', 'sin_permiso');
  end if;
  delete from public.lists where id = p_list_id;
  return jsonb_build_object('ok', true);
end $$;

grant execute on function
  public.check_create_password(text), public.verify_admin(text), public.verify_edit(uuid, text),
  public.create_list(text, text, text, date, text, jsonb),
  public.update_list(uuid, text, text, text, date, text, jsonb),
  public.delete_list(uuid, text)
to anon, authenticated;
