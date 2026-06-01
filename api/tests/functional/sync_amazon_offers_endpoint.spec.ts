import { test } from '@japa/runner'

test.group('Sync Amazon offers endpoint', () => {
  test('runs the sync flow through the HTTP endpoint', async ({ assert, client }) => {
    const originalFetch = globalThis.fetch
    const requests: Array<{ url: string; init?: RequestInit }> = []

    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      requests.push({ url, init })

      if (url.includes('/plugarme/v1/integracoes/amazon/credenciais')) {
        return Response.json({
          data: {
            cliente_id: 1,
            filial_id: 6,
            seller_id: 'A1PLUGARMESELLERBR',
            marketplace_id: 'A2Q3Y263D00KWC',
            lwa_client_id: 'client-id',
            lwa_client_secret: 'client-secret',
            refresh_token: 'refresh-token',
            access_token: 'expired-token',
            access_token_expires_at: '2026-05-29T12:00:00.000Z',
          },
        })
      }

      if (url.includes('/plugarme/v1/produtos')) {
        return Response.json({
          data: [
            {
              id: '761487',
              cliente_id: '1',
              erp_id: 'PS5-CONTROLE',
              titulo: 'Controle Sony DualSense PS5',
              ativo: true,
              preco: [{ filial_id: '6', preco: 599 }],
              estoque: [{ filial_id: '6', quantidade: 100, custo: 399 }],
            },
            {
              id: '717410',
              cliente_id: '1',
              erp_id: 'KIT-576001',
              titulo: '2 COCA COLA + 1 FANTA KIT 50% OFF',
              ativo: true,
              preco: [],
              estoque: [{ filial_id: '6', quantidade: 0, custo: 0 }],
            },
          ],
        })
      }

      if (url.includes('/amazon/auth/o2/token')) {
        return Response.json({
          access_token: 'fresh-token',
          token_type: 'bearer',
          expires_in: 3600,
        })
      }

      if (url.includes('/amazon/listings/2021-08-01/items/')) {
        return Response.json(
          {
            sku: 'PS5-CONTROLE',
            status: 'ACCEPTED',
            submissionId: 'SUB-1',
            issues: [],
          },
          { status: 202 }
        )
      }

      return Response.json({ error: 'Unexpected URL', url }, { status: 500 })
    }) as typeof fetch

    try {
      const response = await client.post('/sync/amazon/offers').json({}).send()

      response.assertStatus(200)
      response.assertBodyContains({
        summary: {
          total: 2,
          published: 1,
          skipped: 1,
          failed: 0,
        },
      })

      const body = response.body()
      assert.equal(body.published[0].sku, 'PS5-CONTROLE')
      assert.equal(body.published[0].quantity, 100)
      assert.equal(body.skipped[0].sku, 'KIT-576001')
      assert.equal(body.skipped[0].reason, 'missing_valid_price')

      const tokenRequest = requests.find((request) => request.url.includes('/amazon/auth/o2/token'))
      const listingRequest = requests.find((request) =>
        request.url.includes('/amazon/listings/2021-08-01/items/')
      )

      assert.exists(tokenRequest)
      assert.exists(listingRequest)
      assert.equal(
        (listingRequest?.init?.headers as Record<string, string>)['x-amz-access-token'],
        'fresh-token'
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
