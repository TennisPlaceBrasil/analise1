import {test} from 'node:test';
import assert from 'node:assert/strict';
import selection from './public/offer-selection.js';
const {limitOffers}=selection;
const offer=(source,category,url,price)=>({source,category,url,price});
test('limita a 2 anúncios por marketplace, 1 oficial e 1 de cada concorrente',()=>{
  const rows=[];
  for(const [source,category]of [['OLYMPIKUS','official'],['Mercado Livre','marketplace'],['Netshoes','marketplace'],['Centauro','competitor'],['W Tennis','competitor'],['Flávios','competitor'],['B2 Online','competitor'],['Decathlon','competitor']])for(let i=3;i>=1;i--)rows.push(offer(source,category,'https://loja.test/'+source.replaceAll(' ','')+'/'+i,100+i));
  const found=limitOffers(rows);assert.equal(found.length,10);
  for(const source of ['Mercado Livre','Netshoes'])assert.deepEqual(found.filter(o=>o.source===source).map(o=>o.price),[101,102]);
  for(const source of ['OLYMPIKUS','Centauro','W Tennis','Flávios','B2 Online','Decathlon'])assert.equal(found.filter(o=>o.source===source).length,1);
});
test('SKU, tamanho e tracking do mesmo anúncio não contam como outro anúncio',()=>{
  const found=limitOffers([offer('Netshoes','marketplace','https://loja.test/p/a?utm_source=x',100),offer('NETSHOES','marketplace','https://loja.test/p/a?utm_campaign=y#size40',101),offer('Netshoes','marketplace','https://loja.test/p/b',120),offer('Netshoes','marketplace','https://loja.test/p/c',130)]);
  assert.deepEqual(found.map(o=>o.price),[100,120]);
});
test('sem oferta não fabrica preços; resultados inválidos não ocupam vagas',()=>{
  assert.deepEqual(limitOffers([]),[]);assert.deepEqual(limitOffers([offer('Netshoes','marketplace','javascript:alert(1)',1),offer('Netshoes','marketplace','https://loja.test/p/a',0)]),[]);
});
