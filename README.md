# SecureVault · Fase 2

Aplicación de notas privadas con Express y MongoDB. Use solo datos ficticios mientras desarrolla. La aplicación y la recuperación se prueban en local. No se ha desplegado públicamente.

## Requisitos locales

PowerShell, Node.js 24 LTS (la implementación usa `node:crypto.argon2`) y npm incluidos con Node. `npm run setup:local` inicia MongoDB 8.2.6 en segundo plano en `127.0.0.1:27018`. La primera ejecución descarga ese binario si no está en caché. Los datos de MongoDB local son de prueba y volátiles. No use este servidor local como base de producción.

## Inicio en PowerShell

Ejecute desde la raíz del repositorio:

```powershell
npm ci
npm run setup:local
npm start
```

La configuración queda en `.env`, ignorado por Git. El script de preparación conserva las llaves que ya existan en ese archivo. **Respalde `DATA_ENCRYPTION_KEY` antes de regenerar secretos o mover la base.** Sin esa llave, las notas y teléfonos cifrados con ella no se recuperan. Abra <http://127.0.0.1:3000/>. Compruebe <http://127.0.0.1:3000/health>, cuya respuesta lista es `{"estado":"listo"}`.

Para detener el servidor web, presione Ctrl+C en su terminal. Para detener MongoDB:

```powershell
$mongoPid = [int](Get-Content -Raw .local/mongodb.pid)
Stop-Process -Id $mongoPid
Remove-Item .local/mongodb.pid
```

El proceso MongoDB se inicia mediante `mongodb-memory-server-core` y vive fuera del proceso web. Para volver a iniciarlo, ejecute `npm run setup:local`. Si mantiene MongoDB entre reinicios del servidor, use la misma URI y llaves de `.env`. El binario de pruebas ejecuta también instancias efímeras separadas.

## Pruebas

```powershell
npm test
npm audit --audit-level=high
```

La prueba de administración usa un replica set efímero local, necesario para probar la transacción de promoción. La prueba de recuperación guarda el enlace en el buzón local ignorado por Git, en `.local/buzon`. No envía correo real.

## Variables de entorno

| Variable | Uso |
|---|---|
| `MONGODB_URI` | URI del servicio MongoDB. Para desarrollo local la genera `npm run setup:local`. |
| `DB_NAME` | Nombre de la base. El valor local predeterminado es `securevault_local`. |
| `DATA_ENCRYPTION_KEY` | Llave activa AES-256-GCM. Base64 de 32 bytes aleatorios. |
| `DATA_KEY_VERSION` | Versión entera de la llave activa, con valor inicial 1. |
| `DATA_PREVIOUS_KEY_<versión>` | Llaves anteriores durante rotación, por ejemplo `DATA_PREVIOUS_KEY_1`. |
| `SESSION_SECRET` | Llave aleatoria Base64 de 32 bytes para firmar cookies. |
| `RATE_LIMIT_SECRET` | Llave aleatoria Base64 de 32 bytes para seudonimizar identificadores del limitador. |
| `APP_ORIGIN` | Origen HTTP local o HTTPS público, sin ruta. |
| `PORT` | Puerto de Express, predeterminado 3000. |
| `NODE_ENV` | Use `production` para Secure cookies, HTTPS y política de producción. |
| `TRUST_PROXY_HOPS` | 0 en local y 1 solo detrás del proxy verificado de Render. |
| `RESEND_API_KEY`, `MAIL_FROM` | Envío de recuperación en producción mediante Resend. No requeridos en local. |
| `MONGODB_ADMIN_URI` | Credencial de mantenimiento separada para `npm run admin -- correo`. |

El script genera las llaves aleatorias con `crypto.randomBytes(32).toString('base64')`. Para generar una sin cambiar `.env`:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Guarde cada valor generado en el gestor de secretos correspondiente. La llave de cifrado debe conservarse para leer las notas existentes. Las versiones antiguas permanecen disponibles como `DATA_PREVIOUS_KEY_<versión>` hasta terminar una rotación y recifrar todos los datos. Nunca copie `.env` al repositorio.

## Crear un administrador

Primero registre la cuenta desde la pantalla de inicio. Configure `MONGODB_ADMIN_URI` como variable de entorno en la sesión de PowerShell y ejecute:

```powershell
$env:MONGODB_ADMIN_URI = 'mongodb://127.0.0.1:27018/?directConnection=true'
npm run admin -- persona@example.test
Remove-Item Env:MONGODB_ADMIN_URI
```

Para Atlas, use la URI administrativa restringida a la base y red necesarias. La promoción requiere replica set y crea un evento de auditoría. El cambio invalida las sesiones anteriores. La nueva cuenta de administración debe volver a ingresar.

## Desarrollo y CI

`npm ci` instala lo fijado en `package-lock.json`. GitHub Actions, si el workflow se ejecuta en un repositorio, instala, ejecuta `npm test` y falla ante vulnerabilidades altas o críticas. Dependabot está configurado para revisar npm semanalmente. Un archivo workflow presente localmente es configuración, no evidencia de una ejecución en GitHub.

## Despliegue de evaluación en Render y MongoDB Atlas

El repositorio incluye `render.yaml` como Blueprint de un Web Service gratuito en Ohio. Render usará Node.js 24.22.1 (`.node-version`; el proyecto requiere Node `>=24.12.0 <25`), `npm ci`, `npm start` y `GET /health`. El servidor escucha `PORT` en `0.0.0.0`; Render asigna el puerto y termina TLS antes de reenviar la solicitud. La aplicación toma `APP_ORIGIN` si se define y, en Render, usa `RENDER_EXTERNAL_URL` como origen público. `TRUST_PROXY_HOPS=1` se limita al proxy de Render.

El Blueprint crea `DATA_ENCRYPTION_KEY`, `SESSION_SECRET` y `RATE_LIMIT_SECRET` como secretos aleatorios persistentes del servicio. No los regeneres al redeplegar ni reemplaces la llave de cifrado: una copia segura de `DATA_ENCRYPTION_KEY` debe mantenerse fuera de Render para recuperación ante pérdida. Las contraseñas y llaves se agregan como variables secretas en el panel, nunca al repositorio. `MONGODB_URI` será la cuenta de ejecución; `MONGODB_ADMIN_URI` no se configura en el servicio web y se reserva para la inicialización administrativa desde una consola confiable.

### Preparación inicial

1. En Atlas, crea un clúster **Free (M0)** y la base `securevault` en la región gratuita más cercana disponible a Render Ohio. Atlas limita Free a 512 MB, puede pausar clústeres tras 30 días sin conexiones y requiere autenticar y permitir las direcciones de origen. En el panel de Render, luego de crear el servicio, abre **Connect → Outbound** y agrega a la lista de acceso de Atlas los CIDR de salida que muestra Render. Son rangos compartidos por región; no abras `0.0.0.0/0`. Para inicializar desde tu computadora, agrega temporalmente tu IP pública actual y quítala al terminar.
2. En Atlas, crea una cuenta de mantenimiento con `dbAdmin` únicamente sobre `securevault` y el rol personalizado `securevaultAdminMaintenance`. Este último limita la promoción administrativa a `find` y `update` de `usuarios` e `insert` en `eventosSeguridad`. Crea otra cuenta para el proceso web con `securevaultRuntime`, rol personalizado que permite `find`, `insert`, `update` y `remove` en `usuarios`, `sesiones`, `notas` y `limitesAcceso`; `find` e `insert` en `eventosSeguridad`; además `listCollections` a nivel de base y `listIndexes` sobre las colecciones. No concedas al usuario web permisos DDL. La URI de Atlas negocia TLS; el cliente exige TLS en producción.
3. Prepara las colecciones, validadores e índices una sola vez antes de habilitar la aplicación. Hazlo desde una consola local con acceso temporal permitido en Atlas. En PowerShell, desde la raíz del repositorio:

   ```powershell
   $env:NODE_ENV = 'production'
   $env:DB_NAME = 'securevault'
   $secureUri = Read-Host -AsSecureString 'Pegá la URI Atlas de mantenimiento'
   $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureUri)
   try {
       $env:MONGODB_ADMIN_URI = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
       npm run db:init
   } finally {
       Remove-Item Env:MONGODB_ADMIN_URI -ErrorAction SilentlyContinue
       [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
       Remove-Variable secureUri, ptr
       Remove-Item Env:NODE_ENV, Env:DB_NAME -ErrorAction SilentlyContinue
   }
   ```

   `db:init` aplica validadores e índices y solo usa `MONGODB_ADMIN_URI` cuando `NODE_ENV=production`; requiere `dbAdmin`. `npm run admin -- correo` requiere además `securevaultAdminMaintenance`. No compartas ninguna URI fuera de la terminal o del gestor de secretos. La inicialización no se ejecuta en cada arranque. El servicio web verifica que las colecciones e índices existan y no queda listo si falta esta preparación.
4. En Render, selecciona **New → Blueprint**, conecta `1hellen0/laboratorio-2-`, rama `main`, y confirma el servicio `securevault-laboratorio` en plan **Free** y región Ohio. En el primer alta, pega la URI de la cuenta de ejecución en `MONGODB_URI` cuando Render lo solicite. No reutilices la URI de mantenimiento. `APP_ORIGIN` puede omitirse porque Render provee `RENDER_EXTERNAL_URL`. El Blueprint fija `autoDeployTrigger: checksPass`: cada push a `main` llega a producción solo si el check CI de GitHub concluye satisfactoriamente.
5. Tras crear el servicio, permite sus rangos de salida en Atlas, espera el despliegue y comprueba `https://<subdominio-asignado>.onrender.com/health` y `/`. Render ofrece TLS y redirección de HTTP a HTTPS. El plan gratuito puede dormir tras 15 minutos sin tráfico, tardar cerca de un minuto en reactivarse y reiniciarse; por eso la URL sirve para la evaluación, pero no promete respuesta inmediata al primer acceso ni alta disponibilidad.

### Variables para producción

| Variable | Dónde y quién la configura |
|---|---|
| `NODE_ENV=production`, `DB_NAME=securevault`, `TRUST_PROXY_HOPS=1`, `DATA_KEY_VERSION=1` | Valores del Blueprint Render. |
| `MONGODB_URI` | Render Environment: URI Atlas de la cuenta web con rol personalizado. |
| `DATA_ENCRYPTION_KEY`, `SESSION_SECRET`, `RATE_LIMIT_SECRET` | Render los genera en el primer Blueprint y conserva entre despliegues; respalda la llave de cifrado de forma cifrada y restringida. |
| `APP_ORIGIN` | Opcional en Render; si falta, se usa `RENDER_EXTERNAL_URL`. En local usa `.env`. |
| `MONGODB_ADMIN_URI` | URI de cuenta Atlas con `dbAdmin` y `securevaultAdminMaintenance`; solo consola local para inicializar o promover un usuario, nunca el servicio web. |
| `RESEND_API_KEY`, `MAIL_FROM` | Opcionales mientras se evalúan registro, notas e ingreso. Para habilitar recuperación, agrega la clave de Resend y un remitente de un dominio verificado en Render Environment. |

La revisión local encontró `.env` con variables de aplicación, pero sin `RESEND_API_KEY` ni `MAIL_FROM`; eso no confirma si existen en el panel de Resend. Sin ambas variables y un remitente habilitado, el servicio inicia, pero el correo de recuperación no se entrega. Resend solo puede comprobarse tras configurar y verificar el dominio/remitente y probar un envío.

## Rutas

- `/` registro e ingreso
- `/notas` listado y creación de notas
- `/notas/:id` lectura, edición y eliminación de una nota propia
- `/perfil` teléfono enmascarado
- `/recuperacion` y `/restablecer` recuperación local o por API en producción
- `/admin` lista paginada de usuarios y bitácora
- `/health` estado sin detalles internos

La interfaz y la API comparten origen. Las operaciones de escritura validan `Origin` y el encabezado propio de la aplicación como control CSRF.
