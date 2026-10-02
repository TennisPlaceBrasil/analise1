# Ativar consulta dentro do painel

O botão foi corrigido: não abre uma issue ou outra página. A consulta direta ainda depende de hospedar o serviço.

## Render

1. Entre em https://dashboard.render.com/ e escolha New > Blueprint.
2. Conecte TennisPlaceBrasil/analise1 e selecione a branch consulta-direta-preparada. O arquivo render.yaml usa plano free.
3. Informe FIRECRAWL_API_KEY como segredo (sua chave Firecrawl) e ACCESS_CODE como um código privado escolhido por você. Não publique as credenciais em arquivo ou conversa.
4. Publique e copie o endereço HTTPS fornecido pelo Render. Envie somente esse endereço para configurar marketEndpoint no painel com /consultar.
5. Depois de conectar o endereço, o botão solicita o código de acesso dentro do painel e consulta apenas o modelo escolhido. Nenhuma tela do GitHub é aberta.

A chave Firecrawl permanece no serviço. O código de acesso protege as consultas e não é salvo pelo painel. Não precisa instalar software no computador.

## Comportamento

Fila em memória: uma consulta por vez, até cinco modelos aguardando, agrupador validado na planilha, pedidos duplicados unidos e cache de 24h. Até duas páginas de busca por modelo (Netshoes e Centauro), além do fornecedor. Lojas sem integração continuam indisponíveis. Cache e contagem de 20 páginas/dia e 200/mês se perdem ao reiniciar o processo; não representam o saldo Firecrawl. No Render free, o serviço adormece após 15 minutos sem atividade, perde memória e pode levar cerca de um minuto para acordar. Para operação contínua e limites duráveis será preciso armazenamento persistente.

Resultados chegam diretamente ao navegador e não são publicados para todos os usuários do GitHub Pages. As ofertas anteriores são mantidas se a consulta falhar. A rotina anterior do GitHub continua configurada para solicitações existentes; o novo botão não utiliza issues.

## Validação

node --test *.test.mjs

O serviço foi testado localmente com lojas simuladas, sem créditos Firecrawl. A hospedagem e uma consulta real pelo endpoint ainda não foram ativadas/verificadas.
