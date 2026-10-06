import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createHash,timingSafeEqual} from 'node:crypto';
import {collectGroup,targets,key} from './coletor.mjs';
import {runRetailerPilot} from './retailer-pilot.mjs';
import selection from './public/offer-selection.js';
const {limitOffers}=selection;
import {remainingBudget} from './request-queue.mjs';
const digest=value=>createHash('sha256').update(String(value)).digest();
export function createConsultationService(config,{apiKey=process.env.FIRECRAWL_API_KEY,accessCode=process.env.ACCESS_CODE,origin='https://tennisplacebrasil.github.io',targetsImpl=targets,collectImpl=collectGroup,pilotImpl=runRetailerPilot,now=()=>Date.now()}={}){
  const cache=new Map(),pending=new Map(),usage={days:{},months:{}};let tail=Promise.resolve(),catalog=null,catalogTime=0;
  async function available(){if(!catalog||now()-catalogTime>900000){catalog=await targetsImpl(config);catalogTime=now()}return catalog}
  function enqueue(id,job){
    if(pending.has(id))return pending.get(id);
    if(pending.size>=5){const e=Error('Fila ocupada. Tente novamente em alguns minutos.');e.status=429;throw e}
    const task=tail.then(job);tail=task.catch(()=>{});pending.set(id,task);task.finally(()=>pending.delete(id)).catch(()=>{});return task;
  }
  async function consult(q){
    const id=key(q.brand,q.group),scope=q.scope||'all',cacheId=id+'|'+scope,saved=cache.get(cacheId);
    if(saved&&now()-saved.time<86400000)return {...saved.value,cached:true};
    return enqueue(cacheId,async()=>{
      const canonical=(await available()).find(g=>key(g.brand,g.group)===id);
      if(!canonical){const e=Error('Marca e agrupador não encontrados na planilha.');e.status=400;throw e}
      const pages=scope==='official'?0:2;
      if(remainingBudget(usage,new Date(now()))<pages){const e=Error('Limite de pesquisas deste serviço atingido. Tente no próximo período.');e.status=429;throw e}
      // Reserva antes da chamada; uma falha não pode gerar consultas ilimitadas.
      const date=new Date(now()).toISOString(),day=date.slice(0,10),month=date.slice(0,7);usage.days[day]=(usage.days[day]||0)+pages;usage.months[month]=(usage.months[month]||0)+pages;
      const entry=await collectImpl({...config,marketplaces:[],competitors:[]},canonical.brand,canonical.group);
      for(const [category,sources]of [['marketplace',config.marketplaces],['competitor',config.competitors]])for(const source of sources)if(scope==='official'||!['Netshoes','Centauro'].includes(source.name))entry.sources.push({source:source.name,category,status:scope==='official'?'not_requested':'unavailable',reason:scope==='official'?'Consulta restrita ao fornecedor oficial.':'Integração desta loja ainda não validada; pesquisa não executada.'});
      if(scope!=='official'){const single={groups:{[id]:entry},warnings:[]};await pilotImpl(single,{apiKey,batch:true,targetKeys:[id]});}
      entry.offers=limitOffers(entry.offers);
      entry.requestedAt=new Date(now()).toISOString();cache.set(cacheId,{time:now(),value:entry});return {...entry,cached:false};
    });
  }
  return createServer(async(req,res)=>{
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    const send=(status,body)=>{res.writeHead(status);res.end(JSON.stringify(body))};
    if(req.url==='/health'&&req.method==='GET')return send(200,{ready:Boolean(apiKey&&accessCode),queue:pending.size,offerLimits:{official:1,marketplace:2,competitor:1},supplierPages:1,officialOnly:true,retailerMode:'direct-first-v1',retailerPagesPerSource:1});
    if(req.headers.origin!==origin)return send(403,{error:'Origem não autorizada.'});
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}
    if(req.url!=='/consultar'||req.method!=='POST')return send(404,{error:'Rota inexistente.'});
    if(!apiKey||!accessCode)return send(503,{error:'Serviço de pesquisa ainda não configurado.'});
    if(!timingSafeEqual(digest(req.headers.authorization||''),digest('Bearer '+accessCode)))return send(401,{error:'Informe o código de acesso à consulta no painel.'});
    try{
      let body='';for await(const chunk of req){body+=chunk;if(Buffer.byteLength(body)>4096){const e=Error('Solicitação muito grande.');e.status=413;throw e}}
      const q=JSON.parse(body);if(q.scope!==undefined&&!['all','official'].includes(q.scope))throw Error('Fontes inválidas.');if(typeof q.brand!=='string'||typeof q.group!=='string'||!q.brand.trim()||!q.group.trim()||q.brand.length>100||q.group.length>180)throw Error('Marca e agrupador inválidos.');
      return send(200,await consult(q));
    }catch(e){return send(e.status||400,{error:e.status?e.message:'Não foi possível concluir a consulta. Os resultados anteriores foram mantidos.'})}
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const config=JSON.parse(await readFile(new URL('./config.json',import.meta.url),'utf8'));const server=createConsultationService(config,{origin:process.env.ALLOWED_ORIGIN||'https://tennisplacebrasil.github.io'});server.requestTimeout=240000;server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Serviço de consulta iniciado.'));}
