import {test} from 'node:test';
import assert from 'node:assert/strict';
import {structuredOffers,productLinks,runRetailerPilot,centauroOffers,batchTargets} from './retailer-pilot.mjs';
const blockedDirect=async()=>{throw Error('Teste sem leitura direta')};
const source={name:'Centauro',url:'https://www.centauro.com.br/',category:'competitor'};
const url=source.url+'tenis-olympikus-corre-5.html';
const product={'@type':'Product',brand:{name:'Olympikus'},name:'Tênis Olympikus Corre 5 Unissex',offers:{'@type':'Offer',price:599.99,priceCurrency:'BRL',availability:'https://schema.org/InStock',url}};
const html=p=>'<script type="application/ld+json">'+JSON.stringify({'@graph':[p]})+'</script>';
const extract=p=>structuredOffers(html(p),source,'OLYMPIKUS','CORRE 5 U',url);
const nextHTML=fallback=>'<script id="__NEXT_DATA__" type="application/json">'+JSON.stringify({props:{pageProps:{fallback}}})+'</script>';
test('Centauro: oferta por tamanho usa preço e estoque do produto',()=>{
  const p={name:product.name,brand:'Olympikus',isAvailable:true,hasStock:true,seo:{schema:{product:{aggregateOffer:{priceCurrency:'BRL',lowPrice:1}}}},sizes:[{description:'40',sku:'abc40',isAvailable:true,hasStock:true,priceInfos:{price:599.99,pixDiscount:10},sellerInfo:{name:'Centauro'}},{description:'41',sku:'abc41',isAvailable:true,hasStock:false,priceInfos:{price:399.99}}]};
  const read=v=>centauroOffers(nextHTML({p:{product:v,seo:v.seo}}),source,'OLYMPIKUS','CORRE 5 U',url);
  const found=read(p);assert.equal(found.length,1);assert.equal(found[0].price,599.99);assert.equal(found[0].sku,'abc40');
  assert.equal(read({...p,name:'Tênis Olympikus Corre 5 Vanderlei'}).length,0);
  assert.equal(read({...p,hasStock:false}).length,0);
  assert.equal(read({...p,seo:{}}).length,0);
});
test('Centauro: cartão deve ter moeda e disponibilidade declaradas',()=>{
  const p={id:'abc',name:product.name,status:'available',url,price:599.88,details:{brand:'Olympikus',sellerName:'Loja parceira'},seo:{aggregateOffer:{priceCurrency:'BRL',availability:'InStock',lowPrice:1}}};
  const read=v=>centauroOffers(nextHTML({search:{products:[v]}}),source,'OLYMPIKUS','CORRE 5 U',url);
  assert.equal(read(p)[0].price,599.88);
  assert.equal(read({...p,status:'unavailable'}).length,0);
  assert.equal(read({...p,url:'https://evil.test/a'}).length,0);
  assert.equal(read({...p,seo:{aggregateOffer:{priceCurrency:'USD',availability:'InStock'}}}).length,0);
});
test('preço deve estar ligado ao modelo, moeda, estoque e domínio corretos',()=>{
  assert.equal(extract(product).length,1);
  for(const patch of [{priceCurrency:'USD'},{availability:'https://schema.org/OutOfStock'},{price:0},{url:'https://evil.test/a'},{'@type':'AggregateOffer',lowPrice:200},{itemCondition:'https://schema.org/UsedCondition'}])assert.equal(extract({...product,offers:{...product.offers,...patch}}).length,0);
  assert.equal(extract({...product,brand:undefined}).length,0);
  assert.equal(extract({...product,name:'Tênis Olympikus Corre 5 Vanderlei'}).length,0);
  assert.equal(extract({...product,name:'Bermuda Olympikus Corre 5'}).length,0);
});
test('descoberta fica limitada a produtos comparáveis da própria loja',()=>{
  const links=[url,url,'https://evil.test/tenis-olympikus-corre-5.html',source.url+'busca/olympikus-corre-5',source.url+'tenis-olympikus-corre-5-vanderlei.html'];
  assert.deepEqual(productLinks(links,source,'OLYMPIKUS','CORRE 5 U'),[url]);
});
test('sem credencial nem página direta não apaga a coleta existente',async()=>{
  const result={groups:{'OLYMPIKUS|CORRE 5 U':{offers:[{price:1}],sources:[]}},warnings:[]};
  await runRetailerPilot(result,{directFetchImpl:blockedDirect,apiKey:'',fetchImpl:()=>{throw Error('Não deve consultar')}});
  assert.equal(result.groups['OLYMPIKUS|CORRE 5 U'].offers.length,1);assert.equal(result.warnings.length,1);
});
test('resposta 403 não produz oferta e não publica dados da credencial',async()=>{
  const result={groups:{'OLYMPIKUS|CORRE 5 U':{brand:'OLYMPIKUS',group:'CORRE 5 U',offers:[],sources:[]}},warnings:[]};
  await runRetailerPilot(result,{directFetchImpl:blockedDirect,apiKey:'secret-test',fetchImpl:async()=>({ok:false,status:403})});
  assert.equal(result.groups['OLYMPIKUS|CORRE 5 U'].offers.length,0);
  assert.equal(result.groups['OLYMPIKUS|CORRE 5 U'].sources[0].status,'unavailable');
  assert.equal(JSON.stringify(result).includes('secret-test'),false);
});
test('lote prioriza tênis sem consulta e mantém a consulta mais recente fora da fila',()=>{
  const result={groups:{}};
  for(let i=1;i<=7;i++)result.groups['g'+i]={brand:'OLYMPIKUS',group:'CORRE '+i+' U',offers:[{title:'Tênis Olympikus Corre '+i}],sources:[]};
  result.groups.g1.sources=[{source:'Netshoes',pages:1,checkedAt:'2026-10-01T21:00:00Z'}];
  result.groups.roupa={brand:'OLYMPIKUS',group:'CAMISETA M',offers:[{title:'Camiseta Olympikus'}],sources:[]};
  result.groups.asics={brand:'ASICS',group:'JOLT 5 U',offers:[{title:'Tênis Asics Jolt 5'}],sources:[]};
  const targets=batchTargets(result);assert.equal(targets.length,5);assert.equal(targets.includes('g1'),false);assert.equal(targets.includes('roupa'),false);assert.equal(targets.includes('asics'),false);
});
test('lote limita o gasto a 10 páginas de busca e não apaga outros agrupadores',async()=>{
  const result={groups:{},warnings:[]};
  for(let i=1;i<=8;i++)result.groups['g'+i]={brand:'OLYMPIKUS',group:'CORRE '+i+' U',offers:[{source:'OLYMPIKUS',title:'Tênis Olympikus Corre '+i,price:500}],sources:[]};
  let calls=0;
  const fake=async(endpoint,options)=>{
    calls++;const request=JSON.parse(options.body),page=new URL(request.url);assert.equal(page.pathname.startsWith('/busca/'),true);
    const name='Tênis Olympikus '+page.pathname.replace('/busca/olympikus-','').replaceAll('-',' ');
    const p={...product,name,offers:{...product.offers,url:page.origin+'/p/'+page.pathname.split('/').at(-1)}};
    return {ok:true,json:async()=>({success:true,data:{rawHtml:html(p),links:[page.origin+'/p/olympikus-corre-1']}})};
  };
  await runRetailerPilot(result,{directFetchImpl:blockedDirect,batch:true,targetKeys:Object.keys(result.groups),apiKey:'test-secret',fetchImpl:fake});
  assert.equal(calls,10);assert.equal(result.retailerBatch.groups.length,5);
  for(let i=1;i<=5;i++){assert.equal(result.groups['g'+i].sources.length,2);assert.equal(result.groups['g'+i].offers.filter(o=>o.source!=='OLYMPIKUS').length,2)}
  assert.equal(result.groups.g6.offers.length,1);assert.equal(result.groups.g6.sources.length,0);
  assert.equal(JSON.stringify(result).includes('test-secret'),false);
});
test('leitura direta retorna somente 2 Netshoes e 1 Centauro sem Firecrawl',async()=>{
  const entry={brand:'OLYMPIKUS',group:'CORRE 5 U',offers:[],sources:[]};const result={groups:{'OLYMPIKUS|CORRE 5 U':entry},warnings:[]};let reads=0;
  await runRetailerPilot(result,{apiKey:'',directFetchImpl:async search=>{reads++;const base=new URL(search).origin;const products=[1,2,3,4].map(i=>({...product,offers:{...product.offers,url:base+'/p/produto-'+i,price:500+i}}));return {ok:true,url:search,text:async()=>'<script type="application/ld+json">'+JSON.stringify(products)+'</script>'}},fetchImpl:()=>{throw Error('Firecrawl não deve ser chamado')}});
  assert.equal(reads,2);assert.equal(result.retailerBatch.calls,0);assert.equal(entry.offers.filter(o=>o.source==='Netshoes').length,2);assert.equal(entry.offers.filter(o=>o.source==='Centauro').length,1);assert.ok(entry.sources.every(s=>s.method==='direct'&&s.status==='ok'));
});
test('falha nas duas leituras mantém preço anterior e sua data',async()=>{
  const old={source:'Netshoes',category:'marketplace',price:400,checkedAt:'2026-10-02T00:00:00Z',url:'https://www.netshoes.com.br/p/produto'};
  const entry={brand:'OLYMPIKUS',group:'CORRE 5 U',offers:[old],sources:[]};const result={groups:{'OLYMPIKUS|CORRE 5 U':entry},warnings:[]};
  await runRetailerPilot(result,{directFetchImpl:blockedDirect,apiKey:'test',fetchImpl:async()=>({ok:false,status:429})});
  assert.deepEqual(entry.offers,[old]);assert.equal(entry.sources[0].preserved,true);assert.equal(result.retailerBatch.calls,2);
});
