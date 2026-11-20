/** Server-side integration only. Never bundle API tokens into client-side JS. */
export function smithOsClient({baseUrl,token,projectId,fetchFn=globalThis.fetch}={}){
  if(typeof baseUrl!=='string'||typeof token!=='string'||token.length<32)throw new Error('Server-side SMITH OS endpoint and 32+ character token required');
  const origin=new URL(baseUrl);
  if(origin.protocol!=='https:'&&!['127.0.0.1','localhost','::1'].includes(origin.hostname))throw new Error('SMITH OS requires HTTPS except on loopback');
  if(origin.username||origin.password||origin.search||origin.hash)throw new Error('Invalid URL credentials or fragments');
  const allowed=/^[a-z0-9][a-z0-9-]{0,79}$/;
  if(!allowed.test(projectId||''))throw new Error('Invalid project ID');
  const root=origin.href.endsWith('/')?origin.href:origin.href+'/';
  const call=async(path,method='GET',body)=>{
    const u=new URL(path.replace(/^\//,''),root);
    if(u.origin!==origin.origin)throw new Error('Cross-origin API call blocked');
    const res=await fetchFn(u.href,{method,headers:{Authorization:`Bearer ${token}`,Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const data=await res.json();if(!res.ok)throw new Error(`SMITH OS ${res.status}: ${data.error||'API failure'}`);return data;
  };
  return Object.freeze({getSummary:(period)=>call(`api/v1/summary${period?'?period='+encodeURIComponent(period):''}`),
    getMetrics:(period)=>call(`api/v1/projects/${projectId}/metrics${period?'?period='+encodeURIComponent(period):''}`),
    reportMetric:({key,value,period,sourceRef})=>call(`api/v1/projects/${projectId}/metrics`,'POST',{key,value,period,sourceRef}),
    proposeJob:({agent,title,objective,risk='LOW'})=>call('api/v1/jobs','POST',{projectId,agent,title,objective,risk}),
    listJobs:()=>call('api/v1/jobs'),
  });
}
