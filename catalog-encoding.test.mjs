import test from 'node:test';
import assert from 'node:assert/strict';
import {collectGroup} from './coletor.mjs';
test('busca oficial de modelo com espaços usa %20 aceito pela rota VTEX',async()=>{
 const previous=globalThis.fetch, urls=[];
 globalThis.fetch=async url=>{urls.push(String(url));return new Response('[]',{headers:{'Content-Type':'application/json'}})};
 try{await collectGroup({suppliers:[{brand:'OLYMPIKUS',url:'https://www.olympikus.com.br/',currency:'BRL'}],marketplaces:[],competitors:[]},'OLYMPIKUS','ADRENA 2 F');
 assert.equal(urls.length,1);assert.ok(urls[0].includes('ft=ADRENA%202'));assert.ok(!urls[0].includes('ADRENA+2'));}finally{globalThis.fetch=previous}
});
