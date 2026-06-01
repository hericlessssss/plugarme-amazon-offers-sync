import { AmazonAuthClient } from '#clients/amazon_auth_client'
import { AmazonListingsClient } from '#clients/amazon_listings_client'
import { PlugarmeClient } from '#clients/plugarme_client'
import { SyncAmazonOffersService } from '#services/sync_amazon_offers_service'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'

export default class SyncAmazonOffersController {
  async handle({ logger, request, response }: HttpContext) {
    const syncApiToken = env.get('SYNC_API_TOKEN')
    if (syncApiToken) {
      const authorization = request.header('authorization')
      if (authorization !== `Bearer ${syncApiToken}`) {
        logger.warn(
          {
            hasAuthorizationHeader: Boolean(authorization),
          },
          'Rejected unauthorized offer sync request'
        )
        return response.unauthorized({
          error: 'Unauthorized',
        })
      }
    }

    const clienteId = this.#parsePositiveInteger(request.input('cliente_id', env.get('CLIENTE_ID')))
    const filialId = this.#parsePositiveInteger(request.input('filial_id', env.get('FILIAL_ID')))

    if (!clienteId || !filialId) {
      logger.warn(
        {
          clienteIdProvided: request.input('cliente_id'),
          filialIdProvided: request.input('filial_id'),
        },
        'Rejected offer sync request with invalid identifiers'
      )
      return response.unprocessableEntity({
        error: 'Invalid sync identifiers',
        details: {
          cliente_id: 'Must be a positive integer',
          filial_id: 'Must be a positive integer',
        },
      })
    }

    const timeoutMs = env.get('HTTP_TIMEOUT_MS')

    const service = new SyncAmazonOffersService({
      plugarmeClient: new PlugarmeClient({
        baseUrl: env.get('PLUGARME_BASE_URL'),
        apiToken: env.get('PLUGARME_API_TOKEN'),
        timeoutMs,
      }),
      amazonAuthClient: new AmazonAuthClient({
        baseUrl: env.get('AMAZON_SP_API_BASE_URL'),
        timeoutMs,
      }),
      amazonListingsClient: new AmazonListingsClient({
        baseUrl: env.get('AMAZON_SP_API_BASE_URL'),
        timeoutMs,
      }),
      logger,
      maxProductsPerSync: env.get('MAX_PRODUCTS_PER_SYNC'),
    })

    return service.sync({ clienteId, filialId })
  }

  #parsePositiveInteger(value: unknown) {
    const parsed = Number(value)
    if (!Number.isSafeInteger(parsed) || parsed <= 0) {
      return null
    }

    return parsed
  }
}
