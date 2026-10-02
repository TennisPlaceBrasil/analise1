import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseRequest,planQueue,isRecent,remainingBudget} from './request-queue.mjs';
const issue=(number=1,brand='OLYMPIKUS',group='CORRE 5 U')=>({number,state:'open',author_association:'OWNER',title:'[Pesquisa TP] '+brand+' '+group,body:'```json\n'+JSON.stringify({brand,group})+'\n```'});
const available=[{brand:'OLYMPIKUS',group:'CORRE 5 U'},{brand:'ASICS',group:'JOLT 5 M'}];
test('fila aceita somente solicitações de colaboradores, nunca código/URLs externos',()=>{
  assert.equal(parseRequest({...issue(),author_association:'NONE'}),null);
  assert.equal(parseRequest({...issue(),title:'Problema qualquer'}),null);
  assert.equal(parseRequest({...issue(),pull_request:{}}),null);
  assert.equal(parseRequest({...issue(),body:'```json\n{"brand":"OLYMPIKUS","group":null}\n```'}),null);
  assert.equal(parseRequest({...issue(),state:'closed'}),null);
});
test('deduplica modelo exato da planilha e não escolhe outros produtos',()=>{
  const plan=planQueue([issue(3),issue(1),issue(2,'ADIDAS','https://evil.test')],available);
  assert.equal(plan.jobs.length,1);assert.deepEqual(plan.jobs[0].numbers,[1,3]);assert.equal(plan.jobs[0].key,'OLYMPIKUS|CORRE 5 U');assert.equal(plan.rejected[0].number,2);
  assert.equal(planQueue([],available).jobs.length,0);
});
test('publicações concluídas não consomem consultas novamente',()=>{
  const plan=planQueue([issue(1),issue(2,'ASICS','JOLT 5 M')],available,{1:{state:'partial'}});
  assert.deepEqual(plan.completed,[1]);assert.equal(plan.jobs[0].brand,'ASICS');
});
test('cache de 24 horas e limites de 20 páginas/dia e 200/mês',()=>{
  const now=Date.parse('2026-10-02T15:00:00Z');
  assert.equal(isRecent({requestedAt:new Date(now-23*3600000).toISOString()},now),true);
  assert.equal(isRecent({requestedAt:new Date(now-25*3600000).toISOString()},now),false);
  assert.equal(isRecent({requestedAt:new Date(now+1000).toISOString()},now),false);
  assert.equal(remainingBudget({days:{'2026-10-02':20}},new Date(now)),0);
  assert.equal(remainingBudget({months:{'2026-10':199}},new Date(now)),1);
  assert.equal(remainingBudget({},new Date(now)),20);
});
