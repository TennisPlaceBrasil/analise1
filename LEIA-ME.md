# Análise de Preços Tennis Place

O painel lê sempre a planilha `1oi7gir3KQhlBx3L123Usbd6xfOhcilrQ` e mostra os preços externos dentro da tabela. Não há links de pesquisa ou digitação manual de preços. A base de custos não é incluída neste pacote.

## Estado desta entrega

A interface e a lógica foram verificadas com a planilha enviada e dados de teste explicitamente sintéticos. Nenhum dado sintético é publicado ou incluído no painel. As conexões reais com Google e lojas NÃO puderam ser validadas neste ambiente. Este pacote é uma implementação inicial do coletor, não um serviço já ativado nem uma garantia de cobertura das lojas.

O adaptador implementado consulta o catálogo público VTEX quando a loja o disponibiliza. Não assume que todas as lojas usam VTEX. Sites sem esse catálogo, com bloqueio ou com outro formato são marcados como consulta indisponível e precisam de adaptadores próprios. Isso pode incluir os marketplaces. Everlast não é consultado até validar/configurar a fonte brasileira em BRL; West Coast continua sem URL.

## Ativar no GitHub

1. Coloque o conteúdo deste pacote na raiz do repositório do painel, incluindo `.github/workflows/coletar-precos.yml`.
2. A planilha precisa permitir leitura pelo mecanismo escolhido. Se ainda for um Excel no Drive e a exportação/GViz falhar, será necessário converter para Planilhas Google ou configurar uma leitura autenticada. A conversão pode mudar o link; nesse caso será necessário atualizar o ID fixo no código e em `config.json`.
3. Em Settings → Pages, escolha **GitHub Actions** como origem.
4. Em Actions, execute **Coletar preços e publicar painel**.
5. Confira o resultado real por fonte. A rotina falha se não coletar nenhuma oferta e não publica uma página como se houvesse preços disponíveis.

O fluxo agenda uma coleta diária às 06h23 de Brasília (09h23 UTC). A página recebe `prices.json` com ofertas, fonte, SKU e data. O botão **Analisar preços** recarrega a última coleta publicada, sem disparar uma execução no GitHub. Isso é atualização de resultados armazenados, não busca instantânea nos sites.

## Busca instantânea ao clicar

O mesmo coletor oferece um servidor HTTP: Node 22+, `ALLOWED_ORIGIN=https://seu-usuario.github.io PORT=3000 node coletor.mjs --serve`. Hospede-o em um serviço que execute Node, com HTTPS, e defina `marketEndpoint` em `config.json` com a URL completa `/consultar`.

Com esse serviço conectado, o botão da tabela consulta os 40 agrupadores da página visível; o botão de detalhes consulta apenas aquele agrupador. Primeiro consulta o fornecedor, depois marketplaces e concorrentes. Consultas podem levar minutos; fontes incompatíveis seguem identificadas como indisponíveis. Consultas do servidor usam cache de 15 minutos. A configuração de origem é uma restrição de navegador, não autenticação; antes de expor amplamente, adicione autenticação e controle de uso conforme o serviço escolhido.

O GitHub Pages hospeda o painel; ele não executa esse servidor. Não coloque tokens de GitHub, senhas ou chaves de serviços no HTML ou em `public/config.json`.

## Regras

- Custos vazios ou não positivos: Custo pendente. Não viram zero no cálculo.
- Preço-alvo = custo × markup cadastrado; sem arredondamento comercial.
- Marcas sem markup não recebem um valor presumido.
- Busca por marca e agrupador; tamanhos e cores ficam nas ofertas.
- Correspondência conservadora: marca + sequência do modelo/versão. Códigos de fábrica continuam relevantes quando fazem parte do agrupador.
- Ofertas sem estoque, sem preço positivo ou de outra marca são excluídas.
- Preço de catálogo público, em BRL; não inclui frete, cupom ou desconto Pix não informado pela fonte.
- A consulta de catálogo é limitada por `maxPagesPerBrand`; resultados parciais são identificados. Pode haver falsos negativos; é necessário revisar cobertura antes de usar para decisões.
- Terceiro marketplace não incluído porque ainda não foi definido.

## Arquivos

- `public/index.html`: painel para GitHub Pages.
- `config.json`: fontes e configuração do coletor; copie para `public/config.json` após alterar.
- `coletor.mjs`: rotina de coleta e servidor opcional.
- `coletor.test.mjs`: validações do matcher e de ofertas. Valores aqui são apenas testes.
- `.github/workflows/coletar-precos.yml`: coleta e publicação.

## Referências técnicas

- https://developers.vtex.com/docs/api-reference/search-api
- https://developers.vtex.com/docs/guides/how-search-parameters-work
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
