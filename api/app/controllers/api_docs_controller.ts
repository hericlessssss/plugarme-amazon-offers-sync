export default class ApiDocsController {
  openapi() {
    return {
      openapi: '3.0.3',
      info: {
        title: 'Plugar.me Amazon Offers Sync API',
        version: '1.0.0',
        description:
          'API local para disparar a sincronização de preço e estoque entre Plugar.me e Amazon Brasil mock.',
      },
      servers: [
        {
          url: 'http://localhost:3334',
          description: 'AdonisJS local server',
        },
      ],
      paths: {
        '/': {
          get: {
            summary: 'Health check',
            responses: {
              '200': {
                description: 'Aplicação disponível',
              },
            },
          },
        },
        '/sync/amazon/offers': {
          post: {
            summary: 'Dispara sincronização de ofertas',
            description:
              'Busca produtos e credenciais na Plugar.me mock, renova token Amazon quando necessário e publica preço/estoque na Amazon mock.',
            security: [{ bearerAuth: [] }],
            requestBody: {
              required: false,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      cliente_id: {
                        type: 'integer',
                        example: 1,
                      },
                      filial_id: {
                        type: 'integer',
                        example: 6,
                      },
                    },
                  },
                  examples: {
                    defaults: {
                      summary: 'Usar variáveis de ambiente',
                      value: {},
                    },
                    explicit: {
                      summary: 'Sobrescrever cliente e filial',
                      value: {
                        cliente_id: 1,
                        filial_id: 6,
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                description: 'Resultado consolidado da sincronização',
              },
              '401': {
                description: 'SYNC_API_TOKEN configurado e Authorization inválido ou ausente',
              },
              '422': {
                description: 'cliente_id ou filial_id inválido',
              },
            },
          },
        },
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            description: 'Obrigatório somente quando SYNC_API_TOKEN estiver configurado.',
          },
        },
      },
    }
  }

  html() {
    return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Plugar.me Amazon Offers Sync API</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f8fb;
      --surface: #ffffff;
      --ink: #172033;
      --muted: #667085;
      --line: #d9e2ec;
      --accent: #146c94;
      --success: #1f8a70;
      --warning: #9a6414;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.55;
    }
    main {
      max-width: 980px;
      margin: 0 auto;
      padding: 40px 20px 64px;
    }
    header {
      margin-bottom: 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(2rem, 4vw, 3.2rem);
      line-height: 1.05;
      letter-spacing: 0;
    }
    h2 {
      margin: 0 0 14px;
      font-size: 1.25rem;
    }
    p {
      margin: 0 0 12px;
      color: var(--muted);
    }
    a { color: var(--accent); }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    section {
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 12px 28px rgba(23, 32, 51, 0.06);
    }
    code, pre {
      font-family: "Cascadia Code", "JetBrains Mono", Consolas, monospace;
    }
    code {
      background: #eef6fb;
      border: 1px solid #d4e8f2;
      border-radius: 5px;
      padding: 0.08rem 0.3rem;
      color: #133c55;
    }
    pre {
      margin: 12px 0 0;
      padding: 14px;
      overflow: auto;
      color: #edf4fb;
      background: #243447;
      border-radius: 8px;
    }
    .method {
      display: inline-flex;
      align-items: center;
      min-width: 58px;
      justify-content: center;
      border-radius: 999px;
      padding: 4px 9px;
      color: white;
      font-weight: 800;
      font-size: 0.78rem;
      background: var(--accent);
    }
    .method.get { background: var(--success); }
    .note {
      border-color: #ead9b9;
      background: #fff8ea;
      color: #6d4710;
    }
    .note p { color: #6d4710; }
    ul {
      margin: 8px 0 0;
      padding-left: 20px;
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Plugar.me Amazon Offers Sync API</h1>
      <p>Referência local da API AdonisJS para sincronização de preço e estoque entre Plugar.me e Amazon Brasil mock.</p>
      <p><a href="/openapi.json">Abrir OpenAPI JSON</a></p>
    </header>

    <section class="note">
      <h2>Autenticação</h2>
      <p>Se <code>SYNC_API_TOKEN</code> estiver configurado no <code>.env</code>, envie <code>Authorization: Bearer &lt;token&gt;</code> na rota de sincronização.</p>
    </section>

    <div class="grid">
      <section>
        <h2><span class="method get">GET</span> /</h2>
        <p>Health check da aplicação.</p>
        <pre><code>curl http://localhost:3334/</code></pre>
      </section>

      <section>
        <h2><span class="method">POST</span> /sync/amazon/offers</h2>
        <p>Dispara a sincronização de ofertas usando os IDs do ambiente ou os valores enviados no corpo.</p>
        <pre><code>curl -X POST http://localhost:3334/sync/amazon/offers \\
  -H "Content-Type: application/json" \\
  -d "{}"</code></pre>
      </section>
    </div>

    <section>
      <h2>Body opcional</h2>
      <pre><code>{
  "cliente_id": 1,
  "filial_id": 6
}</code></pre>
    </section>

    <section>
      <h2>Resposta esperada</h2>
      <pre><code>{
  "summary": {
    "total": 2,
    "published": 1,
    "skipped": 1,
    "failed": 0
  },
  "published": [
    {
      "sku": "PS5-CONTROLE",
      "price": 599,
      "quantity": 100,
      "submissionId": "SUB-1",
      "status": "ACCEPTED"
    }
  ],
  "skipped": [
    {
      "sku": "KIT-576001",
      "reason": "missing_valid_price"
    }
  ],
  "failed": []
}</code></pre>
    </section>

    <section>
      <h2>Códigos HTTP</h2>
      <ul>
        <li><code>200</code>: sincronização executada e resultado retornado.</li>
        <li><code>401</code>: token de acesso da rota inválido ou ausente quando <code>SYNC_API_TOKEN</code> está configurado.</li>
        <li><code>422</code>: <code>cliente_id</code> ou <code>filial_id</code> inválido.</li>
        <li><code>500</code>: falha inesperada antes da consolidação do resultado.</li>
      </ul>
    </section>
  </main>
</body>
</html>`
  }
}
