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

export function withTimeout(fetcher: Fetcher, timeoutMs: number): Fetcher {
  return async (input, init) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await fetcher(input, {
        ...init,
        signal: init?.signal ?? controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpClientError(
          `HTTP request timed out after ${timeoutMs}ms`,
          0,
          init?.method ?? 'GET',
          String(input),
          null
        )
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }
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
