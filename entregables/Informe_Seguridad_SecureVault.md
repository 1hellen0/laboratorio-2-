# SecureVault — informe de seguridad

**Revisión:** 26-11-2026 · **URL:** [securevault-laboratorio-mttb.onrender.com](https://securevault-laboratorio-mttb.onrender.com/) · **Commit activo:** `7a7c534`

## Resumen ejecutivo

La aplicación está activa en Render con HTTPS y MongoDB Atlas. Se observaron `/health` y `/` en HTTP 200, HTTP→HTTPS 301 y calificación SSL Labs A+ en ambas IP públicas. Siete pruebas locales y `npm audit` (116 dependencias; cero vulnerabilidades) pasaron. En producción, los intentos de acceder a notas ajenas dieron 404, una carga de operador Mongo dio 400 y el quinto intento de ingreso fallido dio 429. ZAP 2.17.0 se ejecutó en modo pasivo; tras restringir CSP, desapareció el aviso de directiva wildcard. SecurityHeaders mostró calificación A el 26-11-2026 a las 17:27:52 UTC. Quedan un aviso Medium de CSRF no reconocido por la regla de ZAP y la recuperación real por correo pendiente de dominio propio verificado.

## Evidencia observada

| Verificación | Resultado |
|---|---|
| HTTPS y app | `/health` y `/`: 200. HTTP: 301 a HTTPS. SSL Labs: A+; TLS 1.2/1.3 en `216.24.57.16` y `.18`. |
| Cabeceras/sesión | HSTS 1 año; CSP; `nosniff`; `SAMEORIGIN`; `no-referrer`; `no-store`. Cookie `__Host-sid`: HttpOnly, Secure, SameSite=Lax, Path=/, sin Domain. Logout: 204; página privada posterior: 401. |
| Ataques manuales | Acceso ajeno a nota (leer/editar/borrar): 404. Correo como objeto `$ne`: 400. Cinco claves erróneas: 401, 401, 401, 401, 429. Origen ajeno en POST de registro: 403; no creó cuenta. |
| Pruebas/dependencias | `npm test`: 8/8 en la corrida local; incluye token expirado y canje concurrente, propiedad, sanitización de bitácora y formato de petición MailerSend. `npm audit`: 0 en todas las severidades; 116 dependencias. |
| CI y producción | CI de `7a7c534` aprobado ([ejecución](https://github.com/1hellen0/laboratorio-2-/actions/runs/45866555075)); Render desplegó el commit como `live` (`dep-dc46mv8u01pc73f1mq40`). El commit MailerSend `35dd340` también pasó CI ([ejecución](https://github.com/1hellen0/laboratorio-2-/actions/runs/45872924510)); aún no aparece desplegado en Render. |
| ZAP antes | OWASP ZAP 2.17.0 oficial para Windows, Automation Framework en modo Baseline pasivo, limitado al host propio; spider GET, sin formularios y sin Active Scan. 5 URLs; 0 High, 2 tipos Medium (CSP wildcard 3 y CSRF 5), 0 Low, 1 Informational (caché 2). [Reporte](ZAP_Baseline_SecureVault.html). |
| Cambio y ZAP después | Helmet limita `font-src` a `'self'`. Suite 7/7, audit high 0, CI aprobado y Render activo. El mismo escaneo pasivo: 5 URLs; 0 High, 1 Medium (CSRF, 5 instancias), 0 Low, 1 Informational (caché, 3). [Reporte posterior](ZAP_Baseline_SecureVault_postfix.html). |
| SecurityHeaders | Intento anterior: HTTP 403 del desafío anti-bot, sin calificación. Resultado posterior observado en navegador: **A**, reporte de 26-11-2026 17:27:52 UTC. Marca presentes Content-Security-Policy, Referrer-Policy, Strict-Transport-Security, X-Content-Type-Options y X-Frame-Options; ausente Permissions-Policy. |
| Logs | En una comprobación anterior más amplia del mismo despliegue se buscaron marcadores de contraseñas, tokens, URI y contenido ficticio de notas, sin coincidencias. Además, la captura revisada visualmente por el equipo desde Render → `securevault-laboratorio-mttb` → Logs → Application logs (26-11-2026) muestra el arranque de producción y eventos JSON de ingresos correctos/fallidos y accesos a notas denegados. En las líneas visibles no aparecen contraseñas, tokens ni contenido de notas. La revisión de la captura se limita a esas líneas; no representa todo el historial. |
| Recuperación email | Adaptador MailerSend implementado; prueba unitaria local de la llamada API aprobada. Cuenta/token/variables de Render no comprobados en esta ejecución; no se observó envío público, por lo que recepción y ciclo end-to-end siguen pendientes. |

La comprobación ZAP fue pasiva y no equivale a una prueba de penetración. El hallazgo CSRF permanece visible: ZAP no interpreta el control propio `Origin` + `X-SecureVault: 1`; la solicitud negativa desde otro origen devolvió 403. El aviso informativo de caché no significa que se haya detectado exposición de contenido privado.

## OWASP Top 10:2025

| Categoría | Mitigación y evidencia |
|---|---|
| A01 Broken Access Control | Cada operación consulta por ID de nota y propietario de sesión; administrador tampoco salta la regla. Producción: leer/editar/borrar cruzados 404; suite incluye propietario administrador. |
| A02 Security Misconfiguration | TLS en Render; trust proxy, redirección, Helmet y cookie segura. Observados 301, cabeceras, cookie y SSL A+. ZAP dejó de alertar CSP wildcard tras el cambio. |
| A03 Software Supply Chain Failures | Lockfile, `npm ci`, audit alto en CI y Dependabot semanal. Audit local limpio; CI aprobado. |
| A04 Cryptographic Failures | Contraseña Argon2id (`m=19456,t=2,p=1`, 32 bytes, sal aleatoria 16); nota/teléfono AES-256-GCM (IV 12, tag 16, AAD ligada al registro); llave de 32 bytes en secreto Render; recuperación almacena SHA-256 del token aleatorio. Parámetros revisados en `src/security.js`/`src/vault.js`; no se inspeccionó Atlas directamente. |
| A05 Injection | Esquemas y tipos estrictos, valores escalares en consultas y EJS escapado. `$ne` como objeto recibió 400; ZAP fue pasivo. |
| A06 Insecure Design | Máximo 50 notas de 8192 bytes, sesiones servidoras, token de recuperación de 15 min y canje atómico, cuotas y runtime Atlas de mínimo privilegio. Suite cubre límites y doble canje; no hubo prueba de carga. |
| A07 Authentication Failures | Argon2id, sesión aleatoria rotada al login, expiración/revocación y limitación progresiva. Observados login, cookie segura, quinto fallo 429 y logout seguido por 401. |
| A08 Software or Data Integrity Failures | Lockfile y despliegue con condición CI exitosa; operaciones de rol usan transacción. CI y Render live comprobados; transacción cubierta en suite. |
| A09 Security Logging and Alerting Failures | Bitácora acotada a tipos, resultado e IDs, sin secretos ni cuerpo de nota, con TTL. Sanitización en suite; búsqueda previa más amplia sin coincidencias de marcadores y muestra visual de logs de producción sin secretos en las líneas visibles. Alertas externas no configuradas. |
| A10 Mishandling of Exceptional Conditions | Validación/límites, errores genéricos y readiness dependiente de DB. Suite cubre entradas y fallos; `/health` 200. Falta resiliencia/carga; la revisión visual de logs se limita a las líneas mostradas. |

El mapeo describe evidencia, no certificación. Los usuarios ficticios de auditoría siguen en Atlas; no se guardaron sus contraseñas. La nota de propiedad se eliminó.

## Recuperación por correo y acciones pendientes

La documentación actual de MailerSend permite usar su dominio de prueba desde Sandbox, sin plazo de expiración ni método de pago, con 100 mensajes/mes y 100 solicitudes API al día; antes de aprobar la cuenta el envío se limita a dos destinatarios únicos [2]. La guía oficial confirma que el mensaje puede llegar a una bandeja controlada por el equipo y que el remitente debe usar el dominio de prueba mostrado en su panel [3]. La API acepta un token y campos `from`, `to`, `subject` y `text`, y responde `202 Accepted` al poner el mensaje en cola [4]. Esto alcanza para una demostración con un destinatario permitido, pero el dominio Sandbox está pensado para pruebas y no garantiza envío productivo arbitrario [5]. La cuenta y el buzón concreto del equipo aún deben configurarse y comprobarse.

El adaptador usa `MAILERSEND_API_KEY` y `MAILERSEND_FROM`; no se guardan en Git. La prueba unitaria local confirma el formato de solicitud sin contactar el proveedor. En MailerSend, crear la cuenta, elegir Sandbox/omitir la prueba Professional y no activar ningún plan. Crear token con permiso Email para el dominio de prueba. En Render → servicio → Environment, agregar la clave como secreto y el remitente que pertenezca a ese dominio. Usar el buzón controlado como uno de los dos destinatarios permitidos. Después probar recuperación desde la URL pública: recepción, nueva contraseña aceptada, anterior rechazada, segundo canje del enlace rechazado y vencimiento. El enlace nunca debe compartirse ni escribirse en logs.

Antes de la demostración, preparar cuentas ficticias normales y administradora; una persona del equipo debe promover la cuenta con la URI de mantenimiento introducida localmente, retirar la IP temporal de Atlas y comunicar credenciales al docente por canal privado. Retirar luego usuarios ficticios de auditoría si corresponde. La calificación A de SecurityHeaders es evidencia observada posterior al intento bloqueado; Permissions-Policy figura ausente. Repetir audit y análisis tras cambios relevantes.

## Referencias

Consultadas el 26-11-2026; documentación primaria:

1. OWASP, [Top 10:2025](https://top10.owasp.org/2025/).
2. MailerSend, [Sandbox y prueba Professional](https://www.mailersend.com/help/sandbox-mode-and-the-professional-trial).
3. MailerSend, [crear cuenta y probar con el dominio de prueba](https://www.mailersend.com/help/getting-started).
4. MailerSend Developers, [Email API y respuesta de envío](https://developers.mailersend.com/api/v1/email).
5. MailerSend Developers, [límites Sandbox y errores de destinatarios](https://developers.mailersend.com/general).
5. OWASP ZAP, [Windows](https://www.zaproxy.org/download/), [Automation Framework](https://www.zaproxy.org/docs/desktop/addons/automation-framework/) y [Passive Scanner](https://www.zaproxy.org/docs/desktop/addons/passive-scanner/).
6. Qualys, [SSL Server Test](https://www.ssllabs.com/ssltest/).
7. OWASP, [Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Cryptographic Storage](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) y [Logging](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).
8. Express, [Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html).
