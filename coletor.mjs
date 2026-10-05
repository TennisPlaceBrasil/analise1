// Node 22+. Coleta em catálogo público; nunca calcula ou inventa preço externo.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
export const norm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/([A-Z])(\d)/g,'$1 $2').replace(/(\d)([A-Z])/g,'$1 $2').replace(/[^A-Z0-9]+/g,' ').trim();
const keyNorm=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]+/g,' ').trim();
export const key=(brand,group)=>keyNorm(brand)+'|'+keyNorm(group);
const aliases={'COCA COLA SHOES':'COCA COLA','ON':'ON RUNNING','ON RUNNING':'ON RUNNING'};
const cleanBrand=b=>aliases[norm(b)]||norm(b);
export function matches(product,brand,group,{requireGender=false}={}){
  if(cleanBrand(product.brand)!==cleanBrand(brand))return false;
  let query=norm(group).split(' ').filter(Boolean);if(['M','F','U'].includes(query.at(-1)))query.pop();
  if(!query.length)return false;
  const title=norm(product.productName).split(' ');
  // Modelo e versão precisam ocorrer em sequência; códigos de fábrica não são descartados.
  const pos=title.findIndex((_,i)=>query.every((t,j)=>title[i+j]===t));
  if(pos<0)return false;
  // Kit não é comparável ao item avulso; versão numérica adicional muda o modelo.
  if(title.some(t=>['KIT','KITS','COMBO'].includes(t)&&!query.includes(t)))return false;
  if(/^\d+$/.test(title[pos+query.length]||''))return false;
  // Evita versões adicionais comuns; matcher conservador pode deixar modelos sem resultado.
  const extra=[...title.slice(0,pos),...title.slice(pos+query.length)];
  if(extra.some(t=>['CARBON','MAX','TRAIL','GTX','GORE','INFANTIL','KIDS','JUNIOR','PRO','SE','SL','VANDERLEI'].includes(t)&&!query.includes(t)))return false;
  const sex=norm(group).split(' ').at(-1);
  const feminine=title.some(t=>['FEMININO','FEMININA'].includes(t)),masculine=title.some(t=>['MASCULINO','MASCULINA'].includes(t)),unisex=title.includes('UNISSEX');
  if(sex==='F'&&masculine&&!unisex)return false;
  if(sex==='M'&&feminine&&!unisex)return false;
  if(requireGender&&sex==='F'&&!feminine&&!unisex)return false;
  if(requireGender&&sex==='M'&&!masculine&&!unisex)return false;
  return true;
}
export function productOffers(products,source,brand,group,checkedAt=new Date().toISOString()){
  const offers=[],seen=new Set();
  for(const p of products){if(!matches(p,brand,group))continue;
    let url;try{url=new URL(p.link||`${p.linkText}/p`,source.url)}catch{continue}
    if(url.protocol!=='https:'||url.hostname.replace(/^www\./,'')!==new URL(source.url).hostname.replace(/^www\./,''))continue;
    for(const sku of p.items||[])for(const seller of sku.sellers||[]){const c=seller.commertialOffer;
      if(!c||!(Number(c.Price)>0)||!(Number(c.AvailableQuantity)>0))continue;
      const dedupe=[url.href,sku.itemId,seller.sellerId].join('|');if(seen.has(dedupe))continue;seen.add(dedupe);
      offers.push({source:source.name,category:source.category,seller:seller.sellerName||source.name,price:Number(c.Price),currency:'BRL',title:p.productName,sku:sku.name||sku.itemId,url:url.href,condition:'Preço do catálogo público; frete e descontos condicionais não incluídos',checkedAt,match:true});
    }
  }
  return offers;
}
async function getJSON(url){const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'TennisPlacePriceAnalysis/1.0'},signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error(`HTTP ${r.status}`);if(!r.headers.get('content-type')?.includes('json'))throw Error('Catálogo público não disponível em JSON');const a=await r.json();if(!Array.isArray(a))throw Error('Formato de catálogo incompatível');return a}
async function catalog(source,term,{pages=1}={}){
  if(source.currency!=='BRL')throw Error('Moeda brasileira não verificada');
  const products=[];let truncated=false;
  for(let i=0;i<pages;i++){const url=new URL('/api/catalog_system/pub/products/search',source.url);url.searchParams.set('ft',term);url.searchParams.set('_from',String(i*50));url.searchParams.set('_to',String(i*50+49));const batch=await getJSON(url);products.push(...batch);if(batch.length<50)return {products,truncated:false};truncated=i===pages-1;}
  return {products,truncated};
}
const config=async()=>JSON.parse(await readFile(new URL('./config.json',import.meta.url),'utf8'));
function sourceList(c,brand){const supplier=c.suppliers.find(s=>cleanBrand(s.brand)===cleanBrand(brand));return [...(supplier?.url?[{name:supplier.brand,url:supplier.url,category:'official',currency:supplier.currency}]:[]),...c.marketplaces.map(s=>({...s,category:'marketplace'})),...c.competitors.map(s=>({...s,category:'competitor'}))]}
export async function collectGroup(c,brand,group){const sources=sourceList(c,brand),result={brand,group,offers:[],sources:[],checkedAt:new Date().toISOString()};
  // Ordem de consulta solicitada: fornecedor, marketplaces, concorrentes.
  for(const category of ['official','marketplace','competitor']){
    const block=await Promise.all(sources.filter(s=>s.category===category).map(async s=>{try{const {products,truncated}=await catalog(s,norm(group).replace(/\s+[MFU]$/i,''),{pages:1});const offers=productOffers(products,s,brand,group);return {offers,status:{source:s.name,category,status:offers.length?'ok':'no_match',truncated,checkedAt:new Date().toISOString()}}}catch(e){return {offers:[],status:{source:s.name,category,status:'unavailable',reason:e.message,checkedAt:new Date().toISOString()}}}}));
    for(const r of block){result.offers.push(...r.offers);result.sources.push(r.status)}
  }
  if(!sources.some(s=>s.category==='official'))result.sources.unshift({source:brand,category:'official',status:'not_configured',reason:'Site do fornecedor não cadastrado'});
  return result;
}
function csv(text){let row=[],cell='',quoted=false,rows=[];text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0],sep=first.includes(';')?';':',';for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}else if(c===sep&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);rows.push(row);row=[];cell=''}else cell+=c}if(cell||row.length){row.push(cell);rows.push(row)}return rows}
export async function targets(c){const r=await fetch(`https://docs.google.com/spreadsheets/d/${c.sheetId}/export?format=csv`,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Acesso à planilha: HTTP '+r.status);const text=await r.text();if(/^\s*</.test(text))throw Error('Google retornou página HTML, não a planilha. Verifique acesso/conversão.');const rows=csv(text),head=rows.shift().map(norm),bi=head.indexOf('MARCA'),gi=head.indexOf('AGRUPADOR');if(bi<0||gi<0)throw Error('MARCA e AGRUPADOR não encontrados');return [...new Map(rows.filter(r=>r[bi]&&r[gi]).map(r=>[key(r[bi],r[gi]),{brand:cleanBrand(r[bi]),group:r[gi].trim()}])).values()]}
export async function collectAll(c){const groups=await targets(c),out={schemaVersion:1,generatedAt:new Date().toISOString(),groups:{},warnings:[]};
  const sources=[...c.suppliers.filter(s=>s.url).map(s=>({...s,name:s.brand,category:'official'})),...c.marketplaces.map(s=>({...s,category:'marketplace'})),...c.competitors.map(s=>({...s,category:'competitor'}))];
  for(const g of groups)out.groups[key(g.brand,g.group)]={...g,offers:[],sources:[]};
  // Um catálogo por fonte/marca, reaproveitado entre todos os agrupadores dessa marca.
  for(const source of sources){const relevant=groups.filter(g=>source.category!=='official'||cleanBrand(source.brand)===g.brand);const brands=[...new Set(relevant.map(g=>g.brand))];let unavailable=null;
    for(const brand of brands){let products=[],truncated=false,status='ok',reason;
      if(unavailable){status='unavailable';reason=unavailable}else try{const result=await catalog(source,brand,{pages:c.maxPagesPerBrand||20});products=result.products;truncated=result.truncated}catch(e){status='unavailable';reason=e.message;unavailable=reason;}
      for(const g of relevant.filter(g=>g.brand===brand)){const entry=out.groups[key(g.brand,g.group)],offers=status==='ok'?productOffers(products,source,g.brand,g.group):[];entry.offers.push(...offers);entry.sources.push({source:source.name,category:source.category,status:status==='ok'?(offers.length?'ok':'no_match'):status,reason,truncated,checkedAt:new Date().toISOString()});}
      if(truncated)out.warnings.push(`${source.name}/${brand}: catálogo limitado; alguns modelos podem não ter sido consultados.`);
    }
    console.log(source.name+': consulta concluída');
  }
  for(const entry of Object.values(out.groups))if(!entry.sources.some(s=>s.category==='official'))entry.sources.unshift({source:entry.brand,category:'official',status:'not_configured'});
  return out;
}
async function serve(c){const cache=new Map();const origin=process.env.ALLOWED_ORIGIN||'';if(!origin)throw Error('Defina ALLOWED_ORIGIN com o endereço do painel.');const server=createServer(async(req,res)=>{res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Content-Type','application/json');if(req.method==='OPTIONS'){res.writeHead(204);return res.end()}if(req.url!=='/consultar'||req.method!=='POST'){res.writeHead(404);return res.end(JSON.stringify({error:'Rota inexistente'}))}if(req.headers.origin!==origin){res.writeHead(403);return res.end(JSON.stringify({error:'Origem não autorizada'}))}try{let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('Requisição muito grande')}const q=JSON.parse(body);if(typeof q.brand!=='string'||typeof q.group!=='string'||q.brand.length>100||q.group.length>180)throw Error('Marca e agrupador inválidos');const id=key(q.brand,q.group),saved=cache.get(id);let value;if(saved&&Date.now()-saved.time<15*60*1000)value=saved.value;else{value=await collectGroup(c,q.brand,q.group);cache.set(id,{time:Date.now(),value});if(cache.size>2000)cache.delete(cache.keys().next().value)}res.end(JSON.stringify(value))}catch(e){res.writeHead(400);res.end(JSON.stringify({error:e.message}))}});server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Coletor ativo'));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const c=await config();if(process.argv.includes('--serve'))await serve(c);else {const out=await collectAll(c);await mkdir('public',{recursive:true});await writeFile('public/prices.json',JSON.stringify(out));const found=Object.values(out.groups).reduce((n,g)=>n+g.offers.length,0);console.log(`${Object.keys(out.groups).length} agrupadores; ${found} ofertas reais.`);if(!found)throw Error('Nenhuma oferta coletada. Não publicar painel como pronto; é necessário validar e adaptar as fontes.');}}
