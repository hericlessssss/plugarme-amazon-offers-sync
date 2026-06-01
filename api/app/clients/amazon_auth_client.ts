import type { Fetcher } from '#clients/http'
import { ensureSuccess, normalizeBaseUrl } from '#clients/http'
import type { AmazonAccessToken, AmazonRefreshTokenInput } from '#types/amazon'

interface AmazonAuthClientConfig {
  baseUrl: string
  fetcher?: Fetcher
}

export class AmazonAuthClient {
  readonly #baseUrl: string
  readonly #fetcher: Fetcher

  constructor(config: AmazonAuthClientConfig) {
    this.#baseUrl = normalizeBaseUrl(config.baseUrl)
    this.#fetcher = config.fetcher ?? fetch
  }

  async refreshAccessToken(input: AmazonRefreshTokenInput): Promise<AmazonAccessToken> {
    const url = `${this.#baseUrl}/auth/o2/token`
    const form = new URLSearchParams()
    form.set('grant_type', 'refresh_token')
    form.set('refresh_token', input.refreshToken)
    form.set('client_id', input.clientId)
    form.set('client_secret', input.clientSecret)

    const body = await ensureSuccess(
      await this.#fetcher(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      }),
      'POST',
      url
    )

    const response = body as {
      access_token: string
      token_type: string
      expires_in: number
    }

    return {
      accessToken: response.access_token,
      tokenType: response.token_type,
      expiresIn: response.expires_in,
    }
  }
}
