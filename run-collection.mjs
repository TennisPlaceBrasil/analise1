import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {collectGroup,targets,key} from './coletor.mjs';
import {runRetailerPilot} from './retailer-pilot.mjs';
import {retailerCache} from './retailer-cache.mjs';
import {listRequests,planQueue,isRecent,remainingBudget} from './request-queue.mjs';
await mkdir('public',{recursive:true});
let result={schemaVersion:1,generatedAt:new Date().toISOString(),groups:{},warnings:[],requests:{},usage:{days:{},months:{}}};
// Reutiliza os preços publicados; nenhuma varredura da base ao publicar o HTML.
try{const r=await fetch('https://tennisplacebrasil.github.io/analise1/prices.json',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);const value=await r.json();if(value.schemaVersion!==1||!value.groups)throw Error('Cache incompatível');result=value}catch(e){
  // Sem a última publicação, não consulta: evita perder resultados/controle de consumo.
  await writeFile('public/collection-status.json',JSON.stringify({state:'error',message:'Última publicação indisponível; nenhuma pesquisa executada.',checkedAt:new Date().toISOString()}));
  console.log('Última publicação indisponível; nenhuma pesquisa executada.');throw e;
}
result.requests||={};result.usage||={days:{},months:{}};result.usage.days||={};result.usage.months||={};result.warnings=[];
let completed=[],message='Resultados guardados. Nenhuma pesquisa solicitada.',changed=false;
if(process.env.PROCESS_QUEUE==='true'){
  const config=JSON.parse(await readFile('config.json','utf8'));
  const issues=await listRequests();
  const pending=issues.some(i=>i.title?.startsWith('[Pesquisa TP] ')&&['OWNER','MEMBER','COLLABORATOR'].includes(i.author_association));
  if(pending){
    const available=await targets(config),plan=planQueue(issues,available,result.requests);
    completed.push(...plan.completed);
    for(const q of plan.rejected){result.requests[q.number]={key:q.key,state:'rejected',message:'Marca e agrupador não encontrados na planilha.',checkedAt:new Date().toISOString()};completed.push(q.number);changed=true}
    for(const job of plan.jobs){
      const previous=result.groups[job.key];let state='cached';
      if(!isRecent(previous)){
        if(remainingBudget(result.usage)<2){message='Limite de consultas atingido. Solicitações permanecem na fila para o próximo período.';break}
        if(!process.env.FIRECRAWL_API_KEY){message='FIRECRAWL_API_KEY não disponível. Solicitações permanecem na fila.';break}
        const supplierConfig={...config,marketplaces:[],competitors:[]};
        const entry=await collectGroup(supplierConfig,job.brand,job.group);
        // As fontes sem adaptador validado são declaradas, sem tentativas inúteis de API VTEX.
        for(const [category,sources]of [['marketplace',config.marketplaces],['competitor',config.competitors]])for(const source of sources)if(!['Netshoes','Centauro'].includes(source.name))entry.sources.push({source:source.name,category,status:'unavailable',reason:'Integração desta loja ainda não validada; pesquisa não executada.'});
        const single={groups:{[job.key]:entry},warnings:[]};
        await runRetailerPilot(single,{batch:true,targetKeys:[job.key]});
        const calls=single.retailerBatch.calls,now=new Date(),day=now.toISOString().slice(0,10),month=day.slice(0,7);
        result.usage.days[day]=(result.usage.days[day]||0)+calls;result.usage.months[month]=(result.usage.months[month]||0)+calls;
        entry.requestedAt=now.toISOString();result.groups[job.key]=entry;state='partial';
      }
      for(const number of job.numbers){result.requests[number]={key:job.key,state,checkedAt:new Date().toISOString(),message:state==='cached'?'Consulta reaproveitada por até 24 horas.':'Consulta concluída. Confira os resultados por fonte.'};completed.push(number)}changed=true;
      message='Fila processada. Somente modelos solicitados foram consultados.';
    }
  }
}
if(changed)result.generatedAt=new Date().toISOString();
await writeFile('public/prices.json',JSON.stringify(result));
await writeFile('public/retailer-cache.json',JSON.stringify(retailerCache(result)));
await writeFile('public/queue-status.json',JSON.stringify({checkedAt:new Date().toISOString(),message,requests:result.requests,usage:result.usage}));
await writeFile('public/collection-status.json',JSON.stringify({state:'partial',checkedAt:new Date().toISOString(),message,offers:Object.values(result.groups).reduce((n,g)=>n+g.offers.length,0)}));
await writeFile('processed-requests.json',JSON.stringify([...new Set(completed)]));
console.log(message);
