# plugarme-amazon-offers-sync

Aplicação AdonisJS + TypeScript para sincronizar preço e estoque de produtos da Plugar.me com ofertas existentes na Amazon Brasil, usando as APIs mock fornecidas no desafio técnico.

## Stack

- Node.js
- TypeScript
- AdonisJS
- Japa para testes
- Mock API local incluída em `mock-api/`

## Estrutura

```text
api/
  app/
    clients/      # Integrações HTTP com Plugar.me e Amazon mock
    controllers/  # Entrada HTTP da sincronização
    services/     # Regras de negócio e orquestração
    types/        # Contratos TypeScript
  tests/unit/     # Testes unitários

mock-api/         # API externa simulada do desafio
docs/             # Material auxiliar de onboarding
```

## Variáveis de ambiente

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

A API Adonis roda na porta `3334` para não conflitar com a mock API, que roda na porta `3333`.

## Instalação

Instale as dependências da mock API:

```powershell
cd mock-api
npm install
```

Instale as dependências da aplicação:

```powershell
cd ..\api
npm install
```

## Execução

Terminal 1, mock API:

```powershell
cd mock-api
npm start
```

Terminal 2, aplicação AdonisJS:

```powershell
cd api
npm run dev
```

Health da aplicação:

```http
GET http://localhost:3334/
```

Documentação local da API:

```http
GET http://localhost:3334/docs
GET http://localhost:3334/openapi.json
```

Disparar sincronização:

```http
POST http://localhost:3334/sync/amazon/offers
Content-Type: application/json

{}
```

Também é possível sobrescrever os IDs configurados:

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

- `PS5-CONTROLE` deve ser publicado com preço `599` e estoque `100`.
- `KIT-576001` deve ser ignorado porque não possui preço válido.
- O token Amazon inicial deve ser renovado antes da publicação.

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

Rodar a suíte:

```powershell
cd api
npm test
```

Validações adicionais:

```powershell
npm run lint
npm run typecheck
```

Cobertura atual:

- Mapeamento Plugar.me para Amazon.
- Produto inativo.
- Produto sem preço válido.
- Produto sem estoque.
- Estoque `0` como valor válido.
- Payload Amazon sem custo.
- Clients HTTP com URL, headers e body corretos.
- Erro HTTP tipado.
- Refresh preventivo do token expirado.
- Refresh após `401`.
- Retry simples para `429`.
- Isolamento de falha por SKU.
- Logs técnicos do fluxo sem vazamento de segredos.
- Teste funcional da rota `POST /sync/amazon/offers`.
- Timeout em chamadas HTTP externas.
- Limite de produtos por execução para evitar processamento acidentalmente caro.
- Rejeição de identificadores inválidos antes de chamar APIs externas.

## Observabilidade e logs

A sincronização registra logs estruturados para facilitar troubleshooting em ambiente local ou real. Os principais eventos logados são:

- início e fim da sincronização;
- busca de credenciais Amazon;
- busca de produtos Plugar.me;
- avaliação de expiração do token;
- início, sucesso e falha de refresh do token Amazon;
- produto ignorado com motivo técnico;
- tentativa de publicação por SKU;
- sucesso de publicação com `submissionId`;
- rejeição `401` com refresh e nova tentativa;
- rate limit `429` com tentativa, limite de retry e backoff aplicado;
- falha final por SKU com status HTTP, método, URL e corpo de erro sanitizado.

Campos sensíveis são mascarados antes de entrar nos logs:

- `access_token`
- `refresh_token`
- `lwa_client_secret`
- `client_secret`
- `Authorization`
- `x-amz-access-token`

Essa proteção também é coberta por teste automatizado.

## Cenários manuais com a mock API

Resetar estado:

```powershell
Invoke-WebRequest -Uri http://localhost:3333/admin/reset -Method POST
```

Consultar estado:

```powershell
Invoke-WebRequest -Uri http://localhost:3333/admin/state
```

Alterar preço e estoque na origem:

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

Forçar rate limit na próxima publicação:

```powershell
Invoke-WebRequest -Uri http://localhost:3333/admin/fail-next-listing -Method POST
```

Expirar token no mock:

```powershell
Invoke-WebRequest -Uri http://localhost:3333/admin/expire-token -Method POST
```

## Decisões técnicas

- A aplicação fica em `api/` para manter a mock API original no mesmo repositório.
- Não há banco de dados, migrations, models ou ORM, respeitando a restrição do desafio.
- A sincronização é disparada por rota HTTP: `POST /sync/amazon/offers`.
- Os clients HTTP foram separados em `PlugarmeClient`, `AmazonAuthClient` e `AmazonListingsClient`.
- O serviço `SyncAmazonOffersService` concentra a orquestração e isola falhas por SKU.
- O token renovado fica apenas em memória durante a execução atual.
- `401` gera refresh e retry do SKU uma vez.
- `429` usa retry simples com backoff controlado.
- Produto sem preço válido ou sem estoque da filial configurada é ignorado com motivo explícito.
- Quantidade `0` é considerada válida e enviada para a Amazon.

## Segurança

- `access_token`, `refresh_token` e `client_secret` não são registrados em logs.
- Segredos reais não devem ser versionados.
- `.env` fica fora do Git; apenas `.env.example` é versionado.
- O payload enviado para a Amazon não inclui custo do produto.
- A rota de sincronização pode ser protegida com `SYNC_API_TOKEN`.
- `cliente_id` e `filial_id` são validados como inteiros positivos.
- O body parser aceita apenas `POST`, limita JSON/form a `10kb` e não processa multipart.
- CORS fica restrito a `GET/POST`, sem credenciais cross-origin.

## Controles de custo e recursos

- As chamadas externas possuem timeout configurável por `HTTP_TIMEOUT_MS`.
- A sincronização aborta se a origem retornar mais produtos que `MAX_PRODUCTS_PER_SYNC`.
- O processamento é sequencial, o que reduz risco de estouro de rate limit e evita rajadas de chamadas para a Amazon.
- `429` usa retry simples com backoff e limite de tentativas.
- Logs truncam strings longas de erro para evitar explosão de volume em respostas externas inesperadas.

## Como adaptar para a SP-API real

Para trocar o mock pela Amazon real, a estrutura principal pode permanecer:

- `AmazonAuthClient` passaria a chamar o endpoint real de Login with Amazon.
- `AmazonListingsClient` passaria a usar a URL real da Selling Partner API.
- Seria necessário adicionar a assinatura AWS SigV4 exigida pela SP-API real.
- Segredos deveriam sair de um cofre ou provedor seguro, não de `.env` local.
- Retries deveriam respeitar os headers reais de rate limit da Amazon.
- Persistência de tokens poderia ser adicionada se a aplicação passasse a rodar continuamente.
