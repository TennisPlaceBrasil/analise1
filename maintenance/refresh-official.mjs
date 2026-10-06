import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {collectGroup,targets,key} from '../coletor.mjs';
import selection from '../public/offer-selection.js';
const {limitOffers}=selection;
const config=JSON.parse(await readFile('config.json','utf8'));
await mkdir('refresh-work',{recursive:true});
const mode=process.argv[2];
if(mode==='prepare'){
 const r=await fetch('https://tennisplacebrasil.github.io/analise1/prices.json',{signal:AbortSignal.timeout(30000)});
 if(!r.ok)throw Error('Não foi possível preservar a publicação: HTTP '+r.status);
 const old=await r.json();if(old.schemaVersion!==1||!old.groups)throw Error('Publicação incompatível');
 const groups=await targets(config);
 await writeFile('refresh-work/previous.json',JSON.stringify(old));
 await writeFile('refresh-work/targets.json',JSON.stringify(groups));
 console.log('matrix='+JSON.stringify(config.suppliers.map((s,i)=>({index:i,brand:s.brand}))));
}else if(mode==='brand'){
 const index=Number(process.argv[3]),supplier=config.suppliers[index];
 if(!supplier)throw Error('Marca inválida');
 const groups=JSON.parse(await readFile('refresh-work/targets.json','utf8')).filter(g=>g.brand===supplier.brand);
 const c={...config,suppliers:[supplier],marketplaces:[],competitors:[]},entries={};
 let stopped=null,cursor=0;
 async function worker(){while(cursor<groups.length){
  const g=groups[cursor++],id=key(g.brand,g.group);
  let entry;
  if(stopped)entry={...g,offers:[],sources:[{source:g.brand,category:'official',status:'unavailable',reason:stopped,checkedAt:new Date().toISOString()}]};
  else {
   entry=await collectGroup(c,g.brand,g.group);
   const s=entry.sources.find(s=>s.category==='official');
   if(s?.status==='unavailable'&&/HTTP (403|404|429)|Moeda brasileira|Formato de catálogo|Catálogo público não/.test(s.reason||''))stopped=s.reason;
  }
  entry.offers=limitOffers(entry.offers);entries[id]=entry;
  await writeFile('refresh-work/brand-'+index+'.json',JSON.stringify(entries));
 }}
 // Primeira consulta confirma se a fonte aceita a rota; evita repetir bloqueios.
 if(groups.length){cursor=0;const g=groups[cursor++];const entry=await collectGroup(c,g.brand,g.group);entries[key(g.brand,g.group)]=entry;
 const s=entry.sources.find(s=>s.category==='official');if(s?.status==='unavailable'&&/HTTP (403|404|429)|Moeda brasileira|Formato de catálogo|Catálogo público não/.test(s.reason||''))stopped=s.reason;}
 await Promise.all([worker(),worker(),worker()]);
 await writeFile('refresh-work/brand-'+index+'.json',JSON.stringify(entries));
 console.log(supplier.brand+': '+groups.length+' agrupadores; '+Object.values(entries).filter(e=>e.offers.length).length+' com preço oficial.'+(stopped?' Fonte indisponível: '+stopped:''));
}else if(mode==='merge'){
 const old=JSON.parse(await readFile('refresh-work/previous.json','utf8'));
 const groups=JSON.parse(await readFile('refresh-work/targets.json','utf8')),fresh={};
 for(const f of await readdir('refresh-work'))if(/^brand-\d+\.json$/.test(f))Object.assign(fresh,JSON.parse(await readFile('refresh-work/'+f,'utf8')));
 const report={checkedAt:new Date().toISOString(),scope:'official',brands:{}};
 for(const g of groups){
  const id=key(g.brand,g.group),previous=old.groups[id]||{...g,offers:[],sources:[]};
  let entry=fresh[id];
  if(!entry)entry={...g,offers:[],sources:[{source:g.brand,category:'official',status:config.suppliers.some(s=>s.brand===g.brand)?'unavailable':'not_configured',reason:'Fonte oficial não consultada ou não cadastrada.',checkedAt:report.checkedAt}]};
  const s=entry.sources[0],failed=s?.status==='unavailable'&&/HTTP (403|404|429)|Moeda brasileira|Formato de catálogo|Catálogo público não/.test(s.reason||'');
  const preserved=failed?previous.offers.filter(o=>o.category==='official'):[];
  if(preserved.length)s.reason=(s.reason||'Consulta falhou')+'; preço anterior preservado com sua data original.';
  old.groups[id]={...previous,...g,offers:limitOffers([...previous.offers.filter(o=>o.category!=='official'),...entry.offers,...preserved]),sources:[...previous.sources.filter(s=>s.category!=='official'),...entry.sources]};
  const b=report.brands[g.brand]||={groups:0,found:0,noMatch:0,unavailable:0,notConfigured:0,preserved:0};b.groups++;b.found+=entry.offers.length>0;b.noMatch+=s?.status==='no_match';b.unavailable+=failed;b.notConfigured+=s?.status==='not_configured';b.preserved+=preserved.length>0;
 }
 old.generatedAt=report.checkedAt;old.officialRefresh=report;
 await mkdir('public',{recursive:true});
 await writeFile('public/prices.json',JSON.stringify(old));
 await writeFile('public/official-refresh.json',JSON.stringify(report));
 await writeFile('public/config.json',JSON.stringify(config));
 await writeFile('public/collection-status.json',JSON.stringify({state:'partial',checkedAt:report.checkedAt,message:'Atualização oficial por agrupador. Marketplaces e concorrentes preservam a data anterior.'}));
 console.log(JSON.stringify(report));
}else throw Error('Modo inválido');
