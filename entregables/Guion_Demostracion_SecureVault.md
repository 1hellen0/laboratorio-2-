# SecureVault — guion para demostración de 10 minutos

**Producción:** https://securevault-laboratorio-mttb.onrender.com/ · **Versión desplegada al actualizar este guion:** commit `d2e4ca7` · usar solo cuentas y notas ficticias.

| Tiempo | Demostración |
|---|---|
| 0:00–1:00 | Abrir `/` por HTTPS y `/health`. Mostrar la URL, el estado y las cabeceras/cookie segura del navegador. Aclarar que Render puede despertar del modo gratuito y tardar. |
| 1:00–2:30 | Ingresar con la cuenta de evaluación `usuario`. Mostrar el listado vacío, crear una nota ficticia y abrirla con la misma cuenta. Cerrar sesión. |
| 2:30–4:00 | **Ataque 1, nota ajena:** ingresar con la cuenta `administrador` y usar el ID de la nota de la cuenta usuario para intentar abrirla, editarla y eliminarla. Resultado esperado: 404 en las tres operaciones; administrador conserva propiedad solo sobre sus notas. Volver a entrar como usuario y comprobar que la nota sigue intacta. |
| 4:00–5:00 | **Ataque 2, inyección NoSQL:** enviar al ingreso un correo que sea objeto `{"$ne":null}`. Resultado comprobado: HTTP 400 por validación de tipo; sin autenticación. |
| 5:00–6:30 | **Ataque 3, fuerza bruta:** hacer cinco intentos con contraseña incorrecta para una cuenta ficticia preparada. Resultados comprobados: 401, 401, 401, 401 y 429. Evitar continuar probando para no prolongar el bloqueo. |
| 6:30–7:30 | Cerrar sesión y volver a `/cuenta` con la cookie anterior: 401. Si se muestra DevTools, señalar `HttpOnly`, `Secure`, `SameSite=Lax` y prefijo `__Host-sid`. |
| 7:30–8:30 | Entrar al panel con la cuenta `administrador`. Mostrar lista de usuarios y bitácora, sin exponer datos sensibles. La prueba de nota ajena debe permanecer en 404 también para este rol. |
| 8:30–9:30 | Resumir hash Argon2id, cifrado AES-256-GCM, llave mantenida en secretos del proveedor y CI aprobado. Mencionar ZAP pasivo, el aviso CSRF validado manualmente con 403 y el bloqueo de SecurityHeaders sin puntuación. |
| 9:30–10:00 | Cierre: URL pública, límites del plan gratuito y estado de recuperación por correo. Al actualizar este guion, el enlace Sandbox recién enviado continuaba rechazándose como vencido; se desplegó una corrección de reloj, pero falta completar una prueba directa vigente antes de afirmar que quedó resuelto. |

## Preparación segura de las cuentas de evaluación

1. Usar las dos cuentas ficticias de evaluación indicadas por el equipo. Si aún no existen, registrarlas desde la página pública como cuentas distintas; el registro asigna `usuario` y no acepta que el cliente solicite el rol administrador. Direcciones `.test` reservadas no reciben correo y no consumen destinatarios Sandbox.
2. La persona que administra Atlas permite temporalmente la IP del equipo en la lista de acceso del clúster. Desde una terminal PowerShell local, en la raíz del repo, promueve **solo** el correo registrado para administración. Introduce la URI de mantenimiento en el prompt seguro; no la pegues en el comando, el chat ni el repositorio:

   ```powershell
   $env:NODE_ENV = 'production'
   $env:DB_NAME = 'securevault'
   $adminUriSecure = Read-Host -AsSecureString 'URI Atlas de mantenimiento'
   $adminUriPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($adminUriSecure)
   try {
       $env:MONGODB_ADMIN_URI = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($adminUriPtr)
       npm run admin -- admin-demo@example.test
   } finally {
       Remove-Item Env:MONGODB_ADMIN_URI -ErrorAction SilentlyContinue
       [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($adminUriPtr)
       Remove-Variable adminUriSecure, adminUriPtr
       Remove-Item Env:NODE_ENV, Env:DB_NAME -ErrorAction SilentlyContinue
   }
   ```

   Reemplazar `admin-demo@example.test` por el correo ficticio exacto registrado. El URI debe ser de la cuenta de mantenimiento Atlas, con acceso a replica set y los permisos definidos en el README; nunca usar la URI runtime de Render. Después retirar la IP temporal de Atlas. La promoción invalida sesiones previas: ingresar de nuevo con la cuenta administradora.
3. Probar ingreso y cierre para ambas cuentas; crear una nota con el usuario y verificar lectura propia, panel 403 para usuario, panel 200 para administrador y nota ajena 404 incluso al administrador. El equipo guarda las contraseñas en un gestor seguro y entrega URL, correos y contraseñas al docente por un canal privado acordado. No guardar credenciales en este guion, en GitHub, capturas ni PDF.

## Intervención del equipo

- La persona titular de Atlas debe habilitar temporalmente la IP local si todavía no está permitida, ingresar la URI de mantenimiento en PowerShell y retirarla al terminar.
- El equipo conserva las credenciales en un gestor protegido y las comparte con el docente por un canal privado institucional elegido. Ninguna credencial se solicita ni se incluye en este entregable.
- La recuperación real por correo aún no se marca aprobada: el enlace reciente también informó vencimiento en producción. La corrección que unifica el reloj está desplegada, pero el canje vigente, rechazo del segundo uso e ingreso con nueva contraseña siguen pendientes de comprobación directa.
