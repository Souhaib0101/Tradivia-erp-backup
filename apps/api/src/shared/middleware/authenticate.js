import jwt from 'jsonwebtoken'; import {env} from '../../config/env.js';
export const authenticate=(req,res,next)=>{const token=req.headers.authorization?.replace(/^Bearer\s+/,'');if(!token)return res.status(401).json({error:'Authentification requise.'});try{req.user=jwt.verify(token,env.jwtSecret);next();}catch{return res.status(401).json({error:'Session invalide.'});}};
export const authorize=(...roles)=>(req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:'Accès refusé.'});
