import {readFile} from 'node:fs/promises';
import {github} from './request-queue.mjs';
// Executado SOMENTE depois da publicação bem-sucedida. Nenhuma mensagem é enviada.
for(const number of JSON.parse(await readFile('processed-requests.json','utf8'))){
  await github('issues/'+number,{method:'PATCH',body:{state:'closed',state_reason:'completed'}});
}
