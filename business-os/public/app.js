'use strict';
let token='';let role='';let projects=[];
const el=id=>document.getElementById(id);
const notice=text=>{el('message').textContent=text;el('message').hidden=!text;};
const elements=(tag,className,text)=>{const x=document.createElement(tag);if(className)x.className=className;if(text!==undefined)x.textContent=text;return x;};
const month=new Date().toISOString().slice(0,7);el('period').value=month;
async function api(path,{method='GET',data}={}){
  const r=await fetch(path,{method,headers:{Authorization:`Bearer ${token}`,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{})});
  let body;try{body=await r.json();}catch{throw Error('Răspuns invalid de la server');}
  if(!r.ok)throw Error(body.error||`Eroare API ${r.status}`);return body;
}
function metricMoney(value,currency){return value===undefined?'Fără date':new Intl.NumberFormat('ro-RO',{style:'currency',currency}).format(value/100);}
async function refresh(){
  if(!token)return;
  try{
    const [overview,jobs]=await Promise.all([api('/api/v1/summary?period='+encodeURIComponent(el('period').value)),api('/api/v1/jobs')]);
    const grid=el('projects');grid.replaceChildren();
    for(const p of overview.projects){
      const card=elements('article','project'),cat=elements('span','eyebrow',p.category.toUpperCase()),title=elements('h3','',p.name),meta=elements('div','meta',p.repository),metric=elements('div','metric',metricMoney(p.values.revenue_minor,p.currency)),label=elements('small','',' venituri raportate'),foot=elements('div','meta2');
      metric.append(' ');metric.append(label);
      foot.append(elements('span','','Costuri: '+metricMoney(p.values.costs_minor,p.currency)),elements('span','','Profit: '+(p.derived.profit_minor===null?'Fără date':metricMoney(p.derived.profit_minor,p.currency))));
      card.append(cat,title,meta,metric,foot);grid.append(card);
    }
    const list=el('jobs');list.replaceChildren();if(!jobs.jobs.length)list.append(elements('p','empty','Nu există propuneri. Creează prima sarcină de verificare.'));
    for(const j of jobs.jobs){
      const card=elements('article','job'),head=elements('div','inline'),id=projects.find(p=>p.id===j.projectId),tag=elements('span','tag '+j.status,j.status);
      head.append(elements('span','eyebrow',(id?.name||j.projectId)+' · '+j.agent),tag);
      card.append(head,elements('strong','',j.title),elements('p','',j.objective));
      if(role==='owner'&&j.status==='DRAFT'){
        const row=elements('div','buttons');for(const [action,title] of [['approve','Aprobă'],['reject','Respinge']]){
          const b=elements('button','',title);b.type='button';b.addEventListener('click',async()=>{
            if(!confirm(`Confirmi ${action==='approve'?'aprobarea':'respingerea'} sarcinii? Nu se execută automat nicio acțiune externă.`))return;
            try{await api('/api/v1/jobs/'+j.id+'/'+action,{method:'POST'});notice('Decizia a fost înregistrată. Nu s-a executat nicio acțiune externă.');await refresh();}catch(e){notice(e.message);}
          });row.append(b);
        }card.append(row);
      }
      list.append(card);
    }
  }catch(e){notice('Eroare: '+e.message);}
}
el('login').addEventListener('submit',async e=>{
  e.preventDefault();token=el('token').value;el('token').value='';
  try{const d=await api('/api/v1/projects');role=d.role;projects=d.projects;const select=el('jobproject');select.replaceChildren();for(const p of projects){const option=elements('option','',p.name);option.value=p.id;select.append(option);}el('workspace').hidden=false;notice('Conectat. Datele sunt limitate la proiectele permise pentru această cheie.');await refresh();}catch(e){token='';role='';projects=[];el('workspace').hidden=true;notice(e.message);}
});
el('disconnect').addEventListener('click',()=>{token='';role='';projects=[];el('workspace').hidden=true;el('token').value='';notice('Deconectat. Cheia a fost eliminată din memoria paginii.');});
el('refresh').addEventListener('click',refresh);
el('period').addEventListener('change',refresh);
el('jobform').addEventListener('submit',async e=>{
  e.preventDefault();const payload={projectId:el('jobproject').value,agent:el('jobagent').value,title:el('jobtitle').value,objective:el('jobobjective').value,risk:el('jobrisk').value};
  try{await api('/api/v1/jobs',{method:'POST',data:payload});el('jobtitle').value='';el('jobobjective').value='';notice('Propunere salvată ca DRAFT; necesită aprobare umană.');await refresh();}catch(err){notice(err.message);}
});
