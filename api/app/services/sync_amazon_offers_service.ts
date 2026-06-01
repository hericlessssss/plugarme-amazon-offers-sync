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

type LogContext = Record<string, unknown>

interface SyncLogger {
  debug(context: LogContext, message: string): void
  info(context: LogContext, message: string): void
  warn(context: LogContext, message: string): void
  error(context: LogContext, message: string): void
}

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
  logger?: SyncLogger
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 1,
  baseDelayMs: 300,
}

const noopLogger: SyncLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
}

const SENSITIVE_KEYS = new Set([
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'lwa_client_secret',
  'clientSecret',
  'client_secret',
  'Authorization',
  'authorization',
  'x-amz-access-token',
])

export class SyncAmazonOffersService {
  readonly #plugarmeClient: PlugarmeClientContract
  readonly #amazonAuthClient: AmazonAuthClientContract
  readonly #amazonListingsClient: AmazonListingsClientContract
  readonly #now: () => Date
  readonly #delay: (ms: number) => Promise<void>
  readonly #retry: RetryConfig
  readonly #logger: SyncLogger

  constructor(config: SyncAmazonOffersServiceConfig) {
    this.#plugarmeClient = config.plugarmeClient
    this.#amazonAuthClient = config.amazonAuthClient
    this.#amazonListingsClient = config.amazonListingsClient
    this.#now = config.now ?? (() => new Date())
    this.#delay = config.delay ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
    this.#retry = { ...DEFAULT_RETRY, ...config.retry }
    this.#logger = config.logger ?? noopLogger
  }

  async sync(input: SyncInput): Promise<SyncAmazonOffersResult> {
    this.#logger.info(
      {
        clienteId: input.clienteId,
        filialId: input.filialId,
      },
      'Starting Plugar.me to Amazon offer synchronization'
    )

    this.#logger.debug(
      {
        clienteId: input.clienteId,
      },
      'Fetching Amazon credentials from Plugar.me'
    )
    const credentials = await this.#plugarmeClient.getAmazonCredentials({
      clienteId: input.clienteId,
    })

    this.#logger.debug(
      {
        clienteId: input.clienteId,
        sellerId: credentials.seller_id,
        marketplaceId: credentials.marketplace_id,
        tokenExpiresAt: credentials.access_token_expires_at,
      },
      'Fetched Amazon credentials metadata'
    )

    this.#logger.debug(
      {
        clienteId: input.clienteId,
        filialId: input.filialId,
      },
      'Fetching products from Plugar.me'
    )
    const products = await this.#plugarmeClient.getProducts(input)

    this.#logger.info(
      {
        clienteId: input.clienteId,
        filialId: input.filialId,
        productsCount: products.length,
      },
      'Fetched products from Plugar.me'
    )

    let accessToken = credentials.access_token

    const refreshAccessToken = async () => {
      this.#logger.warn(
        {
          sellerId: credentials.seller_id,
          marketplaceId: credentials.marketplace_id,
        },
        'Refreshing Amazon access token'
      )

      try {
        const refreshed = await this.#amazonAuthClient.refreshAccessToken({
          refreshToken: credentials.refresh_token,
          clientId: credentials.lwa_client_id,
          clientSecret: credentials.lwa_client_secret,
        })
        accessToken = refreshed.accessToken
        this.#logger.info(
          {
            sellerId: credentials.seller_id,
            marketplaceId: credentials.marketplace_id,
            tokenType: refreshed.tokenType,
            expiresIn: refreshed.expiresIn,
          },
          'Amazon access token refreshed'
        )
        return accessToken
      } catch (error) {
        this.#logger.error(
          {
            sellerId: credentials.seller_id,
            marketplaceId: credentials.marketplace_id,
            error: this.#serializeError(error),
          },
          'Failed to refresh Amazon access token'
        )
        throw error
      }
    }

    if (this.#isExpired(credentials.access_token_expires_at)) {
      this.#logger.warn(
        {
          sellerId: credentials.seller_id,
          marketplaceId: credentials.marketplace_id,
          tokenExpiresAt: credentials.access_token_expires_at,
        },
        'Amazon access token is expired before publishing'
      )
      await refreshAccessToken()
    } else {
      this.#logger.debug(
        {
          sellerId: credentials.seller_id,
          marketplaceId: credentials.marketplace_id,
          tokenExpiresAt: credentials.access_token_expires_at,
        },
        'Amazon access token is still valid before publishing'
      )
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
        this.#logger.warn(
          {
            sku: offer.sku,
            title: offer.title,
            reason: offer.reason,
          },
          'Skipping product during offer synchronization'
        )
        result.skipped.push({
          sku: offer.sku,
          title: offer.title,
          reason: offer.reason,
        })
        continue
      }

      try {
        this.#logger.debug(
          {
            sku: offer.sku,
            title: offer.title,
            price: offer.price,
            quantity: offer.quantity,
            sellerId: credentials.seller_id,
            marketplaceId: credentials.marketplace_id,
          },
          'Publishing Amazon offer'
        )

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

        this.#logger.info(
          {
            sku: offer.sku,
            title: offer.title,
            price: offer.price,
            quantity: offer.quantity,
            sellerId: credentials.seller_id,
            marketplaceId: credentials.marketplace_id,
            submissionId: submission.submissionId,
            status: submission.status,
          },
          'Amazon offer published'
        )
      } catch (error) {
        this.#logger.error(
          {
            sku: offer.sku,
            title: offer.title,
            sellerId: credentials.seller_id,
            marketplaceId: credentials.marketplace_id,
            error: this.#serializeError(error),
          },
          'Failed to publish Amazon offer'
        )
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

    this.#logger.info(
      {
        clienteId: input.clienteId,
        filialId: input.filialId,
        summary: result.summary,
      },
      'Finished Plugar.me to Amazon offer synchronization'
    )

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
          this.#logger.warn(
            {
              sku: input.offer.sku,
              sellerId: input.credentials.seller_id,
              marketplaceId: input.credentials.marketplace_id,
              error: this.#serializeError(error),
            },
            'Amazon rejected offer publication because the access token is invalid or expired'
          )
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
          this.#logger.warn(
            {
              sku: input.offer.sku,
              sellerId: input.credentials.seller_id,
              marketplaceId: input.credentials.marketplace_id,
              attempt: rateLimitRetries,
              maxRetries: this.#retry.maxRetries,
              delayMs,
              error: this.#serializeError(error),
            },
            'Amazon rate limit reached while publishing offer; retrying after backoff'
          )
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

  #serializeError(error: unknown) {
    if (error instanceof HttpClientError) {
      return this.#sanitize({
        name: error.name,
        message: error.message,
        status: error.status,
        method: error.method,
        url: error.url,
        responseBody: error.responseBody,
      })
    }

    if (error instanceof Error) {
      return this.#sanitize({
        name: error.name,
        message: error.message,
      })
    }

    return this.#sanitize({ value: error })
  }

  #sanitize(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.#sanitize(item))
    }

    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          SENSITIVE_KEYS.has(key) ? '[REDACTED]' : this.#sanitize(item),
        ])
      )
    }

    return value
  }
}
