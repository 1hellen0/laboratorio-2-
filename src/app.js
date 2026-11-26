import express from 'express';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { authentication, requireUser } from './auth.js';
import { fail } from './security.js';
import { vaultRoutes } from './vault.js';
import { rateLimits } from './limits.js';
import { recoveryRoutes } from './recovery.js';
import { adminRoutes } from './admin.js';

export async function createApp({db, reader = db, config, now = () => new Date(), writeLog = line => console.log(line), deliver}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.proxy);
  app.set('view engine','ejs');
  app.set('views',fileURLToPath(new URL('../views/',import.meta.url)));
  app.use(helmet({contentSecurityPolicy:{directives:{
    defaultSrc:["'self'"], scriptSrc:["'self'"], styleSrc:["'self'"], formAction:["'self'"], frameAncestors:["'none'"],
    upgradeInsecureRequests: config.prod ? [] : null
  }},strictTransportSecurity:config.prod ? undefined : false,referrerPolicy:{policy:'no-referrer'}}));
  app.use('/static',express.static(fileURLToPath(new URL('../public/',import.meta.url)),{index:false}));
  app.use((req,res,next)=>{
    req.requestId=randomUUID();
    res.set({'Cache-Control':'no-store','X-Request-Id':req.requestId});
    if (config.prod && !req.secure) return res.redirect(308,config.origin+'/');
    if (!['GET','HEAD'].includes(req.method)) {
      if (req.headers.origin !== config.origin || req.get('X-SecureVault') !== '1') fail(403,'Origen de solicitud inválido.');
      if (!req.is('application/json')) fail(415,'Se requiere JSON.');
    }
    next();
  });
  app.use(express.json({limit:'64kb'}));
  async function event(req,tipo,resultado,objetivoId) {
    const record={tipo,resultado,solicitudId:req.requestId,ocurridoEn:now()};
    if (req.user) record.actorId=req.user._id;
    if (objetivoId) record.objetivoId=objetivoId;
    await db.collection('eventosSeguridad').insertOne({...record});
    writeLog(JSON.stringify(record));
  }
  const ctx={app,db,reader,config,now,event,deliver};
  ctx.limits=rateLimits(ctx);
  app.locals.recordEvent=event;
  app.get('/health',async(req,res)=>{
    await db.command({ping:1},{maxTimeMS:1500});
    res.json({estado:'listo'});
  });
  await authentication(ctx);
  vaultRoutes(ctx);
  recoveryRoutes(ctx);
  adminRoutes(ctx);
  app.get('/',(req,res)=>res.render('inicio'));
  app.get('/cuenta',requireUser,(req,res)=>res.render('cuenta'));
  app.use((req,res)=>res.status(404).json({mensaje:'Recurso no encontrado.'}));
  app.use((err,req,res,next)=>{
    if (res.headersSent) return next(err);
    const status=err.publicStatus || (err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : 503);
    if (status >= 500) writeLog(JSON.stringify({tipo:'error',resultado:'indisponible',solicitudId:req.requestId,clase:err.name === 'MongoServerSelectionError'?'conexion':'operacion'}));
    if (req.path==='/health') return res.status(503).json({estado:'indisponible'});
    res.status(status).json({mensaje:err.publicStatus ? err.message : status>=500?'Servicio temporalmente no disponible.':'Solicitud inválida.',solicitudId:req.requestId});
  });
  return app;
}
