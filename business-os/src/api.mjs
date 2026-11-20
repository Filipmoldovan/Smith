import {randomUUID} from 'node:crypto';
import {PROJECTS,PROJECT_IDS,METRICS,AGENTS} from './constants.mjs';
import {authenticate,allowed} from './security.mjs';
const MAX_BYTES=16*1024;
const ID=/^[a-z0-9][a-z0-9-]{0,79}$/;
const MONTH=/^20\d{2}-(0[1-9]|1[0-2])$/;
const SECURITY_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY'};
const localDate=()=>new Date().toISOString();
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
function reply(res,status,payload){res.writeHead(status,SECURITY_HEADERS);res.end(JSON.stringify(payload));}
function err(status,message){throw new HttpError(status,message);}
async function readBody(req){
  const chunks=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>MAX_BYTES)err(413,'Body too large');chunks.push(chunk);}
  let obj;try{obj=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{err(400,'Invalid JSON');}
  if(!obj||Array.isArray(obj)||typeof obj!=='object')err(400,'JSON object required');
  return obj;
}
function sourceRef(str){return typeof str==='string'&&str.length>=3&&str.length<=200&&!/[\r\n<>]/.test(str);}
function validProject(id){if(!PROJECT_IDS.has(id))err(404,'Project not found');}
function scope(auth,id){validProject(id);if(!allowed(auth,id))err(403,'Project not permitted');}
function isText(value,min,max){return typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!/[\u0000-\u001f]/.test(value);}
function sumMetrics(items,projectId,period){
  const values=Object.fromEntries(items.filter(x=>x.projectId===projectId&&x.period===period).map(x=>[x.key,x.value]));
  const rev=values.revenue_minor, cost=values.costs_minor;
  const margin=Number.isSafeInteger(rev)&&Number.isSafeInteger(cost)?rev-cost:null;
  const conversion=Number.isSafeInteger(values.leads)&&values.leads>0&&Number.isSafeInteger(values.conversions)?values.conversions/values.leads:null;
  return {values,derived:{profit_minor:margin,margin_pct:margin!==null&&rev>0?Math.round(margin*10000/rev)/100:null,conversion_rate_pct:conversion!==null?Math.round(conversion*10000)/100:null}};
}
function audit(db,auth,action,projectId,ref){db.audit.push({id:randomUUID(),at:localDate(),actor:auth.actor,action,projectId,ref});if(db.audit.length>20000)db.audit=db.audit.slice(-20000);}
export function createApi({store,keys}){
  const rate=new Map();
  return async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(req.method==='GET'&&url.pathname==='/health')return reply(res,200,{ok:true,service:'SMITH BUSINESS OS',version:'0.1.0',executionEnabled:false});
      if(!url.pathname.startsWith('/api/v1/'))return reply(res,404,{error:'Not found'});
      const auth=authenticate(req,keys);
      if(!auth)err(401,'Authentication required');
      const id=auth.actor,now=Date.now(),record=rate.get(id)||{time:now,count:0};
      if(now-record.time>60000){record.time=now;record.count=0;}
      if(++record.count>120)err(429,'Request rate exceeded');rate.set(id,record);
      if(req.method==='GET'&&url.pathname==='/api/v1/projects')return reply(res,200,{projects:PROJECTS.filter(p=>allowed(auth,p.id)),role:auth.role,executionEnabled:false});
      if(req.method==='GET'&&url.pathname==='/api/v1/summary'){
        const period=url.searchParams.get('period')||new Date().toISOString().slice(0,7);
        if(!MONTH.test(period))err(400,'Invalid period');
        const rows=store.snapshot().metrics;
        return reply(res,200,{period,projects:PROJECTS.filter(p=>allowed(auth,p.id)).map(p=>({...p,...sumMetrics(rows,p.id,period)})),note:'Currency totals are never combined across projects.'});
      }
      let match=url.pathname.match(/^\/api\/v1\/projects\/([^/]+)\/metrics$/);
      if(match){const projectId=match[1];scope(auth,projectId);
        if(req.method==='GET'){
          const period=url.searchParams.get('period')||new Date().toISOString().slice(0,7);
          if(!MONTH.test(period))err(400,'Invalid period');
          const rows=store.snapshot().metrics.filter(x=>x.projectId===projectId&&x.period===period);
          return reply(res,200,{projectId,period,metrics:rows,...sumMetrics(rows,projectId,period)});
        }
        if(req.method==='POST'){
          const body=await readBody(req);
          if(!Object.hasOwn(METRICS,body.key)||!MONTH.test(body.period||'')||!Number.isSafeInteger(body.value)||body.value<0||body.value>1e13||!sourceRef(body.sourceRef))err(400,'Invalid metric payload');
          const result=await store.mutate(db=>{
            const existing=db.metrics.find(m=>m.projectId===projectId&&m.period===body.period&&m.key===body.key);
            if(existing){existing.value=body.value;existing.sourceRef=body.sourceRef;existing.updatedAt=localDate();audit(db,auth,'metric.updated',projectId,existing.id);return existing;}
            const item={id:randomUUID(),projectId,key:body.key,value:body.value,period:body.period,sourceRef:body.sourceRef,updatedAt:localDate()};db.metrics.push(item);audit(db,auth,'metric.created',projectId,item.id);return item;
          });
          return reply(res,200,{metric:result});
        }
        err(405,'Method not allowed');
      }
      if(url.pathname==='/api/v1/jobs'){
        if(req.method==='GET'){
          const status=url.searchParams.get('status');if(status&&!['DRAFT','APPROVED','REJECTED'].includes(status))err(400,'Invalid status');
          const jobs=store.snapshot().jobs.filter(x=>allowed(auth,x.projectId)&&(!status||x.status===status));
          return reply(res,200,{jobs:jobs.slice(-100).reverse(),executionEnabled:false});
        }
        if(req.method==='POST'){
          const b=await readBody(req);scope(auth,b.projectId);
          if(!AGENTS.includes(b.agent)||!isText(b.title,4,140)||!isText(b.objective,8,2000)||!['LOW','MEDIUM','HIGH'].includes(b.risk))err(400,'Invalid job proposal');
          const job=await store.mutate(db=>{const j={id:randomUUID(),projectId:b.projectId,agent:b.agent,title:b.title.trim(),objective:b.objective.trim(),risk:b.risk,status:'DRAFT',createdAt:localDate(),approvedAt:null};db.jobs.push(j);audit(db,auth,'job.proposed',j.projectId,j.id);return j;});
          return reply(res,201,{job,executionEnabled:false});
        }
        err(405,'Method not allowed');
      }
      match=url.pathname.match(/^\/api\/v1\/jobs\/([0-9a-f-]{36})\/(approve|reject)$/);
      if(match&&req.method==='POST'){
        if(auth.role!=='owner')err(403,'Owner approval required');
        const job=await store.mutate(db=>{const j=db.jobs.find(x=>x.id===match[1]);if(!j)err(404,'Job not found');if(j.status!=='DRAFT')err(409,'Job is no longer a draft');j.status=match[2]==='approve'?'APPROVED':'REJECTED';j.approvedAt=localDate();audit(db,auth,`job.${j.status.toLowerCase()}`,j.projectId,j.id);return j;});
        return reply(res,200,{job,executionEnabled:false,message:'Approval recorded. No external action is executed.'});
      }
      if(req.method==='GET'&&url.pathname==='/api/v1/audit'){
        if(auth.role!=='owner')err(403,'Owner access required');
        const projectId=url.searchParams.get('projectId');if(projectId)validProject(projectId);
        return reply(res,200,{events:store.snapshot().audit.filter(x=>!projectId||x.projectId===projectId).slice(-100).reverse()});
      }
      err(404,'Not found');
    }catch(error){
      const code=error instanceof HttpError?error.status:500;
      if(code===500)console.error('BUSINESS_OS_ERROR',error?.stack||error?.message);
      if(!res.headersSent)reply(res,code,{error:code===500?'Internal error':error.message});
    }
  };
}
