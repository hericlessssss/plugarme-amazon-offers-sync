# Mock API — Plugar.me → Amazon Brasil

Mock para o desafio técnico simplificado. A aplicação do candidato deve ser criada em **AdonisJS**; este servidor representa as APIs externas consumidas por ela.

## Executar

Requisito: Node.js 18+.

```bash
cd mock-api
npm start
```

URL: `http://localhost:3333`

## Variáveis para a aplicação candidata

```env
PLUGARME_BASE_URL=http://localhost:3333/plugarme/v1
PLUGARME_API_TOKEN=plugarme-test-token
AMAZON_SP_API_BASE_URL=http://localhost:3333/amazon
CLIENTE_ID=1
FILIAL_ID=6
```

## Endpoints consumidos pelo candidato

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/plugarme/v1/produtos?cliente_id=1&filial_id=6` | Produtos, preços e estoques |
| `GET` | `/plugarme/v1/integracoes/amazon/credenciais?cliente_id=1` | Credenciais e token expirado |
| `POST` | `/amazon/auth/o2/token` | Renovar access token |
| `PATCH` | `/amazon/listings/2021-08-01/items/{sellerId}/{sku}?marketplaceIds={marketplaceId}` | Publicar preço/estoque |

## Dados preparados

- `PS5-CONTROLE`: preço `599`, estoque `100`; deve ser publicado.
- `KIT-576001`: sem preço; deve ser ignorado.

## Endpoints reservados ao avaliador

```bash
curl -X POST http://localhost:3333/admin/reset
curl http://localhost:3333/admin/state

curl -X PATCH http://localhost:3333/admin/plugarme/produtos/PS5-CONTROLE   -H 'Content-Type: application/json'   -d '{"preco":549.90,"quantidade":12}'

curl -X PATCH http://localhost:3333/admin/plugarme/produtos/PS5-CONTROLE   -H 'Content-Type: application/json'   -d '{"quantidade":0}'

curl -X POST http://localhost:3333/admin/expire-token
curl -X POST http://localhost:3333/admin/fail-next-listing
```
