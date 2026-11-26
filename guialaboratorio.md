Sistema seguro en Node.js:
OWASP Top 10:2025, cifrado, hash y despliegue a
producción
Asignatura: _______________________________ Docente: _______________________
Modalidad: Equipos de 2 a 3 estudiantes Fecha de entrega: _______________________
Duración: 2 semanas (sugerido) Valor: 100 puntos
TAREA PARA MAÑANA (obligatoria antes de la clase): cada equipo debe realizar un Deep Research
sobre despliegue (deploy) de aplicaciones Node.js en producción, siguiendo la guía de la sección 7.
La clase de mañana explicará el despliegue y partirá de lo que ustedes investiguen. Sin esta
investigación no podrán completar la Fase 3 del laboratorio.
1. Propósito del laboratorio
En la industria, una aplicación no se considera terminada cuando «funciona en mi computadora», sino cuando
está en producción, es accesible públicamente y resiste ataques reales. En este laboratorio construirán un
sistema pequeño en Node.js que aplique de forma demostrable las diez categorías del OWASP Top 10:2025,
que use correctamente hash y cifrado, y que finalmente sea desplegado en un servidor de producción
con HTTPS.
Objetivos de aprendizaje
• Identificar y mitigar los riesgos del OWASP Top 10:2025 en una aplicación Node.js real.
• Distinguir cuándo usar hash (irreversible) y cuándo usar cifrado (reversible), y aplicarlos con algoritmos y
parámetros actuales.
• Gestionar secretos y llaves criptográficas sin exponerlos en el código fuente.
• Investigar de forma autónoma y crítica (deep research) las opciones de despliegue y elegir una
justificadamente.
• Publicar la aplicación en producción con HTTPS, configuración segura y verificación posterior al
despliegue.
2. Descripción del sistema: «SecureVault»
Desarrollarán SecureVault, una aplicación web pequeña para guardar notas privadas y datos personales
sensibles. Puede ser una API REST con un frontend sencillo (HTML/EJS o un framework a elección) o una
aplicación renderizada en servidor. El alcance es deliberadamente reducido para que el esfuerzo se
concentre en la seguridad, no en la cantidad de funciones.
Requisitos funcionales mínimos
Laboratorio: Sistema seguro en Node.js - OWASP Top 10:2025, criptografía y despliegue Página 7
3. ¿Cómo se gestionan variables de entorno y secretos en producción? ¿Qué es un gestor de secretos y por
qué no basta con un archivo .env?
4. ¿Qué es un certificado TLS, cómo funciona Let's Encrypt y qué hace HSTS?
5. ¿Qué es un proxy inverso (Nginx, Caddy) y por qué se coloca delante de Node.js? ¿Qué implica trust
proxy en Express?
6. ¿Qué es un gestor de procesos (PM2, systemd) y cuándo deja de ser necesario (contenedores, PaaS)?
7. ¿Qué es CI/CD? Describan un pipeline mínimo con GitHub Actions: instalar con npm ci, ejecutar
pruebas, auditar dependencias y desplegar.
8. ¿Qué opciones de base de datos gestionada existen (p. ej. Neon, Supabase, MongoDB Atlas) y cómo se
asegura la conexión (TLS, listas de IP, usuarios con mínimo privilegio)?
9. ¿Qué cambia entre desarrollo y producción en una app Node.js? (NODE_ENV, logs, manejo de errores,
CORS, cookies).
10. ¿Qué verificaciones de seguridad conviene hacer después del despliegue y con qué herramientas?
Estructura sugerida del informe de investigación
• Resumen ejecutivo (media página).
• Respuestas a las preguntas, con citas.
• Tabla comparativa de tres plataformas.
• Plan de despliegue propuesto para SecureVault: plataforma elegida y justificación, arquitectura
(diagrama simple), manejo de secretos, base de datos, pipeline.
• Lista de referencias.
Laboratorio: Sistema seguro en Node.js - OWASP Top 10:2025, criptografía y despliegue Página 8
8. Entregables finales
• Repositorio Git (acceso para el docente) con historial de commits de todos los integrantes.
• URL de producción funcionando durante el periodo de evaluación.
• README: descripción, instalación local, variables de entorno requeridas (solo nombres, sin valores),
pasos de despliegue.
• Informe de seguridad: tabla que mapee cada categoría del OWASP Top 10:2025 con su mitigación y
evidencia; decisiones criptográficas justificadas; resultados de ZAP, npm audit, securityheaders.com y SSL
Labs; riesgos residuales.
• Informe de Deep Research (Fase 0).
• Demostración en vivo de 10 minutos (o video) mostrando la app en producción y al menos tres ataques
bloqueados.
9. Rúbrica de evaluación
Criterio Excelente Aceptable Insuficiente Pts
Deep Research de
despliegue
Responde todo, compara 3
plataformas, plan justificado y
fuentes de calidad
Respuestas
incompletas o fuentes
débiles
No entregado a tiempo
o sin fuentes
10
Funcionalidad (RF-01 a
RF-08)
Todos los requisitos funcionan
en producción
Faltan 1 o 2 requisitos Faltan 3 o más 10
OWASP Top 10:2025 10 categorías con mitigación y
evidencia verificable
7 a 9 categorías
cubiertas
Menos de 7 o sin
evidencias
30
Hash y cifrado Argon2id/bcrypt,
AES-256-GCM con IV único,
llaves en secretos, análisis de
rotación
Algoritmos correctos
con errores menores
de gestión de llaves
Algoritmos prohibidos o
llaves en el repositorio
20
Despliegue a
producción
HTTPS, secretos gestionados,
BD protegida, CI/CD, reinicio
automático
En línea con HTTPS
pero configuración
incompleta
No desplegado o sin
HTTPS
20
Informe y demostración Claro, con evidencias, riesgos
residuales y demo convincente
Informe correcto pero
superficial
Incompleto o sin demo 10
Total 100
Bonificación (hasta +10): MFA con TOTP, rotación de llaves implementada (campo de versión de llave),
contenedor Docker con usuario no root, escaneo de secretos en CI (p. ej. gitleaks), o alertas enviadas a un
canal externo.
10. Checklist antes de entregar
[ ] El archivo .env no aparece en ningún commit del historial.
[ ] npm audit no reporta vulnerabilidades altas ni críticas.
[ ] Un usuario no puede ver, editar ni borrar notas de otro usuario.
[ ] Las contraseñas en la BD comienzan con $argon2id$ o $2b$.
[ ] El contenido de las notas en la BD es ilegible (base64 con IV, tag y datos).
Laboratorio: Sistema seguro en Node.js - OWASP Top 10:2025, criptografía y despliegue Página 9
[ ] La app responde solo por HTTPS y las cookies tienen HttpOnly, Secure y SameSite.
[ ] Los errores muestran un mensaje genérico; el detalle solo queda en los logs.
[ ] El login devuelve 429 después de varios intentos fallidos.
[ ] Los logs no contienen contraseñas, tokens ni datos sensibles.
[ ] El README explica cómo reproducir el despliegue.
11. Recursos recomendados
• OWASP Top 10:2025 - owasp.org/Top10/2025
• OWASP Cheat Sheet Series: Password Storage, Cryptographic Storage, Authentication, Session
Management, Node.js Security, Nodejs Docker - cheatsheetseries.owasp.org
• Documentación del módulo crypto de Node.js - nodejs.org/api/crypto.html
• Guía de seguridad de Node.js - nodejs.org/en/learn/getting-started/security-best-practices
• Express: buenas prácticas de seguridad y rendimiento en producción - expressjs.com
• OWASP ZAP - zaproxy.org | Mozilla Observatory / securityheaders.com | Qualys SSL Labs -
ssllabs.com/ssltest
Nota ética: las pruebas de ataque se realizan únicamente contra la aplicación propia del equipo.
Escanear o atacar sistemas de terceros, incluidas las aplicaciones de otros equipos sin autorización,