import { test } from '@japa/runner'
import { AmazonAuthClient } from '#clients/amazon_auth_client'
import { AmazonListingsClient } from '#clients/amazon_listings_client'
import { HttpClientError, withTimeout } from '#clients/http'
import { PlugarmeClient } from '#clients/plugarme_client'
import { buildAmazonOfferPatchPayload } from '#services/offer_mapper'

test.group('HTTP clients', () => {
  test('PlugarmeClient fetches products with configured auth and filters', async ({ assert }) => {
    const requests: Array<{ input: string | URL; init?: RequestInit }> = []
    const fetcher = async (input: string | URL, init?: RequestInit) => {
      requests.push({ input, init })
      return Response.json({ data: [{ erp_id: 'PS5-CONTROLE' }], meta: { total: 1 } })
    }

    const client = new PlugarmeClient({
      baseUrl: 'http://localhost:3333/plugarme/v1',
      apiToken: 'plugarme-test-token',
      fetcher,
    })

    const products = await client.getProducts({ clienteId: 1, filialId: 6 })

    assert.deepEqual(products, [{ erp_id: 'PS5-CONTROLE' }])
    assert.equal(
      String(requests[0].input),
      'http://localhost:3333/plugarme/v1/produtos?cliente_id=1&filial_id=6'
    )
    assert.equal(requests[0].init?.method, 'GET')
    assert.equal(
      (requests[0].init?.headers as Record<string, string>).Authorization,
      'Bearer plugarme-test-token'
    )
  })

  test('PlugarmeClient fetches Amazon credentials without exposing secrets', async ({ assert }) => {
    const fetcher = async () =>
      Response.json({
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

    const client = new PlugarmeClient({
      baseUrl: 'http://localhost:3333/plugarme/v1/',
      apiToken: 'plugarme-test-token',
      fetcher,
    })

    const credentials = await client.getAmazonCredentials({ clienteId: 1 })

    assert.equal(credentials.seller_id, 'A1PLUGARMESELLERBR')
    assert.equal(credentials.lwa_client_secret, 'client-secret')
  })

  test('AmazonAuthClient refreshes an access token using form-url-encoded body', async ({
    assert,
  }) => {
    let capturedBody = ''
    const fetcher = async (_input: string | URL, init?: RequestInit) => {
      capturedBody = String(init?.body)
      return Response.json({
        access_token: 'Atza|valid-refreshed-token-1',
        token_type: 'bearer',
        expires_in: 3600,
        refresh_token: 'Atzr|mock-refresh-token-plugarme',
      })
    }

    const client = new AmazonAuthClient({
      baseUrl: 'http://localhost:3333/amazon',
      fetcher,
    })

    const token = await client.refreshAccessToken({
      refreshToken: 'Atzr|mock-refresh-token-plugarme',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    })

    assert.equal(token.accessToken, 'Atza|valid-refreshed-token-1')
    assert.include(capturedBody, 'grant_type=refresh_token')
    assert.include(capturedBody, 'refresh_token=Atzr%7Cmock-refresh-token-plugarme')
    assert.include(capturedBody, 'client_id=client-id')
    assert.include(capturedBody, 'client_secret=client-secret')
  })

  test('AmazonListingsClient patches an existing listing offer', async ({ assert }) => {
    const requests: Array<{ input: string | URL; init?: RequestInit }> = []
    const fetcher = async (input: string | URL, init?: RequestInit) => {
      requests.push({ input, init })
      return Response.json(
        { sku: 'PS5-CONTROLE', status: 'ACCEPTED', submissionId: 'SUB-1', issues: [] },
        { status: 202 }
      )
    }

    const client = new AmazonListingsClient({
      baseUrl: 'http://localhost:3333/amazon',
      fetcher,
    })
    const payload = buildAmazonOfferPatchPayload({
      marketplaceId: 'A2Q3Y263D00KWC',
      price: 599,
      quantity: 100,
    })

    const result = await client.patchListingOffer({
      sellerId: 'A1PLUGARMESELLERBR',
      sku: 'PS5-CONTROLE',
      marketplaceId: 'A2Q3Y263D00KWC',
      accessToken: 'valid-token',
      payload,
    })

    assert.equal(result.submissionId, 'SUB-1')
    assert.equal(
      String(requests[0].input),
      'http://localhost:3333/amazon/listings/2021-08-01/items/A1PLUGARMESELLERBR/PS5-CONTROLE?marketplaceIds=A2Q3Y263D00KWC'
    )
    assert.equal(requests[0].init?.method, 'PATCH')
    assert.equal(
      (requests[0].init?.headers as Record<string, string>)['x-amz-access-token'],
      'valid-token'
    )
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), payload)
  })

  test('throws HttpClientError with status and sanitized message for non-2xx responses', async ({
    assert,
  }) => {
    const fetcher = async () =>
      Response.json(
        { errors: [{ code: 'InvalidInput', message: 'The access token is expired or invalid.' }] },
        { status: 401 }
      )

    const client = new AmazonListingsClient({
      baseUrl: 'http://localhost:3333/amazon',
      fetcher,
    })

    const payload = buildAmazonOfferPatchPayload({
      marketplaceId: 'A2Q3Y263D00KWC',
      price: 599,
      quantity: 100,
    })

    try {
      await client.patchListingOffer({
        sellerId: 'A1PLUGARMESELLERBR',
        sku: 'PS5-CONTROLE',
        marketplaceId: 'A2Q3Y263D00KWC',
        accessToken: 'expired-token',
        payload,
      })
      assert.fail('Expected request to fail')
    } catch (error) {
      assert.instanceOf(error, HttpClientError)
      assert.equal((error as HttpClientError).status, 401)
      assert.notInclude((error as HttpClientError).message, 'expired-token')
    }
  })

  test('converts aborted HTTP calls into timeout errors', async ({ assert }) => {
    const fetcher = withTimeout(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'))
          })
        }),
      1
    )

    try {
      await fetcher('http://localhost:3333/slow', { method: 'GET' })
      assert.fail('Expected request to time out')
    } catch (error) {
      assert.instanceOf(error, HttpClientError)
      assert.equal((error as HttpClientError).status, 0)
      assert.include((error as HttpClientError).message, 'timed out')
    }
  })
})
