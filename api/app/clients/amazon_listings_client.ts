import type { Fetcher } from '#clients/http'
import { ensureSuccess, normalizeBaseUrl } from '#clients/http'
import type { AmazonListingPatchResult, AmazonListingsPatchPayload } from '#types/amazon'

interface AmazonListingsClientConfig {
  baseUrl: string
  fetcher?: Fetcher
}

interface PatchListingOfferInput {
  sellerId: string
  sku: string
  marketplaceId: string
  accessToken: string
  payload: AmazonListingsPatchPayload
}

export class AmazonListingsClient {
  readonly #baseUrl: string
  readonly #fetcher: Fetcher

  constructor(config: AmazonListingsClientConfig) {
    this.#baseUrl = normalizeBaseUrl(config.baseUrl)
    this.#fetcher = config.fetcher ?? fetch
  }

  async patchListingOffer(input: PatchListingOfferInput): Promise<AmazonListingPatchResult> {
    const url = new URL(
      `${this.#baseUrl}/listings/2021-08-01/items/${encodeURIComponent(input.sellerId)}/${encodeURIComponent(input.sku)}`
    )
    url.searchParams.set('marketplaceIds', input.marketplaceId)

    const body = await ensureSuccess(
      await this.#fetcher(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-amz-access-token': input.accessToken,
        },
        body: JSON.stringify(input.payload),
      }),
      'PATCH',
      url.toString()
    )

    return body as AmazonListingPatchResult
  }
}
