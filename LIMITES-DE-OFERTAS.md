# Consulta com menos resultados

O painel e o serviço selecionam as menores ofertas comparáveis encontradas, com estes limites:

- Fornecedor oficial: até 1 oferta no total.
- Mercado Livre: até 2 anúncios diferentes, quando houver integração validada.
- Netshoes: até 2 anúncios diferentes.
- Cada concorrente (Centauro, W Tennis, Flávios, B2 Online e Decathlon): até 1 oferta.

Dois preços/tamanhos/vendedores no mesmo endereço de anúncio não ocupam duas vagas. Parâmetros de rastreamento e fragmentos são ignorados para deduplicação. Os limites são máximos: não criam oferta nem garantem cobertura de uma loja.

As fontes sem adaptador, incluindo Mercado Livre, continuam sinalizadas como indisponíveis. As integrações de páginas atualmente validadas são Netshoes e Centauro, além de fornecedores cujo catálogo público VTEX funciona.

## Páginas e créditos

Limitar a quantidade de ofertas exibidas não equivale a limitar o número de páginas lidas. A consulta de fornecedor foi reduzida de até 3 páginas para 1 página do catálogo do modelo. Os marketplaces/concorrentes integrados já leem somente 1 página Netshoes e 1 página Centauro por modelo; nenhuma página extra de produto é seguida. Portanto, o limite menor de ofertas não reduz novamente o gasto dessas duas páginas.

## Consultar apenas a marca oficial

Escolha **Somente fornecedor oficial** ao lado do botão de internet. A consulta lê apenas uma página de catálogo do fornecedor, sem chamar Firecrawl, marketplaces ou concorrentes. O site é escolhido pela marca do modelo na planilha. O filtro de marca usado para encontrar o modelo não controla as fontes da consulta.

Os caches de consulta oficial e completa são separados. Pedidos iguais são reaproveitados por 24h enquanto o serviço estiver ativo. No Render Free, reinícios/hibernação apagam o cache em memória. Os resultados armazenados e novos também são limitados no painel.
