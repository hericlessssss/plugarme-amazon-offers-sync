import { AmazonAuthClient } from '#clients/amazon_auth_client'
import { AmazonListingsClient } from '#clients/amazon_listings_client'
import { PlugarmeClient } from '#clients/plugarme_client'
import { SyncAmazonOffersService } from '#services/sync_amazon_offers_service'
import env from '#start/env'
import type { HttpContext } from '@adonisjs/core/http'

export default class SyncAmazonOffersController {
  async handle({ logger, request }: HttpContext) {
    const clienteId = Number(request.input('cliente_id', env.get('CLIENTE_ID')))
    const filialId = Number(request.input('filial_id', env.get('FILIAL_ID')))

    const service = new SyncAmazonOffersService({
      plugarmeClient: new PlugarmeClient({
        baseUrl: env.get('PLUGARME_BASE_URL'),
        apiToken: env.get('PLUGARME_API_TOKEN'),
      }),
      amazonAuthClient: new AmazonAuthClient({
        baseUrl: env.get('AMAZON_SP_API_BASE_URL'),
      }),
      amazonListingsClient: new AmazonListingsClient({
        baseUrl: env.get('AMAZON_SP_API_BASE_URL'),
      }),
      logger,
    })

    return service.sync({ clienteId, filialId })
  }
}
