import { HttpClientError } from '#clients/http'
import { buildAmazonOfferPatchPayload, mapProductToAmazonOffer } from '#services/offer_mapper'
import type {
  AmazonAccessToken,
  AmazonCredentials,
  AmazonListingPatchResult,
  AmazonListingsPatchPayload,
  AmazonRefreshTokenInput,
} from '#types/amazon'
import type { PlugarmeProduct } from '#types/plugarme'
import type { PublishableOffer, SyncAmazonOffersResult } from '#types/sync'

interface SyncInput {
  clienteId: string | number
  filialId: string | number
}

interface PlugarmeClientContract {
  getAmazonCredentials(input: { clienteId: string | number }): Promise<AmazonCredentials>
  getProducts(input: {
    clienteId: string | number
    filialId: string | number
  }): Promise<PlugarmeProduct[]>
}

interface AmazonAuthClientContract {
  refreshAccessToken(input: AmazonRefreshTokenInput): Promise<AmazonAccessToken>
}

interface AmazonListingsClientContract {
  patchListingOffer(input: {
    sellerId: string
    sku: string
    marketplaceId: string
    accessToken: string
    payload: AmazonListingsPatchPayload
  }): Promise<AmazonListingPatchResult>
}

interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
}

interface SyncAmazonOffersServiceConfig {
  plugarmeClient: PlugarmeClientContract
  amazonAuthClient: AmazonAuthClientContract
  amazonListingsClient: AmazonListingsClientContract
  now?: () => Date
  delay?: (ms: number) => Promise<void>
  retry?: Partial<RetryConfig>
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 1,
  baseDelayMs: 300,
}

export class SyncAmazonOffersService {
  readonly #plugarmeClient: PlugarmeClientContract
  readonly #amazonAuthClient: AmazonAuthClientContract
  readonly #amazonListingsClient: AmazonListingsClientContract
  readonly #now: () => Date
  readonly #delay: (ms: number) => Promise<void>
  readonly #retry: RetryConfig

  constructor(config: SyncAmazonOffersServiceConfig) {
    this.#plugarmeClient = config.plugarmeClient
    this.#amazonAuthClient = config.amazonAuthClient
    this.#amazonListingsClient = config.amazonListingsClient
    this.#now = config.now ?? (() => new Date())
    this.#delay = config.delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.#retry = { ...DEFAULT_RETRY, ...config.retry }
  }

  async sync(input: SyncInput): Promise<SyncAmazonOffersResult> {
    const credentials = await this.#plugarmeClient.getAmazonCredentials({
      clienteId: input.clienteId,
    })
    const products = await this.#plugarmeClient.getProducts(input)
    let accessToken = credentials.access_token

    const refreshAccessToken = async () => {
      const refreshed = await this.#amazonAuthClient.refreshAccessToken({
        refreshToken: credentials.refresh_token,
        clientId: credentials.lwa_client_id,
        clientSecret: credentials.lwa_client_secret,
      })
      accessToken = refreshed.accessToken
      return accessToken
    }

    if (this.#isExpired(credentials.access_token_expires_at)) {
      await refreshAccessToken()
    }

    const result: SyncAmazonOffersResult = {
      summary: {
        total: products.length,
        published: 0,
        skipped: 0,
        failed: 0,
      },
      published: [],
      skipped: [],
      failed: [],
    }

    for (const product of products) {
      const offer = mapProductToAmazonOffer(product, input.filialId, credentials.marketplace_id)

      if (offer.status === 'skipped') {
        result.skipped.push({
          sku: offer.sku,
          title: offer.title,
          reason: offer.reason,
        })
        continue
      }

      try {
        const submission = await this.#publishOffer({
          offer,
          credentials,
          accessToken: () => accessToken,
          refreshAccessToken,
        })

        result.published.push({
          sku: offer.sku,
          title: offer.title,
          price: offer.price,
          quantity: offer.quantity,
          submissionId: submission.submissionId,
          status: submission.status,
        })
      } catch (error) {
        result.failed.push({
          sku: offer.sku,
          title: offer.title,
          statusCode: error instanceof HttpClientError ? error.status : undefined,
          reason: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    result.summary.published = result.published.length
    result.summary.skipped = result.skipped.length
    result.summary.failed = result.failed.length

    return result
  }

  async #publishOffer(input: {
    offer: PublishableOffer
    credentials: AmazonCredentials
    accessToken: () => string
    refreshAccessToken: () => Promise<string>
  }) {
    const payload = buildAmazonOfferPatchPayload({
      marketplaceId: input.offer.marketplaceId,
      price: input.offer.price,
      quantity: input.offer.quantity,
    })
    let refreshedAfterUnauthorized = false
    let rateLimitRetries = 0

    while (true) {
      try {
        return await this.#amazonListingsClient.patchListingOffer({
          sellerId: input.credentials.seller_id,
          sku: input.offer.sku,
          marketplaceId: input.credentials.marketplace_id,
          accessToken: input.accessToken(),
          payload,
        })
      } catch (error) {
        if (
          error instanceof HttpClientError &&
          error.status === 401 &&
          !refreshedAfterUnauthorized
        ) {
          refreshedAfterUnauthorized = true
          await input.refreshAccessToken()
          continue
        }

        if (
          error instanceof HttpClientError &&
          error.status === 429 &&
          rateLimitRetries < this.#retry.maxRetries
        ) {
          const delayMs = this.#retry.baseDelayMs * 2 ** rateLimitRetries
          rateLimitRetries += 1
          await this.#delay(delayMs)
          continue
        }

        throw error
      }
    }
  }

  #isExpired(expiresAt: string) {
    const expiresAtMs = Date.parse(expiresAt)
    if (!Number.isFinite(expiresAtMs)) {
      return true
    }

    return expiresAtMs <= this.#now().getTime()
  }
}
