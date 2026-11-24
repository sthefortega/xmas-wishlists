# Deseos de Navidad

Sitio gratuito para publicar listas de regalos en familia. Cada persona crea la suya con una contraseña compartida y todas aparecen en una página principal. Cualquiera con el enlace puede verlas; los buscadores no las indexan.

- **Sitio:** HTML, CSS y JavaScript sin dependencias, publicado en GitHub Pages.
- **Datos:** Supabase (plan gratuito). Las contraseñas se validan en el servidor, no en el navegador.
- **Sin cuentas.** Cada lista tiene un código secreto guardado en el navegador de quien la creó, más un enlace de edición para recuperarlo.
- **Administración.** Una segunda contraseña, solo para quien administra, permite editar o borrar cualquier lista.

## Puesta en marcha

### 1. Crear las tablas en Supabase

1. En tu proyecto de Supabase abre **SQL Editor → New query**.
2. Pega el contenido de [`supabase/schema.sql`](supabase/schema.sql) y presiona **Run**.
3. Abre otra consulta nueva y pega [`supabase/set_passwords.sql`](supabase/set_passwords.sql). Cambia los dos textos entre comillas por tus contraseñas (creación y administración) y presiona **Run**. No guardes esa consulta ni subas el archivo modificado a GitHub.

### 2. Publicar en GitHub Pages

1. Sube este proyecto a la rama `main` del repositorio.
2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Espera a que termine el workflow *Publicar en GitHub Pages* (pestaña **Actions**).
4. El sitio queda en `https://<tu-usuario>.github.io/xmas-wishlists/`.

### 3. Probar

1. Abre el sitio: debe decir que todavía no hay listas.
2. Presiona **Crear mi lista**, escribe la contraseña de creación y publica una lista de prueba.
3. Guarda el enlace de edición que aparece al terminar.
4. En el pie de página, **Administrar** pide la contraseña de administración.

## Notas

- La URL y la clave `publishable` de Supabase están en [`js/config.js`](js/config.js). Son públicas por diseño: solo permiten leer. Nunca pongas ahí la clave `secret` o `service_role`.
- Se bloquean los intentos de contraseña si hay más de 30 fallidos en 10 minutos.
- Supabase pausa los proyectos gratuitos tras 7 días sin actividad. [`keepalive.yml`](.github/workflows/keepalive.yml) hace una consulta diaria. GitHub desactiva las tareas programadas tras 60 días sin actividad en el repositorio; si pasa, reactívala en la pestaña **Actions**.
- Para cambiar las contraseñas, vuelve a ejecutar `set_passwords.sql` con los valores nuevos.

## Estructura

```
index.html, lista.html, crear.html   Páginas
privacidad.html, 404.html            Páginas legales y de error
css/styles.css                       Estilos
js/                                  Lógica de cada página
supabase/                            SQL de la base de datos
.github/workflows/                   Despliegue y tarea diaria
```
