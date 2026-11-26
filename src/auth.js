import { timingSafeEqual } from 'node:crypto';
import { parse as parseCookie } from 'cookie';
import { email, fail, fields, fresh, hashId, hashPassword, mac, policy, verifyPassword } from './security.js';

export async function authentication({app, db, config, now, event, limits}) {
  const users = db.collection('usuarios'), sessions = db.collection('sesiones');
  const dummyHash = await hashPassword(fresh());
  const options = { httpOnly:true, secure:config.prod, sameSite:'lax', path:'/' };
  const duration = 8*60*60*1000;
  function sessionId(req) {
    const value = parseCookie(req.headers.cookie || '')[config.cookieName] || '';
    const parts = /^([\w-]{43})\.([\w-]{43})$/.exec(value);
    if (!parts || !timingSafeEqual(Buffer.from(mac(config.sessionKey, parts[1])), Buffer.from(parts[2]))) return null;
    return hashId(parts[1]);
  }
  app.use(async (req, res, next) => {
    const id = sessionId(req);
    if (id) {
      const session = await sessions.findOne({_id:id, expiraEn:{$gt:now()}});
      if (session) req.user = await users.findOne({_id:session.usuarioId, versionAcceso:session.versionAcceso},
        {projection:{_id:1,nombre:1,rol:1}});
    }
    res.locals.user = req.user;
    next();
  });
  app.post('/api/registro', async (req,res) => {
    const data = fields(req.body, ['nombre','correo','contrasena']);
    const correo=email(data.correo), nombre=data.nombre.trim();
    if (!nombre || [...nombre].length > 80) fail(400,'Nombre inválido.');
    policy(data.contrasena);
    const hashContrasena = await hashPassword(data.contrasena);
    try { await users.insertOne({nombre,correo,hashContrasena,rol:'usuario',versionAcceso:1}); }
    catch (err) { if (err.code === 11000) fail(409,'No se pudo registrar esa cuenta.'); throw err; }
    res.status(201).json({mensaje:'Cuenta creada.'});
  });
  app.post('/api/ingreso', async (req,res) => {
    const data=fields(req.body,['correo','contrasena']), correo=email(data.correo);
    if ([...data.contrasena].length > 128) fail(400,'Entrada inválida.');
    await limits.beforeLogin(req, res, correo);
    const user = await users.findOne({correo},{projection:{hashContrasena:1,versionAcceso:1}});
    const valid = await verifyPassword(data.contrasena, user?.hashContrasena || dummyHash);
    if (!valid || !user) {
      await event(req,'ingreso','fallido',user?._id);
      await limits.failed(req,res,correo);
      fail(401,'Credenciales inválidas.');
    }
    await limits.success(correo);
    const old = sessionId(req);
    if (old) await sessions.deleteOne({_id:old});
    const token=fresh(), created=now();
    await sessions.insertOne({_id:hashId(token), usuarioId:user._id, versionAcceso:user.versionAcceso,
      creadaEn:created, expiraEn:new Date(+created+duration)});
    await event(req,'ingreso','correcto',user._id);
    res.cookie(config.cookieName,token+'.'+mac(config.sessionKey,token),{...options,maxAge:duration}).json({mensaje:'Sesión iniciada.'});
  });
  app.post('/api/salida', async (req,res) => {
    fields(req.body,[]);
    const id=sessionId(req);
    if (id) await sessions.deleteOne({_id:id});
    res.clearCookie(config.cookieName,options).status(204).end();
  });
}
export async function requireUser(req,res,next) {
  if (!req.user) {
    await req.app.locals.recordEvent(req,'acceso','denegado');
    fail(401,'Iniciá sesión.');
  }
  next();
}
