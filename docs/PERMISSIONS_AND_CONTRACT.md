# Trackly · Roles, permisos y contrato del empleado (BORRADOR PARA APROBAR)

Estado: **propuesta, nada de esto está programado todavía.**

## Idea del producto
Trackly reemplaza el trabajo manual de Recursos Humanos: la empresa carga **una vez** el contrato de cada persona y el sistema
calcula horas, recargos, vacaciones, PTO y el estimado de pago. Trackly no calcula impuestos, seguridad social ni retenciones;
produce un **estimado de pago bruto** (ver Términos, sección 4).

## 1. Roles dentro de una empresa cliente

| Rol | Quién | Alcance |
|---|---|---|
| **Director** | Dueño / CEO. Puede haber varios | Toda su empresa |
| **Manager** | Jefe de uno o más departamentos. **Opcional** (una empresa puede no tener ninguno) | Edita su equipo; ve a los demás en solo lectura limitada |
| **Employee** | Operativo / freelancer / ingeniero | Solo lo suyo |

**Proveedor (tú):** no es un rol de la app. Acceso técnico por base de datos para soporte. Más adelante, "modo soporte" con permiso temporal del Director y registro en la bitácora.

Reglas fijas:
- Un empleado pertenece a **un** departamento. Un departamento tiene **un** manager. Un manager puede dirigir varios departamentos.
- Solo el Director asigna roles, crea departamentos y nombra managers.
- Un Manager nunca puede ascender a nadie ni cambiar su propio rol.
- Nadie puede cambiar su propio contrato, tarifa ni rol. Nadie edita fichajes de forma directa (solo solicitud de corrección aprobada).

## 2. Matriz de permisos (propuesta)

Leyenda: **E** = ve y edita · **V** = solo ve · — = no ve

| Dato / acción | Employee | Manager (su equipo) | Manager (otros equipos) | Director |
|---|---|---|---|---|
| Sus propios fichajes, permisos, balance, pago estimado | E (fichar y pedir) | E (los suyos) | — | E |
| Fichajes y horas de otros | — | V | V | V |
| Solicitar corrección de tiempo | sí (los suyos) | — | — | — |
| **Aprobar** correcciones de tiempo | — | **E** (su equipo) | — | **E** |
| Permisos y vacaciones de otros | — | V + **aprobar** | V | V + aprobar |
| Constancias médicas de otros | — | V (su equipo, necesario para aprobar) | — | V |
| **Contrato y tarifa** de otros | — | **E** (su equipo) | — | **E** |
| Alta de empleados | — | **E** (solo en su equipo, rol Employee) | — | **E** |
| Departamentos, roles, nombrar managers | — | — | — | **E** |
| Política de red de fichaje, plan y facturación | — | — | — | **E** |
| Bitácora de auditoría | — | V (solo su equipo) | — | V |

Decisiones por confirmar (marcadas con ⚠ en la propuesta):
- ⚠ Un manager **no ve tarifas ni sueldos de otros equipos**, ni las constancias médicas de otros equipos.
- ⚠ Un manager **sí ve el contrato y las constancias de su propio equipo** (los necesita para cargarlos y aprobar).

## 3. Contrato del empleado (campos del formulario)

Cada cambio crea una **versión nueva con fecha de inicio de vigencia**. La nómina de un día usa la versión vigente ese día;
subir la tarifa en marzo no cambia enero. Los campos se agrupan así:

**Jornada**
- Horas por semana.
- Horario por día de la semana (por ejemplo lunes a viernes 8 h, o 4 días de 10 h). Permite medio tiempo.
- Jornada máxima por día.
- Día(s) de descanso semanal.

**Pago**
- Tipo: **por hora** o **tarifa fija mensual**.
- Monto y moneda.
- Frecuencia de pago (semanal, quincenal, mensual).
- Si es tarifa fija: divisor para descontar un día no pagado (por ejemplo 30 o los días hábiles del mes).
- ¿Tiene derecho a horas extra? (sí/no)

**Recargos** (cada uno es un porcentaje configurable)
- Nocturno: hora de inicio, hora de fin y porcentaje.
- Dominical y festivos: porcentaje.
- Horas extra: a partir de cuántas horas (por día o por semana) y porcentaje. Hasta dos tramos.
- Cómo se combinan: **se suman** (propuesta; confirmar con contador).

**Vacaciones y PTO**
- Días de vacaciones que se acumulan por mes.
- Horas de PTO pagado por año.
- Fecha de ingreso (de la que cuenta la acumulación).

**A nivel de empresa** (una sola vez): país, moneda por defecto, zona horaria, calendario de festivos, y las **plantillas por país** como punto de partida editable.

## 4. Fases de construcción

1. **Roles y departamentos.** Tablas de departamentos, nuevos roles, seguridad rehecha con pruebas entre equipos y entre empresas.
2. **Contrato con historial.** Formulario, versiones con vigencia y motor de cálculo que lee del contrato.
3. **Plantillas por país** y calendario de festivos (valores validados por un contador).
4. Importación masiva (Excel), documento del contrato (PDF), modo soporte.

## 5. Lo que hace falta de tu lado
- Aprobar esta matriz (sobre todo los puntos ⚠).
- 2 o 3 contratos reales de ejemplo de distintos países, con datos tachados.
- Un contador que valide las plantillas por país.
- Un contrato de servicio con tratamiento de datos (DPA) para cada empresa cliente, revisado por un abogado.
