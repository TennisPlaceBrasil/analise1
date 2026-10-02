import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createConsultationService} from './consulta-service.mjs';
const origin='https://tennisplacebrasil.github.io';
async function setup(t,extra={}){
  let collects=0,pilots=0;const seen=[];
  const server=createConsultationService({suppliers:[],marketplaces:[],competitors:[]},{apiKey:'server-only-secret',accessCode:'owner-code',targetsImpl:async()=>[{brand:'OLYMPIKUS',group:'CORRE5U'},{brand:'ASICS',group:'JOLT5M'}],collectImpl:async(c,brand,group)=>{collects++;seen.push({brand,group});await new Promise(r=>setTimeout(r,10));return {brand,group,offers:[],sources:[]}},pilotImpl:async(result,options)=>{pilots++;assert.equal(options.batch,true);assert.equal(options.targetKeys.length,1);result.groups[options.targetKeys[0]].offers.push({source:'Netshoes',price:599.99,currency:'BRL',match:true})},...extra});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close()});
  const url='http://127.0.0.1:'+server.address().port;
  const query=async(body={brand:'OLYMPIKUS',group:'CORRE5U'},headers={})=>fetch(url+'/consultar',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Authorization:'Bearer owner-code',...headers},body:JSON.stringify(body)});
  return {query,counts:()=>({collects,pilots,seen}),url};
}
test('consulta direta exige código e origem correta antes de pesquisar',async t=>{const s=await setup(t);assert.equal((await s.query(undefined,{Authorization:''})).status,401);assert.equal((await s.query(undefined,{Origin:'https://other.test'})).status,403);assert.equal(s.counts().pilots,0);assert.equal((await fetch(s.url+'/health')).status,200)});
test('grupo inexistente não chega aos fornecedores/Firecrawl',async t=>{const s=await setup(t);assert.equal((await s.query({brand:'OLYMPIKUS',group:'https://evil.test'})).status,400);assert.equal(s.counts().collects,0)});
test('pedidos simultâneos iguais usam uma consulta e apenas o modelo escolhido',async t=>{const s=await setup(t);const responses=await Promise.all([s.query(),s.query()]);for(const r of responses){assert.equal(r.status,200);assert.equal((await r.json()).offers[0].price,599.99)}assert.deepEqual(s.counts(),{collects:1,pilots:1,seen:[{brand:'OLYMPIKUS',group:'CORRE5U'}]});assert.equal((await (await s.query()).json()).cached,true);assert.equal(s.counts().pilots,1)});
test('pesquisas diferentes executam em sequência, sem outros modelos',async t=>{let running=0,max=0;const s=await setup(t,{collectImpl:async(c,brand,group)=>{running++;max=Math.max(max,running);await new Promise(r=>setTimeout(r,10));running--;return {brand,group,offers:[],sources:[]}}});await Promise.all([s.query(),s.query({brand:'ASICS',group:'JOLT5M'})]);assert.equal(max,1);assert.equal(s.counts().pilots,2)});
