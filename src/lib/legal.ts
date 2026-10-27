/** Versión vigente. Súbela cuando cambie el texto: todos tendrán que volver a aceptar. */
export const TERMS_VERSION = '2026-10-28';
export const CONTACT_EMAIL = 'contacto@geovannix.com';

export type Lang = 'es' | 'en';
export interface LegalSection { title: string; body: string[] }
export interface LegalDoc { title: string; updated: string; intro: string; sections: LegalSection[] }

export const TERMS: Record<Lang, LegalDoc> = {
  es: {
    title: 'Términos de Servicio',
    updated: 'Última actualización: 28 de octubre de 2026',
    intro: 'Estos Términos regulan el uso de Trackly, el servicio de gestión de personal (control de horas, permisos y estimación de nómina) ofrecido por Geovannix ("nosotros"). Al iniciar sesión y aceptar, tú y la organización a la que perteneces quedan sujetos a ellos.',
    sections: [
      { title: '1. El servicio', body: [
        'Trackly permite a una organización registrar horas trabajadas, gestionar solicitudes de permiso y vacaciones, corregir registros de tiempo con aprobación y obtener estimaciones de nómina.',
        'El acceso es por invitación. Cada organización es un espacio aislado: sus datos no son visibles para otras organizaciones.',
      ] },
      { title: '2. Cuentas y responsabilidades', body: [
        'Eres responsable de mantener tu contraseña en secreto y de la actividad realizada con tu cuenta. Avísanos de inmediato si sospechas un acceso no autorizado.',
        'El administrador de cada organización decide quién tiene acceso, qué rol tiene y qué datos de sus empleados se cargan, y es responsable de que ese tratamiento sea lícito.',
      ] },
      { title: '3. Uso aceptable', body: [
        'No puedes intentar acceder a datos de otras organizaciones, eludir los controles de seguridad, sobrecargar el servicio, ni usarlo para fines ilícitos.',
        'No puedes registrar horas falsas ni manipular registros. Las correcciones se hacen solo mediante el flujo de solicitud y aprobación, que deja un registro de auditoría.',
      ] },
      { title: '4. Estimaciones de nómina: no son asesoría laboral', body: [
        'Los cálculos de horas, permisos y pagos son estimaciones basadas en las reglas configuradas. No sustituyen la nómina legal ni la asesoría laboral, contable o tributaria.',
        'Las normas laborales cambian entre países (jornada, recargos, prestaciones, vacaciones, retenciones). La organización es la responsable de verificar que los cálculos cumplan la ley que le aplica antes de pagar a nadie.',
      ] },
      { title: '5. Datos de la organización', body: [
        'Los datos que cargas siguen siendo tuyos (de tu organización). Nos autorizas a tratarlos únicamente para prestar el servicio, según la Política de Privacidad.',
        'Puedes pedirnos exportar o eliminar los datos de tu organización escribiendo a ' + CONTACT_EMAIL + '. Algunos registros pueden conservarse por el tiempo que la ley exija.',
      ] },
      { title: '6. Precio y facturación', body: [
        'Las condiciones comerciales (precio, moneda, periodo de facturación) se acuerdan por separado antes de contratar. Si cambian, te avisaremos con antelación razonable.',
      ] },
      { title: '7. Disponibilidad y copias de seguridad', body: [
        'Trabajamos para que el servicio esté disponible, pero no garantizamos que funcione sin interrupciones ni errores. Puede haber mantenimiento o fallas de proveedores externos.',
      ] },
      { title: '8. Limitación de responsabilidad', body: [
        'En la medida que la ley lo permita, no somos responsables por daños indirectos, lucro cesante, ni por decisiones de pago o contratación tomadas con base en las estimaciones del servicio.',
        'Nuestra responsabilidad total frente a una organización se limita a lo que haya pagado por el servicio en los 12 meses anteriores al hecho que originó el reclamo.',
      ] },
      { title: '9. Suspensión y terminación', body: [
        'Podemos suspender cuentas que incumplan estos Términos o pongan en riesgo la seguridad. Puedes dejar de usar el servicio en cualquier momento; al terminar, eliminaremos o devolveremos los datos de tu organización conforme a la sección 5.',
      ] },
      { title: '10. Cambios', body: [
        'Podemos actualizar estos Términos. Cuando el cambio sea relevante, tendrás que aceptar la nueva versión para seguir usando el servicio.',
      ] },
      { title: '11. Ley aplicable', body: [
        'Estos Términos se rigen por las leyes del país donde esté constituida la entidad que presta el servicio: [COMPLETAR: país y jurisdicción]. Los derechos irrenunciables que tengas como consumidor o titular de datos según la ley de tu país no se ven afectados.',
      ] },
      { title: '12. Contacto', body: ['Escríbenos a ' + CONTACT_EMAIL + '.'] },
    ],
  },
  en: {
    title: 'Terms of Service',
    updated: 'Last updated: October 28, 2026',
    intro: 'These Terms govern the use of Trackly, the workforce management service (time tracking, leave and payroll estimates) provided by Geovannix ("we"). By signing in and accepting, you and the organization you belong to are bound by them.',
    sections: [
      { title: '1. The service', body: [
        'Trackly lets an organization record hours worked, manage leave and vacation requests, correct time records through an approval flow and obtain payroll estimates.',
        'Access is by invitation. Each organization is an isolated space: its data is not visible to other organizations.',
      ] },
      { title: '2. Accounts and responsibilities', body: [
        'You are responsible for keeping your password secret and for activity under your account. Tell us immediately if you suspect unauthorized access.',
        'Each organization\'s administrator decides who has access, their role, and which employee data is uploaded, and is responsible for that processing being lawful.',
      ] },
      { title: '3. Acceptable use', body: [
        'You may not try to access other organizations\' data, bypass security controls, overload the service, or use it for unlawful purposes.',
        'You may not record false hours or tamper with records. Corrections are made only through the request-and-approval flow, which leaves an audit trail.',
      ] },
      { title: '4. Payroll estimates are not labor advice', body: [
        'Calculations of hours, leave and pay are estimates based on the configured rules. They do not replace legal payroll or labor, accounting or tax advice.',
        'Labor rules differ across countries (working time, overtime, benefits, vacation, withholdings). The organization is responsible for verifying that calculations comply with the law that applies to it before paying anyone.',
      ] },
      { title: '5. Organization data', body: [
        'The data you upload remains yours (your organization\'s). You authorize us to process it only to provide the service, as described in the Privacy Policy.',
        'You can ask us to export or delete your organization\'s data by writing to ' + CONTACT_EMAIL + '. Some records may be kept for as long as the law requires.',
      ] },
      { title: '6. Pricing and billing', body: [
        'Commercial terms (price, currency, billing period) are agreed separately before you subscribe. If they change, we will give reasonable advance notice.',
      ] },
      { title: '7. Availability and backups', body: [
        'We work to keep the service available but do not guarantee uninterrupted or error-free operation. There may be maintenance or third-party provider outages.',
      ] },
      { title: '8. Limitation of liability', body: [
        'To the extent permitted by law, we are not liable for indirect damages, lost profits, or for payment or hiring decisions made on the basis of the service\'s estimates.',
        'Our total liability to an organization is limited to the amount it paid for the service in the 12 months before the event giving rise to the claim.',
      ] },
      { title: '9. Suspension and termination', body: [
        'We may suspend accounts that breach these Terms or put security at risk. You may stop using the service at any time; on termination we will delete or return your organization\'s data as described in section 5.',
      ] },
      { title: '10. Changes', body: [
        'We may update these Terms. When a change is material, you will need to accept the new version to keep using the service.',
      ] },
      { title: '11. Governing law', body: [
        'These Terms are governed by the laws of the country where the providing entity is incorporated: [COMPLETE: country and jurisdiction]. Non-waivable rights you hold as a consumer or data subject under your country\'s law are unaffected.',
      ] },
      { title: '12. Contact', body: ['Write to us at ' + CONTACT_EMAIL + '.'] },
    ],
  },
};

export const PRIVACY: Record<Lang, LegalDoc> = {
  es: {
    title: 'Política de Privacidad',
    updated: 'Última actualización: 28 de octubre de 2026',
    intro: 'Explicamos qué datos trata Trackly, para qué, con quién se comparten y cómo ejercer tus derechos. El servicio se ofrece en América (de Norte a Sur), por lo que esta política busca cubrir los principios comunes de las leyes de protección de datos de la región (por ejemplo, Colombia, México, Brasil, Argentina, Chile, Perú, Canadá y las leyes estatales de EE. UU.).',
    sections: [
      { title: '1. Quién es responsable', body: [
        'Tu empleador (la organización) decide qué datos de su personal se registran y para qué: es el responsable del tratamiento. Geovannix actúa como encargado/procesador: trata esos datos por cuenta de la organización para prestar Trackly.',
        'Geovannix es responsable directo de los datos de cuenta y de seguridad del servicio (inicio de sesión, registros técnicos). Contacto: ' + CONTACT_EMAIL + '.',
      ] },
      { title: '2. Qué datos tratamos', body: [
        'Cuenta y perfil: nombre, correo, cargo/departamento, fecha de ingreso, rol (empleado o administrador).',
        'Datos laborales: registros de entrada y salida, almuerzos y pausas, solicitudes de permiso o vacaciones, tarifa por hora y estimaciones de nómina.',
        'Datos sensibles de salud: constancias médicas (PDF) que el empleado sube para justificar incapacidades. Se almacenan en un espacio privado y solo las ven el propio empleado y el administrador de su organización.',
        'Bitácora de auditoría: quién creó, cambió o aprobó qué y cuándo (por ejemplo, correcciones de tiempo o cambios de rol y tarifa).',
        'Datos técnicos mínimos para el funcionamiento y la seguridad (sesión, dirección IP y registros del proveedor de infraestructura).',
      ] },
      { title: '3. Para qué los usamos y base jurídica', body: [
        'Para prestar el servicio (registrar horas, gestionar permisos, calcular estimaciones), para la seguridad y la prevención de fraude, y para cumplir obligaciones legales. La base jurídica depende de tu país: ejecución de la relación laboral/contractual, interés legítimo de la organización, cumplimiento legal y, para datos de salud, tu autorización explícita al subir la constancia.',
        'No vendemos datos personales ni los usamos para publicidad ni para perfilar a las personas.',
      ] },
      { title: '4. Con quién los compartimos', body: [
        'Usamos proveedores de infraestructura que tratan datos por nuestra cuenta: Supabase (base de datos, autenticación y almacenamiento de archivos) y Vercel (alojamiento de la aplicación). Región de alojamiento: [COMPLETAR: región de Supabase/Vercel].',
        'Los datos de una organización no son visibles para otras. Podemos divulgar datos si una autoridad competente lo exige conforme a la ley.',
      ] },
      { title: '5. Transferencias internacionales', body: [
        'Los proveedores pueden almacenar o tratar datos fuera de tu país. Cuando esto ocurra, exigimos garantías contractuales y técnicas razonables y, donde tu ley lo requiera, la organización debe contar con la base legal para la transferencia.',
      ] },
      { title: '6. Cuánto tiempo los conservamos', body: [
        'Mientras la organización use el servicio y, después, solo el tiempo que la ley laboral o contable aplicable obligue. Al terminar el contrato, los datos se eliminan o devuelven a la organización según los Términos. Las copias de seguridad se renuevan en ciclos limitados.',
      ] },
      { title: '7. Cómo los protegemos', body: [
        'Conexión cifrada (HTTPS), autenticación individual, aislamiento por organización y por empleado a nivel de base de datos, archivos médicos en almacenamiento privado con enlaces temporales, registros de tiempo que no se editan ni borran (las correcciones los anulan y quedan auditadas) y bitácora de auditoría.',
        'Ningún sistema es 100% seguro. Si ocurre una brecha que te afecte, la notificaremos a la organización y a las autoridades cuando la ley lo exija.',
      ] },
      { title: '8. Tus derechos', body: [
        'Según tu país, puedes solicitar acceso, rectificación, actualización, eliminación, oposición, portabilidad, limitación o revocar tu autorización. Para ejercerlos escribe a ' + CONTACT_EMAIL + ' indicando tu organización; si la solicitud corresponde a tu empleador, la trasladaremos o te indicaremos cómo dirigirla.',
        'Puedes reclamar ante la autoridad de protección de datos de tu país (por ejemplo, la SIC en Colombia, el INAI/autoridad competente en México, la ANPD en Brasil o la AAIP en Argentina).',
      ] },
      { title: '9. Menores', body: ['El servicio está dirigido a personal en edad laboral. No lo ofrecemos a menores de edad que no puedan trabajar legalmente.'] },
      { title: '10. Cambios', body: ['Podemos actualizar esta política. Si el cambio es relevante, te pediremos aceptar la nueva versión.'] },
      { title: '11. Contacto', body: ['Responsable del contacto de privacidad: Geovannix, ' + CONTACT_EMAIL + '.'] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: October 28, 2026',
    intro: 'This explains what data Trackly processes, why, who it is shared with and how to exercise your rights. The service is offered across the Americas (North to South), so this policy aims to cover the common principles of the region\'s data protection laws (for example Colombia, Mexico, Brazil, Argentina, Chile, Peru, Canada and US state laws).',
    sections: [
      { title: '1. Who is responsible', body: [
        'Your employer (the organization) decides which staff data is recorded and why: it is the controller. Geovannix acts as processor: it processes that data on the organization\'s behalf to provide Trackly.',
        'Geovannix is directly responsible for account data and the service\'s security (sign-in, technical logs). Contact: ' + CONTACT_EMAIL + '.',
      ] },
      { title: '2. Data we process', body: [
        'Account and profile: name, email, job title/department, hire date, role (employee or administrator).',
        'Work data: clock-in/out records, lunches and breaks, leave or vacation requests, hourly rate and payroll estimates.',
        'Sensitive health data: medical certificates (PDF) uploaded by employees to justify sick leave. They are stored in private storage and are visible only to the employee and their organization\'s administrator.',
        'Audit log: who created, changed or approved what and when (for example time corrections or role and rate changes).',
        'Minimal technical data for operation and security (session, IP address and infrastructure provider logs).',
      ] },
      { title: '3. Purposes and legal basis', body: [
        'To provide the service (record hours, manage leave, compute estimates), for security and fraud prevention, and to meet legal obligations. The legal basis depends on your country: performance of the employment/contract relationship, the organization\'s legitimate interest, legal compliance and, for health data, your explicit authorization when uploading the certificate.',
        'We do not sell personal data nor use it for advertising or profiling people.',
      ] },
      { title: '4. Who we share it with', body: [
        'We use infrastructure providers that process data on our behalf: Supabase (database, authentication and file storage) and Vercel (application hosting). Hosting region: [COMPLETE: Supabase/Vercel region].',
        'One organization\'s data is not visible to others. We may disclose data if a competent authority requires it by law.',
      ] },
      { title: '5. International transfers', body: [
        'Providers may store or process data outside your country. When this happens we require reasonable contractual and technical safeguards and, where your law requires it, the organization must have the legal basis for the transfer.',
      ] },
      { title: '6. Retention', body: [
        'While the organization uses the service and, afterwards, only as long as the applicable labor or accounting law requires. When the contract ends, data is deleted or returned to the organization per the Terms. Backups are rotated in limited cycles.',
      ] },
      { title: '7. How we protect it', body: [
        'Encrypted connection (HTTPS), individual authentication, isolation per organization and per employee at the database level, medical files in private storage with temporary links, time records that are never edited or deleted (corrections void them and are audited) and an audit log.',
        'No system is 100% secure. If a breach affects you, we will notify the organization and authorities where the law requires.',
      ] },
      { title: '8. Your rights', body: [
        'Depending on your country, you may request access, rectification, update, deletion, objection, portability, restriction, or withdraw your consent. To exercise them write to ' + CONTACT_EMAIL + ' naming your organization; if the request belongs to your employer we will forward it or tell you how to direct it.',
        'You may complain to your country\'s data protection authority (for example the SIC in Colombia, the competent authority in Mexico, the ANPD in Brazil or the AAIP in Argentina).',
      ] },
      { title: '9. Minors', body: ['The service is aimed at working-age staff. We do not offer it to minors who cannot legally work.'] },
      { title: '10. Changes', body: ['We may update this policy. If the change is material, we will ask you to accept the new version.'] },
      { title: '11. Contact', body: ['Privacy contact: Geovannix, ' + CONTACT_EMAIL + '.'] },
    ],
  },
};
