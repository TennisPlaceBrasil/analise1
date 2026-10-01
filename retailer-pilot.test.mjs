import {test} from 'node:test';
import assert from 'node:assert/strict';
import {structuredOffers,productLinks,runRetailerPilot,centauroOffers} from './retailer-pilot.mjs';
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
test('piloto sem credencial não consulta nem apaga a coleta existente',async()=>{
  const result={groups:{'OLYMPIKUS|CORRE 5 U':{offers:[{price:1}],sources:[]}},warnings:[]};
  await runRetailerPilot(result,{apiKey:'',fetchImpl:()=>{throw Error('Não deve consultar')}});
  assert.equal(result.groups['OLYMPIKUS|CORRE 5 U'].offers.length,1);assert.equal(result.warnings.length,1);
});
test('resposta 403 não produz oferta e não publica dados da credencial',async()=>{
  const result={groups:{'OLYMPIKUS|CORRE 5 U':{brand:'OLYMPIKUS',group:'CORRE 5 U',offers:[],sources:[]}},warnings:[]};
  await runRetailerPilot(result,{apiKey:'secret-test',fetchImpl:async()=>({ok:false,status:403})});
  assert.equal(result.groups['OLYMPIKUS|CORRE 5 U'].offers.length,0);
  assert.equal(result.groups['OLYMPIKUS|CORRE 5 U'].sources[0].status,'unavailable');
  assert.equal(JSON.stringify(result).includes('secret-test'),false);
});
