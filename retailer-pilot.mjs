// Piloto manual: lê páginas públicas renderizadas, sem inferir preços pelo texto.
import {matches,key,norm} from './coletor.mjs';
import selection from './public/offer-selection.js';
const {limitOffers}=selection;
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
export function centauroOffers(html,source,brand,group,pageURL,checkedAt=new Date().toISOString()){
  if(new URL(source.url).hostname.replace(/^www\./,'')!=='centauro.com.br')return [];
  const script=html.match(/<script\b[^>]*id\s*=\s*["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
  if(!script)return [];
  let data;try{data=JSON.parse(script[1])}catch{return []}
  const out=[],seen=new Set();
  const add=(p,price,currency,url,sku,seller,condition)=>{
    if(currency!=='BRL'||!Number.isFinite(Number(price))||Number(price)<=0)return;
    if(!matches({brand:p.brand,productName:p.name},brand,group,{requireGender:true})||!norm(p.name).split(' ').includes('TENIS'))return;
    const link=localURL(url,source.url);if(!link)return;
    const id=link+'|'+sku+'|'+seller+'|'+price;if(seen.has(id))return;seen.add(id);
    out.push({source:source.name,category:source.category,seller,title:p.name,sku:sku||'',price:Number(price),currency:'BRL',url:link,checkedAt,match:true,evidence:'merchant_embedded_json',condition});
  };
  for(const block of Object.values(data.props?.pageProps?.fallback||{})){
    // Resultado de busca: usa o preço do cartão específico, nunca lowPrice/highPrice.
    for(const p of block?.products||[]){
      if(p.status!=='available'||p.seo?.aggregateOffer?.availability!=='InStock')continue;
      add({name:p.name,brand:p.details?.brand},p.price,p.seo?.aggregateOffer?.priceCurrency,p.url,p.id,p.details?.sellerName||source.name,'Preço anunciado no resultado da loja; disponibilidade declarada. Frete e condições de pagamento devem ser conferidos na oferta.');
    }
    // Página de produto: cada tamanho tem seu próprio preço e estoque.
    const p=block?.product;if(!p||p.isAvailable!==true||p.hasStock!==true)continue;
    const currency=block.seo?.schema?.product?.aggregateOffer?.priceCurrency;
    for(const size of p.sizes||[]){
      if(size.hasStock!==true||size.isAvailable!==true)continue;
      const price=size.priceInfos?.promotionalPrice??size.priceInfos?.price;
      // Preserva a cor consultada, pois o endereço canônico pode omiti-la.
      const url=localURL(pageURL,source.url);if(!url)continue;
      add(p,price,currency,url,size.sku,size.sellerInfo?.name||source.name,'Preço do tamanho '+size.description+' na página da loja, com estoque declarado; desconto Pix e frete não incluídos.');
    }
  }
  return out;
}
function pageOffers(html,source,brand,group,url){return [...structuredOffers(html,source,brand,group,url),...centauroOffers(html,source,brand,group,url)]}
export function structuredOffers(html,source,brand,group,pageURL,checkedAt=new Date().toISOString()){
  const out=[],seen=new Set();
  for(const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
    let products;try{products=nodes(JSON.parse(script[1]))}catch{continue}
    for(const p of products){
      const pb=typeof p.brand==='string'?p.brand:p.brand?.name;
      // Nunca atribui a marca consultada a um produto sem evidência.
      if(!pb||!matches({brand:pb,productName:p.name},brand,group,{requireGender:true}))continue;
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
  const query=norm(brand+' '+norm(group).replace(/\s+[MFU]$/i,'')).split(' ');
  return [...new Set(links.map(v=>localURL(v,source.url)).filter(Boolean))].filter(url=>{
    const path=decodeURI(new URL(url).pathname),words=norm(path).split(' ');
    return !/\/busca\//.test(path)&&(/\/p\//.test(path)||/\.html$/.test(path))&&query.every(w=>words.includes(w))&&!words.includes('VANDERLEI');
  }).slice(0,3);
}
export function batchTargets(result,brand='OLYMPIKUS'){
  const age=g=>Math.max(0,...g.sources.filter(s=>['Netshoes','Centauro'].includes(s.source)&&Number.isInteger(s.pages)).map(s=>Date.parse(s.checkedAt)||0));
  return Object.entries(result.groups)
    // Nesta fase, amplia apenas os agrupadores identificados como tênis no catálogo.
    .filter(([,g])=>norm(g.brand)===norm(brand)&&g.offers.some(o=>norm(o.title).split(' ').includes('TENIS')))
    .sort((a,b)=>age(a[1])-age(b[1])||a[1].group.localeCompare(b[1].group,'pt-BR'))
    .slice(0,5).map(([id])=>id);
}
export async function runRetailerPilot(result,{apiKey=process.env.FIRECRAWL_API_KEY,fetchImpl=fetch,targetKeys=[key('OLYMPIKUS','CORRE 5 U')],batch=false,directFetchImpl=fetch}={}){
  const targets=targetKeys.map(id=>result.groups[id]).filter(Boolean).slice(0,batch?5:1);
  result.retailerBatch={mode:batch?'batch':'pilot',groups:[],calls:0};
  if(!targets.length){result.retailerBatch.message='Nenhum agrupador de tênis elegível para esta marca na coleta de catálogo.';result.warnings.push(result.retailerBatch.message);return result}
  let calls=0;
  const scrape=async url=>{
    if(++calls>targets.length*2)throw Error('Limite de páginas desta execução atingido');
    const r=await fetchImpl('https://api.firecrawl.dev/v2/scrape',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({url,formats:['rawHtml','links'],onlyMainContent:false,maxAge:0,timeout:45000,location:{country:'BR',languages:['pt-BR']}}),signal:AbortSignal.timeout(55000)});
    // Não registra resposta/URL da API ou credenciais nos logs públicos.
    if(!r.ok)throw Error('Serviço de leitura: HTTP '+r.status);
    const data=await r.json();if(!data.success||!data.data?.rawHtml)throw Error('Serviço não retornou HTML da página');
    const d=data.data;if(d.metadata?.statusCode&&Number(d.metadata.statusCode)>=400)throw Error('Página da loja: HTTP '+d.metadata.statusCode);
    if(d.metadata?.url&&!localURL(d.metadata.url,url))throw Error('Página redirecionada para outro domínio');
    return d;
  };
  for(const entry of targets)for(const source of [{name:'Netshoes',url:'https://www.netshoes.com.br/',category:'marketplace'},{name:'Centauro',url:'https://www.centauro.com.br/',category:'competitor'}]){
    let offers=[],reason,status='no_match',pages=0,directPages=0,method='direct';
    try{
      const term=norm(entry.brand+' '+norm(entry.group).replace(/\s+[MFU]$/i,'')).toLowerCase().replaceAll(' ','-');
      const search=new URL('/busca/'+term,source.url).href;
      // Uma página de busca por fonte. Firecrawl só é usado quando a leitura
      // pública direta falha ou não contém uma oferta válida para o modelo.
      let directError;
      try{
        const r=await directFetchImpl(search,{headers:{Accept:'text/html','User-Agent':'TennisPlacePriceAnalysis/1.0'},signal:AbortSignal.timeout(20000)});
        directPages++;
        if(!r.ok)throw Error('Página da loja: HTTP '+r.status);
        if(r.url&&!localURL(r.url,search))throw Error('Página redirecionada para outro domínio');
        const html=await r.text();
        offers=pageOffers(html,source,entry.brand,entry.group,search);
        if(!offers.length)throw Error('Página direta sem oferta estruturada comparável');
      }catch(e){directError=e.message}
      if(!offers.length){
        if(!apiKey)throw Error(directError+'; Firecrawl não configurado para alternativa.');
        method='firecrawl';
        const data=await scrape(search);pages++;
        offers=pageOffers(data.rawHtml,source,entry.brand,entry.group,search);
      }
      status=offers.length?'ok':'no_match';reason=offers.length?undefined:'Páginas consultadas sem oferta estruturada comparável em BRL e com estoque.';
    }catch(e){status=offers.length?'ok':'unavailable';reason=e.message}
    const previous=entry.offers.filter(o=>o.source===source.name);
    const preserved=status==='unavailable'&&previous.length>0;
    entry.offers=entry.offers.filter(o=>o.source!==source.name);
    entry.offers.push(...(preserved?previous:limitOffers(offers)));
    if(preserved)reason+=' Preços anteriores preservados com suas datas originais.';
    entry.sources=entry.sources.filter(s=>s.source!==source.name);
    entry.sources.push({source:source.name,category:source.category,status,reason,truncated:true,pages,directPages,method,preserved,checkedAt:new Date().toISOString()});
    console.log(entry.brand+'/'+entry.group+' · '+source.name+': '+status+' ('+pages+' páginas)');
  }
  result.warnings.push('Consulta restrita aos modelos solicitados: uma página por loja, até 2 anúncios Netshoes e 1 Centauro. Firecrawl apenas como alternativa à leitura direta.');
  result.retailerBatch={mode:batch?'batch':'pilot',groups:targets.map(g=>({brand:g.brand,group:g.group})),calls};
  return result;
}
