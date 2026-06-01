import type { Fetcher } from '#clients/http'
import { ensureSuccess, normalizeBaseUrl } from '#clients/http'
import type { AmazonCredentials } from '#types/amazon'
import type { PlugarmeProduct } from '#types/plugarme'

interface PlugarmeClientConfig {
  baseUrl: string
  apiToken: string
  fetcher?: Fetcher
}

interface GetProductsInput {
  clienteId: string | number
  filialId: string | number
}

interface GetCredentialsInput {
  clienteId: string | number
}

export class PlugarmeClient {
  readonly #baseUrl: string
  readonly #apiToken: string
  readonly #fetcher: Fetcher

  constructor(config: PlugarmeClientConfig) {
    this.#baseUrl = normalizeBaseUrl(config.baseUrl)
    this.#apiToken = config.apiToken
    this.#fetcher = config.fetcher ?? fetch
  }

  async getProducts(input: GetProductsInput): Promise<PlugarmeProduct[]> {
    const url = new URL(`${this.#baseUrl}/produtos`)
    url.searchParams.set('cliente_id', String(input.clienteId))
    url.searchParams.set('filial_id', String(input.filialId))

    const body = await ensureSuccess(
      await this.#fetcher(url, {
        method: 'GET',
        headers: this.#authHeaders(),
      }),
      'GET',
      url.toString()
    )

    return (body as { data: PlugarmeProduct[] }).data
  }

  async getAmazonCredentials(input: GetCredentialsInput): Promise<AmazonCredentials> {
    const url = new URL(`${this.#baseUrl}/integracoes/amazon/credenciais`)
    url.searchParams.set('cliente_id', String(input.clienteId))

    const body = await ensureSuccess(
      await this.#fetcher(url, {
        method: 'GET',
        headers: this.#authHeaders(),
      }),
      'GET',
      url.toString()
    )

    return (body as { data: AmazonCredentials }).data
  }

  #authHeaders() {
    return {
      Authorization: `Bearer ${this.#apiToken}`,
    }
  }
}
