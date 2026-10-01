import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeRetailerCache,retailerCache} from './retailer-cache.mjs';
const id='OLYMPIKUS|CORRE 5 U',time='2026-10-01T21:00:00Z';
const offer={source:'Netshoes',category:'marketplace',title:'Tênis Olympikus Corre 5 Unissex',price:599.99,currency:'BRL',url:'https://www.netshoes.com.br/p/tenis-corre-5',checkedAt:time,match:true,evidence:'merchant_jsonld'};
const empty=()=>({groups:{[id]:{brand:'OLYMPIKUS',group:'CORRE 5 U',offers:[],sources:[]}}});
const cache=o=>({schemaVersion:1,groups:{[id]:{brand:'OLYMPIKUS',group:'CORRE 5 U',offers:[o],sources:[{source:'Netshoes',category:'marketplace',status:'ok',checkedAt:time,pages:4}]}}});
test('consulta guardada mantém data original e expira em 7 dias',()=>{
  const r=empty();mergeRetailerCache(r,cache(offer),Date.parse(time)+86400000);
  assert.equal(r.groups[id].offers[0].checkedAt,time);assert.equal(r.groups[id].sources[0].cached,true);
  const expired=empty();mergeRetailerCache(expired,cache(offer),Date.parse(time)+8*86400000);assert.equal(expired.groups[id].offers.length,0);
});
test('cache não introduz preços de modelo, moeda ou domínio incompatíveis',()=>{
  for(const patch of [{title:'Tênis Olympikus Corre 5 Vanderlei'},{currency:'USD'},{url:'https://evil.test/a'},{price:0},{checkedAt:'2026-12-01T21:00:00Z'}]){const r=empty();mergeRetailerCache(r,cache({...offer,...patch}),Date.parse(time));assert.equal(r.groups[id].offers.length,0)}
});
test('a ausência de ofertas válidas não preserva status de preço encontrado',()=>{
  const r=empty();mergeRetailerCache(r,cache({...offer,price:0}),Date.parse(time));assert.notEqual(r.groups[id].sources[0]?.status,'ok');
});
test('cache só guarda dados das integrações de páginas',()=>{
  const r=empty();r.groups[id].offers=[offer,{...offer,source:'OLYMPIKUS',evidence:undefined}];r.groups[id].sources=cache(offer).groups[id].sources;
  assert.equal(retailerCache(r).groups[id].offers.length,1);
});
