import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {collectAll} from './coletor.mjs';
import {runRetailerPilot} from './retailer-pilot.mjs';
await mkdir('public',{recursive:true});
let status;
try {
  const config=JSON.parse(await readFile('config.json','utf8'));
  const result=await collectAll(config);
  if(process.env.RETAILER_PILOT==='true')await runRetailerPilot(result);
  const offers=Object.values(result.groups).reduce((n,g)=>n+g.offers.length,0);
  await writeFile('public/prices.json',JSON.stringify(result));
  status={state:offers?'partial':'error',checkedAt:new Date().toISOString(),offers,message:offers?'Coleta executada. Confira as fontes indisponíveis e a data das ofertas.':'A coleta não encontrou ofertas válidas. Consulte o resultado por fonte.'};
}catch(e){status={state:'error',checkedAt:new Date().toISOString(),offers:0,message:e.message};}
await writeFile('public/collection-status.json',JSON.stringify(status));
console.log(JSON.stringify(status));
// Publica a interface e o diagnóstico, sem apresentar a coleta como pronta.
