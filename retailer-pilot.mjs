// Piloto manual: lê páginas públicas renderizadas, sem inferir preços pelo texto.
import {matches,key,norm} from './coletor.mjs';
const array=v=>Array.isArray(v)?v:v?[v]:[];
function nodes(value,out=[]){
  if(Array.isArray(value))for(const v of value)nodes(v,out);
  else if(value&&typeof value==='object'){
    if(array(value['@type']).includes('Product'))out.push(value);
    for(const v of Object.values(value))if(v&&typeof v==='object')nodes(v,out);
  }
  return out;
}
function localURL(value,base){try{const u=new URL(value,base),b=new URL(base);return u.protocol==='https:'&&u.hostname.replace(/^www\./,'')===b.hostname.replace(/^www\./,'')?u.href:null}catch{return null}}
export function structuredOffers(html,source,brand,group,pageURL,checkedAt=new Date().toISOString()){
  const out=[],seen=new Set();
  for(const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    let products;try{products=nodes(JSON.parse(script[1]))}catch{continue}
    for(const p of products){
      const pb=typeof p.brand==='string'?p.brand:p.brand?.name;
      // Nunca atribui a marca consultada a um produto sem evidência.
      if(!pb||!matches({brand:pb,productName:p.name},brand,group))continue;
      // Este piloto é de calçados; acessórios com "Corre 5" não são comparáveis.
      if(!norm(p.name).split(' ').includes('TENIS'))continue;
      for(const offer of array(p.offers)){
        if(offer['@type']==='AggregateOffer'||offer.priceCurrency!=='BRL'||!Number.isFinite(Number(offer.price))||Number(offer.price)<=0)continue;
        if(!/^https?:\/\/schema\.org\/InStock$/.test(offer.availability||''))continue;
        if(offer.itemCondition&&!/^https?:\/\/schema\.org\/NewCondition$/.test(offer.itemCondition))continue;
        if(offer.priceValidUntil&&new Date(offer.priceValidUntil+'T23:59:59Z')<new Date(checkedAt))continue;
        const url=localURL(offer.url||p.url||pageURL,source.url);if(!url)continue;
        const id=url+'|'+offer.price;if(seen.has(id))continue;seen.add(id);
        out.push({source:source.name,category:source.category,seller:offer.seller?.name||source.name,title:p.name,sku:p.sku||'',price:Number(offer.price),currency:'BRL',url,checkedAt,match:true,evidence:'merchant_jsonld',condition:'Oferta estruturada na página da loja, com estoque declarado; frete e condições de pagamento devem ser conferidos na oferta.'});
      }
    }
  }
  return out;
}
export function productLinks(links,source,brand,group){
  const query=norm(brand+' '+group.replace(/\s+[MFU]$/i,'')).split(' ');
  return [...new Set(links.map(v=>localURL(v,source.url)).filter(Boolean))].filter(url=>{
    const path=decodeURI(new URL(url).pathname),words=norm(path).split(' ');
    return !/\/busca\//.test(path)&&(/\/p\//.test(path)||/\.html$/.test(path))&&query.every(w=>words.includes(w))&&!words.includes('VANDERLEI');
  }).slice(0,3);
}
export async function runRetailerPilot(result,{apiKey=process.env.FIRECRAWL_API_KEY,fetchImpl=fetch}={}){
  const id=key('OLYMPIKUS','CORRE 5 U'),entry=result.groups[id];
  if(!entry){result.warnings.push('Piloto: CORRE 5 U não encontrado na planilha.');return result}
  if(!apiKey){result.warnings.push('Piloto não executado: configure FIRECRAWL_API_KEY nos Secrets do GitHub.');return result}
  let calls=0;
  const scrape=async url=>{
    if(++calls>8)throw Error('Limite de 8 páginas do piloto atingido');
    const r=await fetchImpl('https://api.firecrawl.dev/v2/scrape',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({url,formats:['rawHtml','links'],onlyMainContent:false,maxAge:0,timeout:45000,location:{country:'BR',languages:['pt-BR']}}),signal:AbortSignal.timeout(55000)});
    // Não registra resposta/URL da API ou credenciais nos logs públicos.
    if(!r.ok)throw Error('Serviço de leitura: HTTP '+r.status);
    const data=await r.json();if(!data.success||!data.data?.rawHtml)throw Error('Serviço não retornou HTML da página');
    const d=data.data;if(d.metadata?.statusCode&&Number(d.metadata.statusCode)>=400)throw Error('Página da loja: HTTP '+d.metadata.statusCode);
    if(d.metadata?.url&&!localURL(d.metadata.url,url))throw Error('Página redirecionada para outro domínio');
    return d;
  };
  for(const source of [{name:'Netshoes',url:'https://www.netshoes.com.br/',category:'marketplace'},{name:'Centauro',url:'https://www.centauro.com.br/',category:'competitor'}]){
    let offers=[],reason,status='no_match',pages=0;
    try{
      const search=new URL('/busca/olympikus-corre-5',source.url).href;
      const data=await scrape(search);pages++;
      offers.push(...structuredOffers(data.rawHtml,source,entry.brand,entry.group,search));
      for(const url of productLinks(data.links||[],source,entry.brand,entry.group)){
        const p=await scrape(url);pages++;offers.push(...structuredOffers(p.rawHtml,source,entry.brand,entry.group,url));
      }
      status=offers.length?'ok':'no_match';reason=offers.length?undefined:'Páginas consultadas sem oferta estruturada comparável em BRL e com estoque.';
    }catch(e){status=offers.length?'ok':'unavailable';reason=e.message}
    entry.offers=entry.offers.filter(o=>o.source!==source.name);
    entry.offers.push(...[...new Map(offers.map(o=>[o.url+'|'+o.price,o])).values()]);
    entry.sources=entry.sources.filter(s=>s.source!==source.name);
    entry.sources.push({source:source.name,category:source.category,status,reason,truncated:true,pages,checkedAt:new Date().toISOString()});
    console.log(source.name+': piloto '+status+' ('+pages+' páginas)');
  }
  result.warnings.push('Piloto manual limitado a CORRE 5 U, Netshoes e Centauro, até 8 páginas. Demais agrupadores usam a coleta de catálogo.');
  return result;
}
