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

## Rutas

- `/` registro e ingreso
- `/notas` listado y creación de notas
- `/notas/:id` lectura, edición y eliminación de una nota propia
- `/perfil` teléfono enmascarado
- `/recuperacion` y `/restablecer` recuperación local o por API en producción
- `/admin` lista paginada de usuarios y bitácora
- `/health` estado sin detalles internos

La interfaz y la API comparten origen. Las operaciones de escritura validan `Origin` y el encabezado propio de la aplicación como control CSRF.
