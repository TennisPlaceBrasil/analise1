// Diagnóstico separado do painel: guarda somente páginas públicas e campos da loja.
import {mkdir,writeFile} from 'node:fs/promises';
const apiKey=process.env.FIRECRAWL_API_KEY;
if(!apiKey)throw Error('Configure FIRECRAWL_API_KEY nos Secrets do repositório.');
await mkdir('centauro-diagnostics',{recursive:true});
const pages=[
  ['busca','https://www.centauro.com.br/busca/olympikus-corre-5'],
  ['produto','https://www.centauro.com.br/tenis-de-corrida-unissex-olympikus-corre-5-9974A7.html?cor=03']
];
const report=[];
for(const [name,url]of pages){
  try{
    const r=await fetch('https://api.firecrawl.dev/v2/scrape',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({url,formats:['rawHtml','links'],onlyMainContent:false,maxAge:0,timeout:45000,location:{country:'BR',languages:['pt-BR']}}),signal:AbortSignal.timeout(55000)});
    if(!r.ok)throw Error('Serviço de leitura: HTTP '+r.status);
    const response=await r.json(),d=response.data;
    if(!response.success||!d?.rawHtml)throw Error('HTML não retornado');
    // Credenciais não são incluídas nas requisições às lojas ou nos artefatos.
    const html=d.rawHtml.replaceAll(apiKey,'[redacted]');
    await writeFile('centauro-diagnostics/'+name+'.html',html);
    const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m=>({attributes:m[1],bytes:m[2].length}));
    const jsonld=[...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(m=>{try{return JSON.parse(m[1])}catch{return {parseError:true}}});
    await writeFile('centauro-diagnostics/'+name+'-schema.json',JSON.stringify(jsonld,null,2));
    report.push({name,url,httpStatus:d.metadata?.statusCode,bytes:html.length,scripts,productLinks:(d.links||[]).filter(v=>/corre-5/i.test(v)).slice(0,40)});
    console.log(name+': página recebida ('+html.length+' caracteres, '+jsonld.length+' blocos JSON-LD).');
  }catch(e){report.push({name,url,error:e.message});console.log(name+': '+e.message)}
}
await writeFile('centauro-diagnostics/report.json',JSON.stringify(report,null,2));
console.log('Diagnóstico concluído. Não altera os preços publicados.');
