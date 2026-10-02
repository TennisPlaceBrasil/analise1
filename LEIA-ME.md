# Análise de preços Tennis Place

Painel: https://tennisplacebrasil.github.io/analise1/

## Uso

1. Pesquise modelo/agrupador na base fixa do Google. Sem pesquisa, nenhuma relação é exibida.
2. Escolha um modelo. O painel mostra custos, vendas, markup, preço-alvo e ofertas guardadas com suas datas originais. Custos zero/vazios ficam pendentes.
3. Clique em **Pesquisar este modelo na internet**. Confirme a solicitação preenchida no GitHub, conectado como proprietário ou colaborador do repositório.
4. A fila automática valida o agrupador na planilha, consulta o fornecedor e as páginas Netshoes/Centauro, publica e encerra a solicitação. O painel verifica novos resultados por 10 minutos; também há **Recarregar resultados**.

O botão abre uma solicitação do GitHub, não uma pesquisa na loja. GitHub Pages não executa código de servidor; esta ponte autenticada usa o GitHub Actions existente sem colocar chaves no HTML. Para enviar direto do HTML, sem confirmação no GitHub, será necessário hospedar um endpoint autenticado. Não há endpoint configurado nesta versão.

## Controle da fila e consumo

- Nenhuma marca/modelo é escolhido automaticamente. Apenas solicitações abertas por OWNER/MEMBER/COLLABORATOR, com título `[Pesquisa TP] ` e JSON válido.
- Apenas marca + agrupador existente na planilha; URLs digitadas não são usadas.
- Solicitações duplicadas do mesmo modelo se juntam. Consulta desse modelo reaproveitada por 24 horas (inclusive falhas, para não gastar em repetição).
- Até 5 modelos por execução; 1 página Netshoes + 1 página Centauro/modelo; sem seguir páginas de produto.
- Limite interno de 20 tentativas de páginas/dia e 200/mês, em UTC. Não é o saldo da conta Firecrawl, nem inclui testes anteriores/outros serviços. Pedidos além do limite continuam abertos até o próximo período.
- Solicitação aberta dispara a fila. Uma verificação a cada hora retoma pedidos pendentes; atrasos do GitHub podem ocorrer. Fila vazia não consulta fornecedores/Firecrawl.
- Push do código publica somente a interface e preserva preços existentes; não pesquisa a internet. `workflow_dispatch` processa apenas pedidos existentes; não há opção de lote aleatório.
- Após publicar com sucesso, as solicitações processadas são encerradas. IDs processados ficam no cache para evitar repetição se o encerramento falhar.
- Se a última publicação estiver indisponível, nenhuma consulta é executada para evitar perder resultados e controle de consumo.
- Sem repetição automática de falhas por loja: resultado parcial e motivo ficam visíveis. Uma nova solicitação depois de 24h permite tentar novamente.

## Cobertura e limites

O fornecedor usa a API pública de catálogo VTEX quando compatível. Outras plataformas/bloqueios continuam indisponíveis até que tenham adaptador validado. Netshoes usa JSON-LD de ofertas; Centauro usa JSON embutido. Ambas exigem BRL, estoque e modelo/marca/sexo comparáveis; o adaptador atual é de tênis. Modelos de vestuário/acessórios podem não gerar resultados externos. Kits e versões adicionais não são comparáveis.

Mercado Livre, W Tennis, Flávios, B2 Online e Decathlon não possuem adaptadores validados neste projeto. São identificados como indisponíveis, sem tentativas repetidas de API incompatível. Não há promessa de cobrir todos os sites.

A pesquisa tem cobertura parcial: consulta duas páginas de busca, sem garantir todas as cores/tamanhos. Ofertas antigas continuam disponíveis com a data original; não são apresentadas como novas. Preços em BRL, sem frete. Condições e vendedor são identificados quando fornecidos pela loja.

Secret necessário: `FIRECRAWL_API_KEY` no repositório. `GITHUB_TOKEN` é fornecido automaticamente pelo executor, com permissão de issues. Nunca colocar segredo no HTML.

## Validação

Node 22+: `node --test *.test.mjs`

Testes verificam correspondência, estoque/moeda/domínio, exclusão de kits, fila autorizada, deduplicação, orçamento, ausência de pesquisas em publicação/fila vazia e preservação de outros modelos. Os testes de execução usam serviços simulados e não consomem créditos.
