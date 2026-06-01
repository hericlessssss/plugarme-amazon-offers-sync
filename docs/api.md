# Documentação da API

Este documento descreve o contrato HTTP da aplicação `plugarme-amazon-offers-sync`.
Ele complementa o `README.md`: o README explica como instalar e executar; este
arquivo explica como consumir a API, quais respostas esperar e como investigar
falhas.

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

Dados sensíveis são mascarados antes de ir para log:

- `access_token`
- `refresh_token`
- `lwa_client_secret`
- `client_secret`
- `Authorization`
- `x-amz-access-token`

## Limites Operacionais

| Controle | Configuração | Objetivo |
| --- | --- | --- |
| Timeout HTTP | `HTTP_TIMEOUT_MS` | Evitar chamadas externas presas indefinidamente |
| Limite de produtos | `MAX_PRODUCTS_PER_SYNC` | Evitar execuções acidentalmente grandes |
| Body limitado | `10kb` | Reduzir superfície para abuso da rota |
| Processamento sequencial | Código da sync | Reduzir rajadas contra a Amazon mock |
| Retry limitado | Código dos clients/serviço | Evitar loop infinito em `401` ou `429` |

## Checklist Para Validar A API

Antes de considerar a API pronta para entrega:

- `GET /` responde `200`.
- `GET /docs` abre no navegador.
- `GET /openapi.json` retorna JSON válido.
- `POST /sync/amazon/offers` publica `PS5-CONTROLE` no estado inicial da mock.
- Produto sem preço válido aparece em `skipped`.
- Estoque `0` é enviado como quantidade válida.
- `401` da Amazon mock gera refresh e retry.
- `429` da Amazon mock gera retry com backoff.
- `cliente_id` e `filial_id` inválidos retornam `422`.
- Logs não exibem tokens nem secrets.
