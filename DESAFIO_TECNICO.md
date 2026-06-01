# Desafio Técnico — Integração de Ofertas Plugar.me → Amazon Brasil

## Contexto

A **Plugar.me** é um hub de integração entre ERPs, e-commerces e marketplaces. Neste desafio, você deverá construir uma aplicação para manter **preço e estoque** sincronizados entre a Plugar.me e a **Amazon Brasil**.

Para manter o teste objetivo, considere que os produtos já possuem anúncios correspondentes na Amazon. Não será necessário criar novos anúncios, importar pedidos ou utilizar banco de dados.

## Objetivo

Desenvolver uma aplicação em **Node.js + TypeScript + AdonisJS** capaz de:

1. Consultar produtos, preços e estoques em uma API mock da Plugar.me.
2. Obter, por API, as credenciais Amazon SP-API de um cliente.
3. Tratar a expiração do `access_token` Amazon e renová-lo via `refresh_token`.
4. Atualizar preço e estoque de cada SKU válido na Amazon Brasil.
5. Permitir nova execução para republicar alterações realizadas na origem.

## Tecnologias e restrições

- Obrigatório: **Node.js, TypeScript e AdonisJS**.
- Não utilizar banco de dados.
- A integração deve consumir somente as APIs fornecidas.
- A sincronização deve ser disparada por uma rota HTTP ou comando Ace documentado no `README`.
- Não é necessário configurar cron, filas ou autenticação real da Amazon.

## Fluxo esperado

```text
Aplicação AdonisJS
  ├── consulta produto/preço/estoque na Plugar.me Mock
  ├── consulta credenciais Amazon do cliente na Plugar.me Mock
  ├── identifica access_token expirado ou reage a HTTP 401
  ├── troca refresh_token por novo access_token no endpoint LWA Mock
  └── envia PATCH da oferta existente para a Amazon Listings Mock
```

## Configuração

```env
PLUGARME_BASE_URL=http://localhost:3333/plugarme/v1
PLUGARME_API_TOKEN=plugarme-test-token
AMAZON_SP_API_BASE_URL=http://localhost:3333/amazon
CLIENTE_ID=1
FILIAL_ID=6
```

## Endpoints disponibilizados

### Produtos Plugar.me

```http
GET /plugarme/v1/produtos?cliente_id=1&filial_id=6
Authorization: Bearer plugarme-test-token
```

Mapeamento:

| Origem Plugar.me                             | Destino Amazon                       |
| -------------------------------------------- | ------------------------------------ |
| `erp_id`                                     | SKU                                  |
| `preco[].preco` da filial configurada        | Preço da oferta                      |
| `estoque[].quantidade` da filial configurada | Quantidade disponível                |
| `titulo`                                     | Uso interno/log; o anúncio já existe |

### Credenciais Amazon do cliente

```http
GET /plugarme/v1/integracoes/amazon/credenciais?cliente_id=1
Authorization: Bearer plugarme-test-token
```

Exemplo de resposta:

```json
{
  "data": {
    "cliente_id": 1,
    "filial_id": 6,
    "seller_id": "A1PLUGARMESELLERBR",
    "marketplace_id": "A2Q3Y263D00KWC",
    "lwa_client_id": "...",
    "lwa_client_secret": "...",
    "refresh_token": "...",
    "access_token": "...",
    "access_token_expires_at": "..."
  }
}
```

O mock retorna propositalmente um `access_token` expirado.

### Renovação do token Amazon LWA

```http
POST /amazon/auth/o2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token={refresh_token}
&client_id={lwa_client_id}
&client_secret={lwa_client_secret}
```

A resposta retorna um novo `access_token` com `expires_in = 3600`.

### Atualização de preço e estoque Amazon

```http
PATCH /amazon/listings/2021-08-01/items/{seller_id}/{sku}?marketplaceIds={marketplace_id}
x-amz-access-token: {access_token}
Content-Type: application/json
```

Payload aceito pelo mock:

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
          "our_price": [{ "schedule": [{ "value_with_tax": 599 }] }]
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

## Regras obrigatórias

### Catálogo/oferta

- Processar somente produtos com `ativo = true`.
- Utilizar `erp_id` como SKU.
- Selecionar preço e estoque apenas da filial configurada.
- Produto sem preço válido deve ser ignorado e registrado em log.
- Produto sem registro de estoque deve ser ignorado e registrado em log.
- Quantidade `0` é válida e deve ser enviada.
- Não enviar custo do produto para a Amazon.

### Token Amazon

- O `access_token` inicial estará expirado.
- A aplicação deve renová-lo utilizando `refresh_token`, `lwa_client_id` e `lwa_client_secret`, antes do envio ou após receber `401`.
- O token renovado deve ser reutilizado durante a execução corrente.
- Como não haverá banco de dados, não é necessário persistir o novo token após reiniciar a aplicação.
- Nunca registrar tokens ou `client_secret` nos logs.

### Falhas

- Uma falha em um SKU não deve encerrar o processamento dos demais.
- Tratar o retorno `401` por token inválido/expirado.
- Tratar ou documentar estratégia para `429`; retry simples com backoff é suficiente.
- Gerar resultado identificando itens publicados, ignorados e falhas.

## Entregáveis

1. Repositório Git com a aplicação AdonisJS.
2. `README.md` com instalação, execução, variáveis de ambiente e decisões técnicas.

## Critérios de avaliação — 100 pontos

| Área                             | Pontos | Avaliação                                             |
| -------------------------------- | -----: | ----------------------------------------------------- |
| Integração produto/preço/estoque |     35 | consulta, seleção por filial, mapeamento e publicação |
| Renovação do token Amazon        |     25 | fluxo LWA, reuso do token e proteção de segredos      |
| AdonisJS e qualidade do código   |     15 | estrutura, tipagem, clients/services/controllers      |
| Erros e observabilidade          |     15 | `401`, `429`, logs e isolamento por SKU               |

## Diferenciais

- Separação entre `PlugarmeClient`, `AmazonAuthClient`, `AmazonListingsClient` e serviço de sincronização.
- Rota com validator ou comando Ace bem estruturado.
- Retry controlado para `429`.
- Resposta da sincronização com totais de publicados, ignorados e falhas.
- Explicação de como substituir o mock pela SP-API real.
