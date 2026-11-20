import {createHash, timingSafeEqual} from 'node:crypto';
import {PROJECT_IDS} from './constants.mjs';
const TOKEN_RE = /^[A-Za-z0-9_\-=.]{32,256}$/;
export function keyDigest(key){return createHash('sha256').update(key,'utf8').digest();}
export function loadKeys(raw){
  let parsed;
  try {parsed=JSON.parse(raw);} catch {throw new Error('SMITH_OS_KEYS_JSON must be valid JSON');}
  if(!Array.isArray(parsed)||parsed.length===0||parsed.length>100)throw new Error('At least one API key entry is required');
  const seen=new Set();
  return parsed.map((k,i)=>{
    if(!k||!TOKEN_RE.test(k.key||''))throw new Error(`Key ${i+1} must be 32-256 URL-safe characters`);
    if(!['owner','project'].includes(k.role))throw new Error(`Invalid role for key ${i+1}`);
    if(k.role==='project'&&!PROJECT_IDS.has(k.projectId))throw new Error(`Invalid projectId for key ${i+1}`);
    if(k.role==='owner'&&k.projectId!==undefined)throw new Error('Owner key cannot be tied to a project');
    const digest=keyDigest(k.key),fingerprint=digest.toString('hex');
    if(seen.has(fingerprint))throw new Error('Duplicate API keys are forbidden');
    seen.add(fingerprint);
    return Object.freeze({digest,role:k.role,projectId:k.role==='project'?k.projectId:null,actor:k.role==='owner'?'owner':k.projectId});
  });
}
export function authenticate(req,keys){
  const header=req.headers.authorization;
  if(typeof header!=='string'||!header.startsWith('Bearer '))return null;
  const token=header.slice(7);
  if(!TOKEN_RE.test(token))return null;
  const digest=keyDigest(token);
  // Compare every digest to avoid timing leaking which key was matched.
  let match=null;
  for(const entry of keys){if(timingSafeEqual(digest,entry.digest))match=entry;}
  return match;
}
export function allowed(auth,projectId){return Boolean(auth&&(auth.role==='owner'||auth.projectId===projectId));}
