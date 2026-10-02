import {key} from './coletor.mjs';
export const PREFIX='[Pesquisa TP] ';
export function parseRequest(issue){
  if(issue.pull_request||issue.state!=='open'||!issue.title?.startsWith(PREFIX))return null;
  if(!['OWNER','MEMBER','COLLABORATOR'].includes(issue.author_association))return null;
  const match=String(issue.body||'').match(/```json\s*([\s\S]*?)```/);
  if(!match)return null;
  try{const q=JSON.parse(match[1]);if(typeof q.brand!=='string'||typeof q.group!=='string'||!q.brand.trim()||!q.group.trim()||q.brand.length>100||q.group.length>180)return null;
    return {number:issue.number,brand:q.brand.trim(),group:q.group.trim(),key:key(q.brand,q.group)};
  }catch{return null}
}
export function planQueue(issues,available,history={},now=Date.now()){
  const allowed=new Map(available.map(g=>[key(g.brand,g.group),g]));
  const pending=issues.map(parseRequest).filter(Boolean).sort((a,b)=>a.number-b.number);
  const grouped=new Map(),rejected=[],completed=[];
  for(const q of pending){if(history[q.number]){completed.push(q.number);continue}
    if(!allowed.has(q.key)){rejected.push(q);continue}
    if(!grouped.has(q.key))grouped.set(q.key,{...allowed.get(q.key),key:q.key,numbers:[]});
    grouped.get(q.key).numbers.push(q.number);
  }
  return {jobs:[...grouped.values()].slice(0,5),rejected:rejected.slice(0,20),completed};
}
export function isRecent(entry,now=Date.now()){
  const t=Date.parse(entry?.requestedAt);return Number.isFinite(t)&&t<=now&&now-t<86400000;
}
export function remainingBudget(ledger,now=new Date()){
  const month=now.toISOString().slice(0,7),day=now.toISOString().slice(0,10);
  return Math.max(0,Math.min(20-(ledger?.days?.[day]||0),200-(ledger?.months?.[month]||0)));
}
export async function github(path,{method='GET',body,token=process.env.GITHUB_TOKEN,fetchImpl=fetch}={}){
  if(!token)throw Error('Token do executor indisponível.');
  const r=await fetchImpl('https://api.github.com/repos/TennisPlaceBrasil/analise1/'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw Error('Fila GitHub: HTTP '+r.status);return r.status===204?null:r.json();
}
export async function listRequests(){
  const all=[];for(let page=1;page<=10;page++){const rows=await github('issues?state=open&sort=created&direction=asc&per_page=100&page='+page);all.push(...rows);if(rows.length<100)break}return all;
}
