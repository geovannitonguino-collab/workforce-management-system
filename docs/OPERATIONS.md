# Trackly · Operación: copias de seguridad y monitoreo

> El repositorio es **público**. Nunca subas volcados de la base, contraseñas ni claves aquí.
> Los secretos viven solo en *GitHub → Settings → Secrets and variables → Actions*.

## 1. Copias de seguridad (tres capas)

| Capa | Qué cubre | Cuánto se pierde como máximo | Estado |
|---|---|---|---|
| **A. Copias automáticas de Supabase** | Base de datos completa | 24 h (plan Pro) | Depende de tu plan: ver abajo |
| **B. Volcado cifrado diario fuera de Supabase** (`backup.yml`) | Tablas, usuarios de login y constancias médicas | 24 h | Listo en el código; requiere configurar 6 secretos |
| **C. Copia manual antes de cambios grandes** | Lo que tú elijas | 0 | Receta abajo |

**Capa A.** En *Supabase → Project Settings → Add-ons / Database → Backups* confirma qué plan tienes.
El plan gratuito **no** incluye copias descargables ni recuperación a un punto en el tiempo. Con clientes reales
te recomiendo el plan Pro (copias diarias) y, si no puedes perder ni una hora de fichajes, el complemento PITR.

**Capa B.** Es lo que protege si pierdes el proyecto de Supabase por completo (cuenta suspendida, borrado accidental).
Cifra con una clave pública (`age`): GitHub solo conoce la parte pública y no puede leer los volcados.

### Configurar la capa B (una sola vez)

1. **Clave de cifrado.** En tu computador instala `age` y ejecuta:
   ```
   age-keygen -o trackly-backup-key.txt
   ```
   Imprime una línea `Public key: age1...`. Esa línea va al secreto `BACKUP_AGE_PUBLIC_KEY`.
   El archivo `trackly-backup-key.txt` es la **clave privada**: guárdalo en tu gestor de contraseñas y en una copia
   offline. **Si lo pierdes, las copias son ilegibles. Nunca lo subas a GitHub.**
2. **Bucket privado.** Crea un bucket privado en un servicio compatible con S3 (Cloudflare R2, Backblaze B2, AWS S3).
   Pon una regla de vida útil que borre objetos a los 30 días. Crea una llave de acceso **solo con permiso de escritura** a ese bucket.
3. **Conexión a la base.** En *Supabase → Connect → Session pooler* copia la cadena de conexión (usuario `postgres`) → secreto `BACKUP_DB_URL`.
   Debe ser `postgres` (salta RLS); una cuenta restringida produciría una copia incompleta sin avisar.
4. **Constancias médicas (opcional pero recomendado).** *Supabase → Project Settings → API → service_role* → secreto
   `BACKUP_SUPABASE_SERVICE_ROLE_KEY`. Esta clave es muy poderosa: solo en secretos de GitHub, nunca en el código.
5. **Secretos a crear:** `BACKUP_DB_URL`, `BACKUP_AGE_PUBLIC_KEY`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ENDPOINT`,
   `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_SUPABASE_SERVICE_ROLE_KEY`.
6. *Actions → backup → Run workflow*. Debe terminar en verde y dejar `public.dump.age`, `auth.dump.age` y, si hay archivos,
   `medical-proofs.tar.age` en `trackly/<fecha>/`.

Si falta algún secreto, el flujo no falla: avisa con una advertencia amarilla ("Backups are NOT configured").
**Una advertencia no es una copia: revisa que aparezcan archivos nuevos en el bucket cada semana.**

### Restaurar (ensáyalo antes de necesitarlo)

Una copia que nunca se ha restaurado no es una copia. Haz este ensayo **una vez al mes** y tras cada cambio grande de esquema:

1. Crea un proyecto Supabase vacío de prueba.
2. Descarga el archivo del bucket y descífralo:
   ```
   age -d -i trackly-backup-key.txt -o public.dump public.dump.age
   age -d -i trackly-backup-key.txt -o auth.dump auth.dump.age
   ```
3. Aplica primero las migraciones de `supabase/migrations/` en orden (crean extensiones, esquemas `private`, funciones y políticas), luego carga los datos:
   ```
   pg_restore --data-only --disable-triggers --no-owner -d "<cadena del proyecto de prueba>" public.dump
   pg_restore --data-only --disable-triggers --no-owner -d "<cadena del proyecto de prueba>" auth.dump
   ```
4. Comprueba: puedes entrar con un usuario, ves los empleados y fichajes, y `select count(*)` coincide con producción.
5. Anota la fecha y cuánto tardó. Esa duración es tu tiempo real de recuperación.

Constancias médicas: descifra `medical-proofs.tar.age`, descomprime y sube cada archivo al bucket `medical-proofs` conservando la ruta `<employee_id>/<archivo>.pdf`.

### Copia manual antes de un cambio grande (capa C)
Antes de ejecutar una migración que borre o transforme datos: *Actions → backup → Run workflow* y espera a que termine en verde.

## 2. Monitoreo

`monitor.yml` corre cada 15 minutos y **falla (GitHub te envía un correo)** si algo de esto deja de cumplirse:

- el sitio y las páginas `/terms` y `/privacy` responden con la aplicación;
- siguen presentes las cabeceras de seguridad (CSP, HSTS, X-Frame-Options, nosniff);
- Supabase Auth está sano;
- un visitante **sin sesión no puede leer** ninguna tabla (guardia contra un error de RLS en una migración futura);
- el registro público de usuarios sigue **desactivado**.

Notas:
- Activa los correos en *GitHub → Settings → Notifications → Actions* ("Send notifications for failed workflows only").
- GitHub desactiva los flujos programados tras 60 días sin actividad en el repositorio. Si pasas ese tiempo sin commits, entra a *Actions* y vuelve a activarlos.
- Los cron de GitHub pueden retrasarse varios minutos; no sirven como tiempo de respuesta garantizado.
- Para errores dentro de la aplicación (pantallas que fallan a los usuarios) hace falta una herramienta de reportes tipo Sentry; requiere crear una cuenta y un DSN. Pendiente.
- Revisa *Vercel → Observability → Runtime logs* y *Supabase → Logs* cuando haya una alerta.

## 3. Si suena una alerta

1. Abre el flujo fallido en *Actions* y lee qué paso falló.
2. `Site is up`: revisa *Vercel → Deployments* (el último despliegue, ¿falló?). Si el último despliegue rompió el sitio, usa *Promote* sobre el anterior.
3. `Supabase Auth is healthy`: revisa status.supabase.com y el estado del proyecto (¿pausado?).
4. `Anonymous users cannot read`: **es una emergencia de seguridad**. Revisa de inmediato la última migración ejecutada y vuelve a aplicar [20261029000001_multi_tenant.sql](../supabase/migrations/20261029000001_multi_tenant.sql).
5. `Public sign-up is disabled`: *Supabase → Authentication → Sign In / Providers → desactiva "Allow new users to sign up"*.

## 4. Lista de revisión mensual
- [ ] Hay archivos nuevos en el bucket de copias de cada día de la semana pasada.
- [ ] Ensayo de restauración hecho y anotado.
- [ ] Ningún correo de alerta sin atender.
- [ ] Contraseñas de prueba y usuarios `@orgb-test.com` eliminados.
