import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const requested={number:1,state:'open',author_association:'OWNER',title:'[Pesquisa TP] OLYMPIKUS CORRE 5 U',body:'```json\n{"brand":"OLYMPIKUS","group":"CORRE 5 U"}\n```'};
async function scenario({queue=false,issues=[],usage={days:{},months:{}}}={}){
  const dir=await mkdtemp(join(tmpdir(),'tp-queue-'));
  try{
    await writeFile(join(dir,'config.json'),JSON.stringify({sheetId:'fixed',suppliers:[{brand:'OLYMPIKUS',url:'https://www.olympikus.com.br/',currency:'BRL'}],marketplaces:[],competitors:[]}));
    const cache={schemaVersion:1,generatedAt:'2026-10-01T00:00:00Z',groups:{'ASICS|JOLT 5 M':{brand:'ASICS',group:'JOLT 5 M',offers:[{price:200}],sources:[]}},usage};
    const mock=`import {writeFile} from 'node:fs/promises';const calls=[];globalThis.fetch=async(url,options={})=>{calls.push(String(url));await writeFile('calls.json',JSON.stringify(calls));if(String(url).endsWith('/prices.json'))return Response.json(${JSON.stringify(cache)});if(String(url).includes('api.github.com/'))return Response.json(${JSON.stringify(issues)});if(String(url).includes('docs.google.com/'))return new Response('MARCA,AGRUPADOR\\nOLYMPIKUS,CORRE 5 U\\nASICS,JOLT 5 M');if(String(url).includes('api.firecrawl.dev/'))return Response.json({success:true,data:{rawHtml:'<html></html>',links:[]}});if(String(url).includes('api/catalog_system/'))return Response.json([]);throw Error('Unexpected request: '+url);};`;
    await writeFile(join(dir,'mock.mjs'),mock);
    await exec(process.execPath,['--import',join(dir,'mock.mjs'),resolve('run-collection.mjs')],{cwd:dir,env:{...process.env,PROCESS_QUEUE:String(queue),FIRECRAWL_API_KEY:'test-key',GITHUB_TOKEN:'test-token'}});
    return {calls:JSON.parse(await readFile(join(dir,'calls.json'))),result:JSON.parse(await readFile(join(dir,'public/prices.json'))),completed:JSON.parse(await readFile(join(dir,'processed-requests.json')))};
  }finally{await rm(dir,{recursive:true,force:true})}
}
test('publicar layout não pesquisa lojas nem carrega planilha do coletor',async()=>{const s=await scenario();assert.equal(s.calls.length,1);assert.equal(s.result.groups['ASICS|JOLT 5 M'].offers[0].price,200)});
test('fila vazia não consome Firecrawl nem consulta lojas',async()=>{const s=await scenario({queue:true});assert.equal(s.calls.length,2);assert.equal(s.completed.length,0)});
test('solicitação consulta apenas o modelo exato, duas páginas, preservando os demais',async()=>{const s=await scenario({queue:true,issues:[requested]});assert.equal(s.calls.filter(u=>u.includes('firecrawl')).length,2);assert.equal(s.calls.filter(u=>u.includes('api/catalog_system')).length,1);assert.equal(s.result.groups['ASICS|JOLT 5 M'].offers[0].price,200);assert.deepEqual(s.completed,[1]);assert.equal(s.result.requests[1].key,'OLYMPIKUS|CORRE 5 U')});
test('limite mensal deixa pedido pendente e não consulta lojas',async()=>{const month=new Date().toISOString().slice(0,7),s=await scenario({queue:true,issues:[requested],usage:{months:{[month]:200},days:{}}});assert.equal(s.calls.filter(u=>u.includes('firecrawl')||u.includes('api/catalog_system')).length,0);assert.deepEqual(s.completed,[])});
