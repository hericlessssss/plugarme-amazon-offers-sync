# plugarme-amazon-offers-sync

Aplicacao AdonisJS + TypeScript para sincronizar preco e estoque de produtos da Plugar.me com ofertas existentes na Amazon Brasil, usando as APIs mock fornecidas no desafio tecnico.

## Stack

- Node.js
- TypeScript
- AdonisJS
- Japa para testes
- Mock API local incluida em `mock-api/`

## Estrutura

```text
api/
  app/
    clients/      # Integracoes HTTP com Plugar.me e Amazon mock
    controllers/  # Entrada HTTP da sincronizacao
    services/     # Regras de negocio e orquestracao
    types/        # Contratos TypeScript
  tests/unit/     # Testes unitarios

mock-api/         # API externa simulada do desafio
docs/             # Material auxiliar de onboarding
```

## Variaveis de ambiente

Crie o `.env` da API a partir do exemplo:

```powershell
cd api
Copy-Item .env.example .env
node ace generate:key
```

Valores principais:

```env
PORT=3334
PLUGARME_BASE_URL=http://localhost:3333/plugarme/v1
PLUGARME_API_TOKEN=plugarme-test-token
AMAZON_SP_API_BASE_URL=http://localhost:3333/amazon
CLIENTE_ID=1
FILIAL_ID=6
HTTP_TIMEOUT_MS=5000
MAX_PRODUCTS_PER_SYNC=1000
```

A API Adonis roda na porta `3334` para nao conflitar com a mock API, que roda na porta `3333`.

## Instalacao

Instale as dependencias da mock API:

```powershell
cd mock-api
npm install
```

Instale as dependencias da aplicacao:

```powershell
cd ..\api
npm install
```

## Execucao

Terminal 1, mock API:

```powershell
cd mock-api
npm start
```

Terminal 2, aplicacao AdonisJS:

```powershell
cd api
npm run dev
```

Health da aplicacao:

```http
GET http://localhost:3334/
```

Disparar sincronizacao:

```http
POST http://localhost:3334/sync/amazon/offers
Content-Type: application/json

{}
```

Tambem e possivel sobrescrever os IDs configurados:

```json
{
  "cliente_id": 1,
  "filial_id": 6
}
```

Se `SYNC_API_TOKEN` estiver configurado no `.env`, a rota exige:

```http
Authorization: Bearer <SYNC_API_TOKEN>
```

## Resultado esperado

Na carga inicial da mock API:

- `PS5-CONTROLE` deve ser publicado com preco `599` e estoque `100`.
- `KIT-576001` deve ser ignorado porque nao possui preco valido.
- O token Amazon inicial deve ser renovado antes da publicacao.

Exemplo de resposta:

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

## Testes

Rodar a suite:

```powershell
cd api
npm test
```

Validacoes adicionais:

```powershell
npm run lint
npm run typecheck
```

Cobertura atual:

- Mapeamento Plugar.me para Amazon.
- Produto inativo.
- Produto sem preco valido.
- Produto sem estoque.
- Estoque `0` como valor valido.
- Payload Amazon sem custo.
- Clients HTTP com URL, headers e body corretos.
- Erro HTTP tipado.
- Refresh preventivo do token expirado.
- Refresh apos `401`.
- Retry simples para `429`.
- Isolamento de falha por SKU.
- Logs tecnicos do fluxo sem vazamento de segredos.
- Teste funcional da rota `POST /sync/amazon/offers`.
- Timeout em chamadas HTTP externas.
- Limite de produtos por execucao para evitar processamento acidentalmente caro.
- Rejeicao de identificadores invalidos antes de chamar APIs externas.

## Observabilidade e logs

A sincronizacao registra logs estruturados para facilitar troubleshooting em ambiente local ou real. Os principais eventos logados sao:

- inicio e fim da sincronizacao;
- busca de credenciais Amazon;
- busca de produtos Plugar.me;
- avaliacao de expiracao do token;
- inicio, sucesso e falha de refresh do token Amazon;
- produto ignorado com motivo tecnico;
- tentativa de publicacao por SKU;
- sucesso de publicacao com `submissionId`;
- rejeicao `401` com refresh e nova tentativa;
- rate limit `429` com tentativa, limite de retry e backoff aplicado;
- falha final por SKU com status HTTP, metodo, URL e corpo de erro sanitizado.

Campos sensiveis sao mascarados antes de entrar nos logs:

- `access_token`
- `refresh_token`
- `lwa_client_secret`
- `client_secret`
- `Authorization`
- `x-amz-access-token`

Essa protecao tambem e coberta por teste automatizado.

## Cenários manuais com a mock API

Resetar estado:

```powershell
Invoke-WebRequest -Uri http://localhost:3333/admin/reset -Method POST
```

Consultar estado:

```powershell
Invoke-WebRequest -Uri http://localhost:3333/admin/state
```

Alterar preco e estoque na origem:

```powershell
Invoke-WebRequest `
  -Uri http://localhost:3333/admin/plugarme/produtos/PS5-CONTROLE `
  -Method PATCH `
  -ContentType 'application/json' `
  -Body '{"preco":549.90,"quantidade":12}'
```

Publicar estoque zero:

```powershell
Invoke-WebRequest `
  -Uri http://localhost:3333/admin/plugarme/produtos/PS5-CONTROLE `
  -Method PATCH `
  -ContentType 'application/json' `
  -Body '{"quantidade":0}'
```

Forcar rate limit na proxima publicacao:

```powershell
Invoke-WebRequest -Uri http://localhost:3333/admin/fail-next-listing -Method POST
```

Expirar token no mock:

```powershell
Invoke-WebRequest -Uri http://localhost:3333/admin/expire-token -Method POST
```

## Decisoes tecnicas

- A aplicacao fica em `api/` para manter a mock API original no mesmo repositorio.
- Nao ha banco de dados, migrations, models ou ORM, respeitando a restricao do desafio.
- A sincronizacao e disparada por rota HTTP: `POST /sync/amazon/offers`.
- Os clients HTTP foram separados em `PlugarmeClient`, `AmazonAuthClient` e `AmazonListingsClient`.
- O servico `SyncAmazonOffersService` concentra a orquestracao e isola falhas por SKU.
- O token renovado fica apenas em memoria durante a execucao atual.
- `401` gera refresh e retry do SKU uma vez.
- `429` usa retry simples com backoff controlado.
- Produto sem preco valido ou sem estoque da filial configurada e ignorado com motivo explicito.
- Quantidade `0` e considerada valida e enviada para a Amazon.

## Seguranca

- `access_token`, `refresh_token` e `client_secret` nao sao registrados em logs.
- Segredos reais nao devem ser versionados.
- `.env` fica fora do Git; apenas `.env.example` e versionado.
- O payload enviado para a Amazon nao inclui custo do produto.
- A rota de sincronizacao pode ser protegida com `SYNC_API_TOKEN`.
- `cliente_id` e `filial_id` sao validados como inteiros positivos.
- O body parser aceita apenas `POST`, limita JSON/form a `10kb` e nao processa multipart.
- CORS fica restrito a `GET/POST`, sem credenciais cross-origin.

## Controles de custo e recursos

- As chamadas externas possuem timeout configuravel por `HTTP_TIMEOUT_MS`.
- A sincronizacao aborta se a origem retornar mais produtos que `MAX_PRODUCTS_PER_SYNC`.
- O processamento e sequencial, o que reduz risco de estouro de rate limit e evita rajadas de chamadas para a Amazon.
- `429` usa retry simples com backoff e limite de tentativas.
- Logs truncam strings longas de erro para evitar explosao de volume em respostas externas inesperadas.

## Como adaptar para a SP-API real

Para trocar o mock pela Amazon real, a estrutura principal pode permanecer:

- `AmazonAuthClient` passaria a chamar o endpoint real de Login with Amazon.
- `AmazonListingsClient` passaria a usar a URL real da Selling Partner API.
- Seria necessario adicionar a assinatura AWS SigV4 exigida pela SP-API real.
- Segredos deveriam sair de um cofre ou provedor seguro, nao de `.env` local.
- Retries deveriam respeitar os headers reais de rate limit da Amazon.
- Persistencia de tokens poderia ser adicionada se a aplicacao passasse a rodar continuamente.
