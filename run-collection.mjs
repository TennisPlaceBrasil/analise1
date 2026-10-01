import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {collectAll} from './coletor.mjs';
import {runRetailerPilot} from './retailer-pilot.mjs';
import {retailerCache,mergeRetailerCache} from './retailer-cache.mjs';
await mkdir('public',{recursive:true});
let status;
try {
  const config=JSON.parse(await readFile('config.json','utf8'));
  const result=await collectAll(config);
  // Preserva a última consulta das lojas com sua data original, por até 7 dias.
  let cache;try{
    const r=await fetch('https://tennisplacebrasil.github.io/analise1/retailer-cache.json',{signal:AbortSignal.timeout(15000)});
    if(r.ok){const value=await r.json();if(value.schemaVersion===1&&value.groups)cache=value}
  }catch{}
  if(!cache)try{cache=JSON.parse(await readFile('data/retailer-cache.json','utf8'))}catch{}
  mergeRetailerCache(result,cache);
  if(process.env.RETAILER_PILOT==='true')await runRetailerPilot(result);
  await writeFile('public/retailer-cache.json',JSON.stringify(retailerCache(result)));
  const offers=Object.values(result.groups).reduce((n,g)=>n+g.offers.length,0);
  await writeFile('public/prices.json',JSON.stringify(result));
  status={state:offers?'partial':'error',checkedAt:new Date().toISOString(),offers,message:offers?'Coleta executada. Confira as fontes indisponíveis e a data das ofertas.':'A coleta não encontrou ofertas válidas. Consulte o resultado por fonte.'};
}catch(e){status={state:'error',checkedAt:new Date().toISOString(),offers:0,message:e.message};}
await writeFile('public/collection-status.json',JSON.stringify(status));
console.log(JSON.stringify(status));
// Publica a interface e o diagnóstico, sem apresentar a coleta como pronta.
