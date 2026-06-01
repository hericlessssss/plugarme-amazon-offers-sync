export type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

export class HttpClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly method: string,
    public readonly url: string,
    public readonly responseBody: unknown
  ) {
    super(message)
    this.name = 'HttpClientError'
  }
}

export function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

export async function parseJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function ensureSuccess(response: Response, method: string, url: string) {
  const body = await parseJsonResponse(response)

  if (!response.ok) {
    throw new HttpClientError(
      `HTTP ${response.status} returned by ${method} ${url}`,
      response.status,
      method,
      url,
      body
    )
  }

  return body
}
