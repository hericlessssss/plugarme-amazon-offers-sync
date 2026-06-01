import { test } from '@japa/runner'
import { HttpClientError } from '#clients/http'
import { SyncAmazonOffersService } from '#services/sync_amazon_offers_service'
import type {
  AmazonAccessToken,
  AmazonCredentials,
  AmazonListingPatchResult,
  AmazonListingsPatchPayload,
} from '#types/amazon'
import type { PlugarmeProduct } from '#types/plugarme'

const credentials: AmazonCredentials = {
  cliente_id: 1,
  filial_id: 6,
  seller_id: 'A1PLUGARMESELLERBR',
  marketplace_id: 'A2Q3Y263D00KWC',
  lwa_client_id: 'client-id',
  lwa_client_secret: 'client-secret',
  refresh_token: 'refresh-token',
  access_token: 'expired-token',
  access_token_expires_at: '2026-05-29T12:00:00.000Z',
}

function product(overrides: Partial<PlugarmeProduct> = {}): PlugarmeProduct {
  return {
    id: '761487',
    cliente_id: '1',
    erp_id: 'PS5-CONTROLE',
    titulo: 'Controle Sony DualSense PS5',
    ativo: true,
    preco: [{ filial_id: '6', preco: 599 }],
    estoque: [{ filial_id: '6', quantidade: 100 }],
    ...overrides,
  }
}

function accepted(sku: string): AmazonListingPatchResult {
  return {
    sku,
    status: 'ACCEPTED',
    submissionId: `SUB-${sku}`,
    issues: [],
  }
}

test.group('SyncAmazonOffersService', () => {
  test('refreshes an expired token before publishing and reuses it during the run', async ({
    assert,
  }) => {
    const patchCalls: Array<{ sku: string; accessToken: string }> = []
    let refreshCount = 0
    const service = new SyncAmazonOffersService({
      plugarmeClient: {
        getAmazonCredentials: async () => credentials,
        getProducts: async () => [
          product(),
          product({
            id: '761488',
            erp_id: 'PS5-CAMERA',
            titulo: 'Camera PS5',
          }),
        ],
      },
      amazonAuthClient: {
        refreshAccessToken: async (): Promise<AmazonAccessToken> => {
          refreshCount += 1
          return { accessToken: 'fresh-token', tokenType: 'bearer', expiresIn: 3600 }
        },
      },
      amazonListingsClient: {
        patchListingOffer: async (input) => {
          patchCalls.push({ sku: input.sku, accessToken: input.accessToken })
          return accepted(input.sku)
        },
      },
      now: () => new Date('2026-06-01T10:00:00.000Z'),
    })

    const result = await service.sync({ clienteId: 1, filialId: 6 })

    assert.equal(refreshCount, 1)
    assert.deepEqual(
      patchCalls.map((call) => call.accessToken),
      ['fresh-token', 'fresh-token']
    )
    assert.deepEqual(result.summary, {
      total: 2,
      published: 2,
      skipped: 0,
      failed: 0,
    })
  })

  test('skips invalid products and continues processing publishable ones', async ({ assert }) => {
    const service = new SyncAmazonOffersService({
      plugarmeClient: {
        getAmazonCredentials: async () => ({
          ...credentials,
          access_token_expires_at: '2026-06-01T11:00:00.000Z',
        }),
        getProducts: async () => [
          product({ erp_id: 'KIT-576001', preco: [] }),
          product({ erp_id: 'PS5-CONTROLE' }),
        ],
      },
      amazonAuthClient: {
        refreshAccessToken: async () => {
          throw new Error('Should not refresh a valid token')
        },
      },
      amazonListingsClient: {
        patchListingOffer: async (input) => accepted(input.sku),
      },
      now: () => new Date('2026-06-01T10:00:00.000Z'),
    })

    const result = await service.sync({ clienteId: 1, filialId: 6 })

    assert.equal(result.summary.published, 1)
    assert.equal(result.summary.skipped, 1)
    assert.equal(result.skipped[0].sku, 'KIT-576001')
    assert.equal(result.skipped[0].reason, 'missing_valid_price')
  })

  test('refreshes the token after a 401 response and retries the SKU once', async ({ assert }) => {
    let attempts = 0
    const service = new SyncAmazonOffersService({
      plugarmeClient: {
        getAmazonCredentials: async () => ({
          ...credentials,
          access_token_expires_at: '2026-06-01T11:00:00.000Z',
        }),
        getProducts: async () => [product()],
      },
      amazonAuthClient: {
        refreshAccessToken: async () => ({
          accessToken: 'fresh-after-401',
          tokenType: 'bearer',
          expiresIn: 3600,
        }),
      },
      amazonListingsClient: {
        patchListingOffer: async (input) => {
          attempts += 1
          if (attempts === 1) {
            throw new HttpClientError('HTTP 401 returned by PATCH listing', 401, 'PATCH', 'url', {})
          }
          assert.equal(input.accessToken, 'fresh-after-401')
          return accepted(input.sku)
        },
      },
      now: () => new Date('2026-06-01T10:00:00.000Z'),
    })

    const result = await service.sync({ clienteId: 1, filialId: 6 })

    assert.equal(attempts, 2)
    assert.equal(result.summary.published, 1)
    assert.equal(result.summary.failed, 0)
  })

  test('retries a 429 response with backoff before marking the SKU as published', async ({
    assert,
  }) => {
    let attempts = 0
    const delays: number[] = []
    const service = new SyncAmazonOffersService({
      plugarmeClient: {
        getAmazonCredentials: async () => ({
          ...credentials,
          access_token_expires_at: '2026-06-01T11:00:00.000Z',
        }),
        getProducts: async () => [product()],
      },
      amazonAuthClient: {
        refreshAccessToken: async () => {
          throw new Error('Should not refresh for 429')
        },
      },
      amazonListingsClient: {
        patchListingOffer: async (input) => {
          attempts += 1
          if (attempts === 1) {
            throw new HttpClientError('HTTP 429 returned by PATCH listing', 429, 'PATCH', 'url', {})
          }
          return accepted(input.sku)
        },
      },
      delay: async (ms) => {
        delays.push(ms)
      },
      now: () => new Date('2026-06-01T10:00:00.000Z'),
      retry: {
        maxRetries: 1,
        baseDelayMs: 250,
      },
    })

    const result = await service.sync({ clienteId: 1, filialId: 6 })

    assert.equal(attempts, 2)
    assert.deepEqual(delays, [250])
    assert.equal(result.summary.published, 1)
  })

  test('records one SKU failure without stopping the remaining products', async ({ assert }) => {
    const service = new SyncAmazonOffersService({
      plugarmeClient: {
        getAmazonCredentials: async () => ({
          ...credentials,
          access_token_expires_at: '2026-06-01T11:00:00.000Z',
        }),
        getProducts: async () => [
          product({ erp_id: 'FAIL-SKU' }),
          product({ erp_id: 'PS5-CONTROLE' }),
        ],
      },
      amazonAuthClient: {
        refreshAccessToken: async () => {
          throw new Error('Should not refresh for 422')
        },
      },
      amazonListingsClient: {
        patchListingOffer: async (input: {
          sku: string
          accessToken: string
          payload: AmazonListingsPatchPayload
        }) => {
          if (input.sku === 'FAIL-SKU') {
            throw new HttpClientError('HTTP 422 returned by PATCH listing', 422, 'PATCH', 'url', {})
          }
          return accepted(input.sku)
        },
      },
      now: () => new Date('2026-06-01T10:00:00.000Z'),
    })

    const result = await service.sync({ clienteId: 1, filialId: 6 })

    assert.deepEqual(result.summary, {
      total: 2,
      published: 1,
      skipped: 0,
      failed: 1,
    })
    assert.equal(result.failed[0].sku, 'FAIL-SKU')
    assert.equal(result.published[0].sku, 'PS5-CONTROLE')
  })
})
