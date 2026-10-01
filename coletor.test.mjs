import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches, productOffers, key } from './coletor.mjs';
const product={brand:'OLYMPIKUS',productName:'Tênis Olympikus Corre 5 Unissex',link:'https://www.olympikus.com.br/corre-5/p',items:[{itemId:'1',name:'Preto 40',sellers:[{sellerId:'1',sellerName:'Olympikus',commertialOffer:{Price:499.99,AvailableQuantity:3}}]}]};
const source={name:'OLYMPIKUS',url:'https://www.olympikus.com.br/',category:'official'};
test('marca e versão precisam corresponder',()=>{assert.equal(matches(product,'OLYMPIKUS','CORRE 5 U'),true);assert.equal(matches(product,'MIZUNO','CORRE 5 U'),false);assert.equal(matches({...product,productName:'Corre 4 Unissex'},'OLYMPIKUS','CORRE 5 U'),false);assert.equal(matches({...product,productName:'Corre 5 Carbon Unissex'},'OLYMPIKUS','CORRE 5 U'),false);assert.equal(matches({...product,productName:'Corre5 Unissex'},'OLYMPIKUS','CORRE 5 U'),true)});
test('oferta precisa de preço, estoque e URL da fonte',()=>{assert.equal(productOffers([product],source,'OLYMPIKUS','CORRE 5 U').length,1);const copy=structuredClone(product);copy.items[0].sellers[0].commertialOffer.AvailableQuantity=0;assert.equal(productOffers([copy],source,'OLYMPIKUS','CORRE 5 U').length,0);copy.link='https://outra-loja.com/produto';assert.equal(productOffers([copy],source,'OLYMPIKUS','CORRE 5 U').length,0)});
test('chaves são compatíveis com o HTML',()=>{assert.equal(key('OLYMPIKUS','CORRE5 U'),'OLYMPIKUS|CORRE5 U');assert.equal(key('MIZUNO','MEIA CANO MÉDIO U'),key('MIZUNO','MEIA CANO MEDIO U'))});
