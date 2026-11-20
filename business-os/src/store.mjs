import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
function fresh(){return {schemaVersion:1,metrics:[],jobs:[],audit:[]};}
export function createStore(file){
  let data=fresh();
  let queue=Promise.resolve();
  const init=async()=>{
    try {
      const input=JSON.parse(await readFile(file,'utf8'));
      if(input.schemaVersion!==1||!Array.isArray(input.metrics)||!Array.isArray(input.jobs)||!Array.isArray(input.audit))throw new Error('Invalid persisted store schema');
      data=input;
    }catch(error){if(error.code!=='ENOENT')throw error;await mkdir(dirname(file),{recursive:true});}
    return api;
  };
  const api={
    init,
    snapshot(){return structuredClone(data);},
    mutate(fn){
      const action=queue.then(async()=>{
        const next=structuredClone(data);
        const result=fn(next);
        // Must complete a durable write before replacing in-memory state.
        await mkdir(dirname(file),{recursive:true});
        const temp=`${file}.${randomUUID()}.tmp`;
        await writeFile(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:0o600});
        await rename(temp,file);
        data=next;
        return result;
      });
      queue=action.then(()=>undefined,()=>undefined);
      return action;
    }
  };
  return api;
}
