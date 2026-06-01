# Documentação da API
## Visão Geral

A API expõe uma operação principal: disparar a sincronização de ofertas Amazon a
partir dos produtos da Plugar.me mock.

O fluxo executado pela rota de sincronização é:

1. Validar `cliente_id` e `filial_id`.
2. Buscar credenciais Amazon do cliente na Plugar.me mock.
3. Buscar produtos, preços e estoques da Plugar.me mock.
4. Renovar o token Amazon com `refresh_token` quando necessário.
5. Mapear produtos válidos para o payload de oferta Amazon.
6. Enviar `PATCH` para cada SKU publicável.
7. Retornar um resumo com itens publicados, ignorados e com falha.

## Base URL

Ambiente local:

```text
http://localhost:3334
```

Contrato OpenAPI:

```text
GET /openapi.json
```

Referência visual local:

```text
GET /docs
```

## Ambiente Técnico Validado

Validação final executada em `1 de junho de 2026`.

| Item | Versão/resultado |
| --- | --- |
| Node.js | `v24.14.0` |
| npm | `11.9.0` |
| TypeScript | `~6.0.3` |
| AdonisJS core | `^7.3.3` |
| AdonisJS assembler | `^8.4.0` |
| Japa runner | `^5.3.0` |
| Cobertura | `c8` |

Scripts principais da API:

```json
{
  "dev": "node ace serve --hmr",
  "test": "node ace test",
  "test:coverage": "c8 --reporter=text --reporter=html node ace test",
  "lint": "eslint .",
  "typecheck": "tsc --noEmit",
  "build": "node ace build"
}
```

## Evidência De Validação Final

Comandos executados como validação final:

| Comando | Resultado |
| --- | --- |
| `npm run lint` | Aprovado |
| `npm run typecheck` | Aprovado |
| `npm test` | Aprovado, `23 passed (23)` |
| `npm run test:coverage` | Aprovado, `23 passed (23)` |
| `npm run build` | Aprovado |
| `npm audit --omit=dev` | Aprovado, `0 vulnerabilities` |
| `npm audit` | Aprovado, `0 vulnerabilities` |

Resultado de cobertura gerado por `c8`:

| Métrica | Percentual |
| --- | --- |
| Statements | `96.29%` |
| Branches | `86.80%` |
| Functions | `92.45%` |
| Lines | `96.29%` |

Cobertura por áreas críticas:

| Área | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | ---: |
| `app/controllers` | `100%` | `100%` | `100%` | `100%` |
| `app/clients` | `97.96%` | `84.84%` | `100%` | `97.96%` |
| `app/services` | `94.65%` | `85.33%` | `100%` | `94.65%` |

Testes executados:

| Suíte | Cenário |
| --- | --- |
| Unit | `PlugarmeClient` busca produtos com autenticação e filtros |
| Unit | `PlugarmeClient` busca credenciais Amazon sem expor segredos |
| Unit | `AmazonAuthClient` renova access token com body form-url-encoded |
| Unit | `AmazonListingsClient` envia patch de oferta |
| Unit | Erro HTTP externo vira `HttpClientError` com status e mensagem sanitizada |
| Unit | Timeout HTTP gera erro controlado |
| Unit | Produto ativo vira candidato publicável Amazon |
| Unit | Produto inativo é ignorado |
| Unit | Produto sem preço válido é ignorado |
| Unit | Produto com preço não positivo é ignorado |
| Unit | Produto sem estoque da filial é ignorado |
| Unit | Estoque `0` é aceito como publicável |
| Unit | Payload Amazon não inclui custo do produto |
| Unit | Token expirado é renovado antes da publicação |
| Unit | Produtos inválidos são ignorados sem parar a sincronização |
| Unit | `401` da Amazon gera refresh e retry uma vez |
| Unit | `429` da Amazon gera retry com backoff |
| Unit | Falha em um SKU não para os demais |
| Unit | Logs técnicos não vazam segredos Amazon |
| Unit | Sincronização aborta quando excede `MAX_PRODUCTS_PER_SYNC` |
| Functional | Requisição sem `Authorization` é rejeitada quando `SYNC_API_TOKEN` está configurado |
| Functional | Identificadores inválidos retornam `422` antes de chamadas externas |
| Functional | Endpoint HTTP executa o fluxo completo da sincronização |

Validação ponta a ponta com mock API real:

| Verificação | Resultado |
| --- | --- |
| `POST http://localhost:3333/admin/reset` | `200` |
| `GET http://localhost:3334/docs` | `200` |
| `GET http://localhost:3334/openapi.json` | `200` |
| `POST http://localhost:3334/sync/amazon/offers` | `200` |
| Total de produtos no cenário inicial | `2` |
| Publicados | `1` |
| Ignorados | `1` |
| Falhas | `0` |
| Primeiro SKU publicado | `PS5-CONTROLE` |
| Primeiro motivo de ignore | `missing_valid_price` |
| IDs inválidos | `422` |

## Autenticação Da Rota De Sincronização

Por padrão, a rota pode ser chamada sem autenticação local. Para proteger o
disparo manual, configure `SYNC_API_TOKEN` no `.env`.

Quando `SYNC_API_TOKEN` existir, envie:

```http
Authorization: Bearer <SYNC_API_TOKEN>
```

Se o header estiver ausente ou incorreto, a API retorna `401`.

## Endpoints

### GET /

Health check simples da aplicação.

#### Request

```http
GET / HTTP/1.1
Host: localhost:3334
```

#### Response 200

```json
{
  "name": "plugarme-amazon-offers-sync-api",
  "status": "ok"
}
```

### GET /docs

Retorna uma página HTML autocontida com uma referência visual da API.

Use este endpoint quando quiser abrir a documentação no navegador sem instalar
Swagger UI ou qualquer frontend adicional.

### GET /openapi.json

Retorna o contrato OpenAPI 3.0 em JSON.

Use este endpoint para importar o contrato em ferramentas como Postman, Insomnia,
Hoppscotch ou Swagger Editor.

### POST /sync/amazon/offers

Dispara a sincronização de ofertas.

#### Headers

```http
Content-Type: application/json
Authorization: Bearer <SYNC_API_TOKEN>
```

`Authorization` só é obrigatório quando `SYNC_API_TOKEN` estiver configurado.

#### Body

O corpo é opcional. Se não for enviado, a API usa `CLIENTE_ID` e `FILIAL_ID` do
ambiente.

```json
{}
```

Também é possível informar os IDs explicitamente:

```json
{
  "cliente_id": 1,
  "filial_id": 6
}
```

#### Regras De Validação

| Campo | Tipo | Obrigatório | Regra |
| --- | --- | --- | --- |
| `cliente_id` | integer | Não | Deve ser inteiro positivo quando informado |
| `filial_id` | integer | Não | Deve ser inteiro positivo quando informado |

Valores inválidos são rejeitados antes de qualquer chamada externa.

#### Exemplo Com Curl

```bash
curl -X POST http://localhost:3334/sync/amazon/offers \
  -H "Content-Type: application/json" \
  -d "{}"
```

Com token local:

```bash
curl -X POST http://localhost:3334/sync/amazon/offers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer local-token" \
  -d '{"cliente_id":1,"filial_id":6}'
```

## Modelo Da Resposta De Sincronização

### Response 200

A resposta sempre consolida o resultado da execução em quatro grupos:

| Campo | Descrição |
| --- | --- |
| `summary.total` | Total de produtos retornados pela Plugar.me mock |
| `summary.published` | Quantidade de SKUs publicados na Amazon mock |
| `summary.skipped` | Quantidade de produtos ignorados por regra de negócio |
| `summary.failed` | Quantidade de SKUs que falharam durante publicação |
| `published` | Lista dos SKUs publicados com preço, estoque e `submissionId` |
| `skipped` | Lista dos produtos ignorados e o motivo técnico |
| `failed` | Lista dos SKUs com falha final após tratamento/retry |

Exemplo:

```json
{
  "summary": {
    "total": 2,
    "published": 1,
    "skipped": 1,
    "failed": 0
  },
  "published": [
    {
      "sku": "PS5-CONTROLE",
      "title": "Controle Sony DualSense PS5, Sem Fio, Branco ",
      "price": 599,
      "quantity": 100,
      "submissionId": "SUB-1",
      "status": "ACCEPTED"
    }
  ],
  "skipped": [
    {
      "sku": "KIT-576001",
      "title": "2 COCA COLA + 1 FANTA KIT 50% OFF",
      "reason": "missing_valid_price"
    }
  ],
  "failed": []
}
```

## Motivos De Produtos Ignorados

Produtos ignorados não são falhas técnicas. São produtos que não atendem aos
critérios mínimos para envio à Amazon.

| Motivo | Significado |
| --- | --- |
| `inactive_product` | Produto está inativo na origem |
| `missing_sku` | Produto não possui identificador para ser usado como SKU |
| `missing_valid_price` | Produto não possui preço válido para a filial |
| `missing_stock` | Produto não possui estoque para a filial |

Estoque `0` é válido. Ele representa produto sem disponibilidade, mas ainda deve
ser enviado se o preço for válido.

## Falhas Por SKU

Falhas em um SKU não interrompem a sincronização inteira. A API registra a falha
em `failed` e continua processando os demais produtos.

Exemplo de item com falha:

```json
{
  "sku": "PS5-CONTROLE",
  "title": "Controle Sony DualSense PS5, Sem Fio, Branco ",
  "reason": "http_error",
  "status": 422,
  "message": "Amazon listings request failed"
}
```

## Códigos HTTP Da API

| Status | Quando acontece |
| --- | --- |
| `200` | Sincronização executada e resultado consolidado retornado |
| `401` | `SYNC_API_TOKEN` configurado e header `Authorization` ausente/incorreto |
| `422` | `cliente_id` ou `filial_id` inválido |
| `500` | Erro inesperado antes da consolidação do resultado |

Falhas individuais de publicação na Amazon mock normalmente continuam dentro de
uma resposta `200`, no array `failed`, porque a execução como um todo conseguiu
consolidar o resultado.

## Integrações Externas Consumidas

A API Adonis consome a mock API em `http://localhost:3333`.

### Plugar.me Mock

Responsabilidades:

- Buscar produtos do cliente.
- Buscar credenciais Amazon do cliente.
- Fornecer preços e estoques por filial.

### Amazon Auth Mock

Responsabilidade:

- Renovar o access token Amazon usando `refresh_token`, `lwa_client_id` e
  `lwa_client_secret`.

### Amazon Listings Mock

Responsabilidade:

- Receber o `PATCH` de oferta para atualizar preço e estoque de um SKU já
  cadastrado na Amazon.

## Payload Enviado Para Amazon Listings Mock

A aplicação envia apenas dados de oferta. O custo do produto não é enviado.

Exemplo conceitual:

```json
{
  "productType": "PRODUCT",
  "patches": [
    {
      "op": "replace",
      "path": "/attributes/purchasable_offer",
      "value": [
        {
          "marketplace_id": "A2Q3Y263D00KWC",
          "currency": "BRL",
          "our_price": [
            {
              "schedule": [
                {
                  "value_with_tax": 599
                }
              ]
            }
          ]
        }
      ]
    },
    {
      "op": "merge",
      "path": "/attributes/fulfillment_availability",
      "value": [
        {
          "fulfillment_channel_code": "DEFAULT",
          "quantity": 100
        }
      ]
    }
  ]
}
```

## Tratamento De Token Amazon

O token inicial da mock API pode estar expirado. A aplicação trata isso de duas
formas:

- Antes de publicar, verifica a expiração conhecida do token.
- Se a Amazon mock responder `401`, renova o token e tenta o SKU novamente uma vez.

O token renovado fica em memória apenas durante a execução atual. Não há banco de
dados nem persistência de token, conforme a restrição do desafio.

## Rate Limit

Quando a Amazon mock retorna `429`, a aplicação aplica retry simples com backoff.

Esse comportamento evita falha imediata em um cenário transitório, mas mantém um
limite de tentativas para não criar loop infinito nem custo operacional indevido.

## Logs E Troubleshooting

Os logs foram pensados para responder rapidamente:

- Qual cliente e filial dispararam a sincronização?
- Quantos produtos vieram da origem?
- Qual SKU foi publicado?
- Qual SKU foi ignorado e por qual regra?
- Qual SKU falhou, com qual status HTTP e em qual endpoint externo?
- Houve refresh de token?
- Houve rate limit e retry?

Mensagens textuais registradas pela aplicação:

| Nível | Mensagem de log | Quando aparece |
| --- | --- | --- |
| `info` | `Starting Plugar.me to Amazon offer synchronization` | Início do fluxo de sincronização |
| `debug` | `Fetching Amazon credentials from Plugar.me` | Antes de buscar credenciais Amazon na Plugar.me mock |
| `debug` | `Fetched Amazon credentials metadata` | Após buscar metadados das credenciais, sem logar tokens/secrets |
| `debug` | `Fetching products from Plugar.me` | Antes de buscar produtos, preços e estoques |
| `info` | `Fetched products from Plugar.me` | Após retorno da lista de produtos |
| `error` | `Aborting offer synchronization because product count exceeds configured safety limit` | Quando `products.length` excede `MAX_PRODUCTS_PER_SYNC` |
| `warn` | `Amazon access token is expired before publishing` | Quando o token inicial já está expirado |
| `debug` | `Amazon access token is still valid before publishing` | Quando o token inicial ainda é válido |
| `warn` | `Refreshing Amazon access token` | Antes de chamar o endpoint de refresh |
| `info` | `Amazon access token refreshed` | Após refresh bem-sucedido |
| `error` | `Failed to refresh Amazon access token` | Quando a renovação do token falha |
| `warn` | `Skipping product during offer synchronization` | Quando um produto é ignorado por regra de negócio |
| `debug` | `Publishing Amazon offer` | Antes de enviar o `PATCH` para um SKU |
| `info` | `Amazon offer published` | Após publicação aceita pela Amazon mock |
| `warn` | `Amazon rejected offer publication because the access token is invalid or expired` | Quando a Amazon mock retorna `401` no patch da oferta |
| `warn` | `Amazon rate limit reached while publishing offer; retrying after backoff` | Quando a Amazon mock retorna `429` e ainda há retry disponível |
| `error` | `Failed to publish Amazon offer` | Quando um SKU falha definitivamente |
| `info` | `Finished Plugar.me to Amazon offer synchronization` | Fim do fluxo, com resumo consolidado |
| `warn` | `Rejected unauthorized offer sync request` | Quando `SYNC_API_TOKEN` está configurado e o header é ausente/incorreto |
| `warn` | `Rejected offer sync request with invalid identifiers` | Quando `cliente_id` ou `filial_id` é inválido |

Dados sensíveis são mascarados antes de ir para log:

- `access_token`
- `refresh_token`
- `lwa_client_secret`
- `client_secret`
- `Authorization`
- `x-amz-access-token`

Formato esperado dos logs de erro HTTP externo:

```json
{
  "error": {
    "name": "HttpClientError",
    "message": "Amazon listings request failed",
    "status": 429,
    "method": "PATCH",
    "url": "http://localhost:3333/amazon/listings/2021-08-01/items/A1PLUGARMESELLERBR/PS5-CONTROLE",
    "responseBody": {
      "error": "rate_limit"
    }
  }
}
```

Quando um campo sensível aparece em algum objeto logado, o valor vira:

```json
{
  "access_token": "[REDACTED]",
  "refresh_token": "[REDACTED]",
  "lwa_client_secret": "[REDACTED]"
}
```

Strings longas de erro são truncadas após `1000` caracteres para evitar explosão
de volume em log.

## Limites Operacionais

| Controle | Configuração | Objetivo |
| --- | --- | --- |
| Timeout HTTP | `HTTP_TIMEOUT_MS` | Evitar chamadas externas presas indefinidamente |
| Limite de produtos | `MAX_PRODUCTS_PER_SYNC` | Evitar execuções acidentalmente grandes |
| Body limitado | `10kb` | Reduzir superfície para abuso da rota |
| Processamento sequencial | Código da sync | Reduzir rajadas contra a Amazon mock |
| Retry limitado | Código dos clients/serviço | Evitar loop infinito em `401` ou `429` |

## Preocupações De Segurança Tratadas

| Ponto | Tratamento aplicado |
| --- | --- |
| Segredos em log | Tokens, secrets e headers sensíveis são mascarados com `[REDACTED]` |
| Vazamento de custo | O custo do produto vindo do estoque não entra no payload Amazon |
| Disparo indevido da sync | `SYNC_API_TOKEN` pode proteger a rota com Bearer token |
| Entrada inválida | `cliente_id` e `filial_id` são aceitos apenas como inteiros positivos |
| Body excessivo | Body parser limitado a `10kb` para JSON/form |
| Upload desnecessário | Multipart desabilitado |
| CORS amplo demais | Métodos restritos a `GET` e `POST`, sem credenciais cross-origin |
| Chamadas externas presas | Timeout configurável por `HTTP_TIMEOUT_MS` |
| Execução grande acidental | Limite por `MAX_PRODUCTS_PER_SYNC` |
| Rate limit | Retry limitado com backoff |
| Falha parcial | Erro em um SKU não interrompe a execução dos demais |

## Pontos De Atenção Para Produção Real

Estes pontos não bloqueiam o desafio porque a tarefa usa mock API e dispensa
banco de dados, mas seriam importantes numa integração real:

- Persistir tokens renovados em armazenamento seguro se a aplicação rodar de forma contínua.
- Buscar segredos em cofre, Secret Manager ou variável protegida do ambiente, não em `.env` local.
- Adicionar assinatura AWS SigV4 para chamada real da Selling Partner API.
- Respeitar headers reais de rate limit da Amazon em vez de apenas backoff fixo.
- Adicionar idempotência/rastreamento por execução se múltiplos disparos puderem ocorrer ao mesmo tempo.
- Adicionar fila ou job runner para sincronizações grandes, evitando request HTTP longo.
- Adicionar métricas além de logs, como quantidade de SKUs publicados, falhos e ignorados por execução.
- Adicionar alertas para falhas recorrentes de token, `429`, `5xx` externo e excesso de produtos.
- Definir política de retenção de logs para evitar armazenamento desnecessário de dados operacionais.
- Rever `CORS_ORIGIN` por ambiente antes de expor a API fora do localhost.
- Versionar contrato de API se novos endpoints ou formatos de resposta forem adicionados.
- Adicionar autenticação mais robusta se o endpoint for exposto publicamente.