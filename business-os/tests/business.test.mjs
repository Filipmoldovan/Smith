import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {startServer} from '../src/server.mjs';
import {loadKeys,authenticate} from '../src/security.mjs';
import {smithOsClient} from '../src/client.mjs';

const OWNER='O'.repeat(64),ACADEMY='A'.repeat(64),SUISSE='S'.repeat(64);
const keys=loadKeys(JSON.stringify([{key:OWNER,role:'owner'},{key:ACADEMY,role:'project',projectId:'smith-academy'},{key:SUISSE,role:'project',projectId:'suisse-promoted'}]));
let ctx;
const call=async(path,{token=OWNER,method='GET',body,raw}={})=>{
  const r=await fetch(ctx.url+path,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(raw!==undefined?{body:raw}:body?{body:JSON.stringify(body)}:{})});
  const j=await r.json();return {status:r.status,data:j};
};

test.before(async()=>{
  const dir=await mkdtemp(join(tmpdir(),'smithos-'));const file=join(dir,'private','store.json');
  const {server,address}=await startServer({port:0,host:'127.0.0.1',database:file,keys});
  ctx={server,dir,file,url:'http://127.0.0.1:'+address.port};
});
test.after(async()=>{await new Promise(r=>ctx.server.close(r));await rm(ctx.dir,{recursive:true,force:true});});
test('health exposes no secrets and execution is disabled',async()=>{
  const r=await call('/health',{token:null});assert.equal(r.status,200);assert.equal(r.data.executionEnabled,false);assert.equal(JSON.stringify(r.data).includes(OWNER),false);
});
test('API requires a valid bearer key',async()=>{
  assert.equal((await call('/api/v1/projects',{token:null})).status,401);
  assert.equal((await call('/api/v1/projects',{token:'wrongtoken'})).status,401);
  assert.equal((await call('/api/v1/projects')).status,200);
});
test('project key sees only its own project',async()=>{
  const r=await call('/api/v1/projects',{token:ACADEMY});assert.equal(r.data.projects.length,1);assert.equal(r.data.projects[0].id,'smith-academy');
  const denied=await call('/api/v1/projects/suisse-promoted/metrics',{token:ACADEMY});assert.equal(denied.status,403);
  const owner=await call('/api/v1/projects');assert.equal(owner.data.projects.length,6);
});
test('missing and malformed money is NOT treated as profit',async()=>{
  const r=await call('/api/v1/summary?period=2026-11',{token:SUISSE});assert.equal(r.status,200);assert.equal(r.data.projects.length,1);
  assert.equal(r.data.projects[0].derived.profit_minor,null);assert.equal(r.data.projects[0].currency,'CHF');
  assert.equal((await call('/api/v1/summary?period=2026-13')).status,400);
});
test('project can report metrics only for itself with provenance',async()=>{
  const body={key:'revenue_minor',value:100050,period:'2026-11',sourceRef:'stripe-report:2026-11:academy'};
  assert.equal((await call('/api/v1/projects/smith-academy/metrics',{token:ACADEMY,method:'POST',body})).status,200);
  assert.equal((await call('/api/v1/projects/suisse-promoted/metrics',{token:ACADEMY,method:'POST',body})).status,403);
  const report=await call('/api/v1/projects/smith-academy/metrics?period=2026-11',{token:ACADEMY});
  assert.equal(report.data.values.revenue_minor,100050);assert.equal(report.data.derived.profit_minor,null);
});
test('correct margin and fractional conversion with real inputs',async()=>{
  for(const body of [{key:'costs_minor',value:75000},{key:'leads',value:20},{key:'conversions',value:3}]){
    const r=await call('/api/v1/projects/smith-academy/metrics',{token:ACADEMY,method:'POST',body:{...body,period:'2026-11',sourceRef:'verified:pilot-fixture'}});assert.equal(r.status,200);
  }
  const result=await call('/api/v1/projects/smith-academy/metrics?period=2026-11',{token:ACADEMY});
  assert.equal(result.data.derived.profit_minor,25050);assert.equal(result.data.derived.conversion_rate_pct,15);
});
test('rejects metrics with negative, fraction, extra size, invalid key or unprovenanced source',async()=>{
  for(const body of [
    {key:'revenue_minor',value:-100,period:'2026-11',sourceRef:'report-1'},
    {key:'revenue_minor',value:1.2,period:'2026-11',sourceRef:'report-1'},
    {key:'secret',value:123,period:'2026-11',sourceRef:'report-1'},
    {key:'costs_minor',value:2,period:'2026-11',sourceRef:'<script>bad</script>'}]){
    assert.equal((await call('/api/v1/projects/smith-academy/metrics',{token:ACADEMY,method:'POST',body})).status,400);
  }
  assert.equal((await call('/api/v1/jobs',{method:'POST',raw:'z'.repeat(20000)})).status,413);
});
test('upserting a metric does not duplicate entries and creates audit trail',async()=>{
  await call('/api/v1/projects/smith-academy/metrics',{token:ACADEMY,method:'POST',body:{key:'revenue_minor',value:80000,period:'2026-11',sourceRef:'test:updated-source'}});
  const result=await call('/api/v1/projects/smith-academy/metrics?period=2026-11');
  assert.equal(result.data.metrics.filter(x=>x.key==='revenue_minor').length,1);assert.equal(result.data.values.revenue_minor,80000);
  assert.equal((await call('/api/v1/audit',{token:ACADEMY})).status,403);
  const audit=await call('/api/v1/audit');assert.ok(audit.data.events.some(x=>x.action==='metric.updated'));
});
test('projects are not aggregated across currencies',async()=>{
  const r=await call('/api/v1/summary?period=2026-11');const ro=r.data.projects.find(x=>x.id==='smith-academy');const ch=r.data.projects.find(x=>x.id==='suisse-promoted');
  assert.equal(ro.currency,'RON');assert.equal(ch.currency,'CHF');assert.equal(r.data.totalRevenue,undefined);
});
let draftId;
test('project agent proposes DRAFT only, cannot approve or execute',async()=>{
  const r=await call('/api/v1/jobs',{token:ACADEMY,method:'POST',body:{projectId:'smith-academy',agent:'finance',title:'Audit of course costs',objective:'Check the financial inputs against actual invoices',risk:'LOW'}});
  assert.equal(r.status,201);assert.equal(r.data.job.status,'DRAFT');assert.equal(r.data.executionEnabled,false);draftId=r.data.job.id;
  assert.equal((await call(`/api/v1/jobs/${draftId}/approve`,{token:ACADEMY,method:'POST'})).status,403);
  assert.equal((await call('/api/v1/jobs/execute',{method:'POST'})).status,404);
});
test('cross-project agent task proposal is denied',async()=>{
  const r=await call('/api/v1/jobs',{token:ACADEMY,method:'POST',body:{projectId:'suisse-promoted',agent:'research',title:'Cross tenant task',objective:'This must never be accepted by the backend',risk:'HIGH'}});assert.equal(r.status,403);
  const rows=await call('/api/v1/jobs',{token:SUISSE});assert.equal(rows.data.jobs.length,0);
});
test('owner can explicitly approve; repeat approval is refused; no execution triggered',async()=>{
  const ok=await call(`/api/v1/jobs/${draftId}/approve`,{method:'POST'});assert.equal(ok.status,200);assert.equal(ok.data.job.status,'APPROVED');assert.equal(ok.data.executionEnabled,false);
  const conflict=await call(`/api/v1/jobs/${draftId}/approve`,{method:'POST'});assert.equal(conflict.status,409);
  const own=await call('/api/v1/jobs',{token:ACADEMY});assert.equal(own.data.jobs.length,1);
  assert.equal((await call('/api/v1/audit')).data.events.some(x=>x.action==='job.approved'),true);
});
test('rejects unknown agent and malformed JSON',async()=>{
  assert.equal((await call('/api/v1/jobs',{method:'POST',body:{projectId:'smith-academy',agent:'run_shell',title:'Run command',objective:'Execute something unsafe please',risk:'HIGH'}})).status,400);
  assert.equal((await call('/api/v1/jobs',{method:'POST',raw:'{"'})).status,400);
});
test('no insecure non-loopback bind allowed',async()=>{
  await assert.rejects(startServer({host:'0.0.0.0',port:0,keys,database:ctx.file}),/acknowledgement/);
});
test('server-side client works for one tenant and blocks insecure hosts',async()=>{
  const client=smithOsClient({baseUrl:ctx.url,token:ACADEMY,projectId:'smith-academy'});
  assert.equal((await client.getMetrics('2026-11')).projectId,'smith-academy');
  assert.equal((await client.listJobs()).jobs.length,1);
  assert.throws(()=>smithOsClient({baseUrl:'http://not-local.test',token:ACADEMY,projectId:'smith-academy'}),/HTTPS/);
  assert.throws(()=>smithOsClient({baseUrl:ctx.url,token:'short',projectId:'smith-academy'}),/32/);
});
test('file is persisted without plaintext keys and remains valid JSON',async()=>{
  const data=await readFile(ctx.file,'utf8');assert.equal(data.includes(OWNER),false);assert.equal(data.includes(ACADEMY),false);
  const snap=JSON.parse(data);assert.ok(snap.metrics.length>=4);assert.ok(snap.audit.length>=6);
});
test('loadKeys rejects malformed and weak or duplicated secrets',()=>{
  assert.throws(()=>loadKeys('invalid'));
  assert.throws(()=>loadKeys(JSON.stringify([{key:'weak',role:'owner'}])));
  assert.throws(()=>loadKeys(JSON.stringify([{key:OWNER,role:'owner'},{key:OWNER,role:'owner'}])));
  assert.throws(()=>loadKeys(JSON.stringify([{key:OWNER,role:'project',projectId:'not-exist'}])));
});
