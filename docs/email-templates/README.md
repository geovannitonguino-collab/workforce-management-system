# Plantillas de correo de Trackly (Supabase Auth)

Se pegan a mano en Supabase: **Authentication → Emails → Templates**. Cada plantilla trae su asunto.

| Plantilla de Supabase | Archivo | Asunto (Subject heading) |
|---|---|---|
| **Reset Password** | `recovery.html` | `Crea tu contraseña nueva / Set your new password – Trackly` |
| **Invite user** | `invite.html` | `Te invitaron a Trackly / You are invited to Trackly` |

Las demás plantillas (Confirm sign up, Magic Link, Change Email Address, Reauthentication) hoy **no se usan**: el registro
público está desactivado y la app no tiene cambio de correo ni acceso por enlace. Si las dejas con el texto de fábrica no pasa nada.

Variables que usan las plantillas (las rellena Supabase): `{{ .ConfirmationURL }}`. No las cambies.

## Cómo probarlas
- **Recuperación:** en `https://app.geovannix.com` pulsa "Forgot your password?" con tu correo.
- **Invitación:** *Authentication → Users → Invite user* con el correo de un empleado que ya exista en la tabla `employees`
  (el trigger lo vincula por correo). Al abrir el enlace la app muestra la pantalla "Crea una contraseña nueva".

Revisa el correo en Gmail y en el móvil, y que no caiga en spam.
