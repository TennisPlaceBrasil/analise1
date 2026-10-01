import {matches} from './coletor.mjs';
const evidence=new Set(['merchant_jsonld','merchant_embedded_json']);
const sources=new Map([['Netshoes',{host:'netshoes.com.br',category:'marketplace'}],['Centauro',{host:'centauro.com.br',category:'competitor'}]]);
export function retailerCache(result){
  return {schemaVersion:1,groups:Object.fromEntries(Object.entries(result.groups).flatMap(([id,g])=>{
    const offers=g.offers.filter(o=>evidence.has(o.evidence)&&sources.has(o.source));
    const checks=g.sources.filter(s=>sources.has(s.source)&&(Number.isInteger(s.pages)||offers.some(o=>o.source===s.source)));
    return offers.length||checks.length?[[id,{brand:g.brand,group:g.group,offers,sources:checks}]]:[];
  }))};
}
export function mergeRetailerCache(result,cache,now=Date.now()){
  if(cache?.schemaVersion!==1||!cache.groups||typeof cache.groups!=='object')return;
  const recent=v=>Number.isFinite(Date.parse(v))&&Date.parse(v)<=now+300000&&now-Date.parse(v)<=7*86400000;
  for(const [id,saved]of Object.entries(cache.groups)){
    const current=result.groups[id];if(!current||!Array.isArray(saved.offers)||!Array.isArray(saved.sources))continue;
    const offers=saved.offers.filter(o=>{
      const s=sources.get(o.source);if(!s||o.category!==s.category||!evidence.has(o.evidence)||o.currency!=='BRL'||o.match!==true||!Number.isFinite(Number(o.price))||Number(o.price)<=0||!recent(o.checkedAt)||!matches({brand:saved.brand,productName:o.title},current.brand,current.group))return false;
      try{const u=new URL(o.url);return u.protocol==='https:'&&u.hostname.replace(/^www\./,'')===s.host}catch{return false}
    });
    for(const source of sources.keys()){
      const found=offers.filter(o=>o.source===source),status=saved.sources.find(s=>s.source===source&&recent(s.checkedAt));
      if(!found.length&&!status)continue;
      current.offers=current.offers.filter(o=>o.source!==source);current.offers.push(...found);
      current.sources=current.sources.filter(s=>s.source!==source);
      current.sources.push({...status,source,category:sources.get(source).category,status:found.length?'ok':status?.status==='ok'?'unavailable':status?.status||'unavailable',reason:!found.length&&status?.status==='ok'?'Ofertas guardadas não passaram pela validação.':status?.reason,checkedAt:status?.checkedAt||found[0]?.checkedAt,cached:true});
    }
  }
}
