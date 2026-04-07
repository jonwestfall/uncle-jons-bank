export interface ApiClientOptions {
  baseUrl: string
  getToken?: (() => string | null | undefined) | undefined
}

export interface ApiErrorShape {
  detail?: string
  message?: string
  error?: string
}

export class ApiClientError extends Error {
  status: number
  method: string
  path: string
  payload: unknown

  constructor(options: {
    status: number
    method: string
    path: string
    payload: unknown
    message: string
  }) {
    super(options.message)
    this.name = 'ApiClientError'
    this.status = options.status
    this.method = options.method
    this.path = options.path
    this.payload = options.payload
  }
}

const buildUrl = (baseUrl: string, path: string) => {
  const left = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
  const right = path.startsWith('/') ? path : `/${path}`
  return `${left}${right}`
}

const extractMessage = (payload: unknown, fallback: string) => {
  if (typeof payload === 'string' && payload.trim()) return payload
  if (payload && typeof payload === 'object') {
    const p = payload as ApiErrorShape
    if (typeof p.detail === 'string' && p.detail.trim()) return p.detail
    if (typeof p.message === 'string' && p.message.trim()) return p.message
    if (typeof p.error === 'string' && p.error.trim()) return p.error
  }
  return fallback
}

const parseBody = async (resp: Response): Promise<unknown> => {
  if (resp.status === 204) return null
  const contentType = resp.headers.get('content-type')?.toLowerCase() ?? ''
  if (contentType.includes('application/json')) {
    return resp.json().catch(() => null)
  }
  return resp.text().catch(() => null)
}

export const isApiClientError = (error: unknown): error is ApiClientError =>
  error instanceof ApiClientError

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  headers?: HeadersInit
  body?: unknown
  signal?: AbortSignal
}

export interface ApiClient {
  request<T>(path: string, options?: RequestOptions): Promise<T>
  get<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>
  put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>
  delete<T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>): Promise<T>
}

export const createApiClient = ({ baseUrl, getToken }: ApiClientOptions): ApiClient => {
  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const method = options.method ?? 'GET'
    const headers = new Headers(options.headers)
    const token = getToken?.()

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }

    const hasBody = options.body !== undefined
    if (hasBody && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json')
    }

    const response = await fetch(buildUrl(baseUrl, path), {
      method,
      headers,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    })

    const payload = await parseBody(response)

    if (!response.ok) {
      throw new ApiClientError({
        status: response.status,
        method,
        path,
        payload,
        message: extractMessage(payload, `Request failed (${response.status})`),
      })
    }

    return payload as T
  }

  return {
    request,
    get: (path, options) => request(path, { ...options, method: 'GET' }),
    post: (path, body, options) => request(path, { ...options, method: 'POST', body }),
    put: (path, body, options) => request(path, { ...options, method: 'PUT', body }),
    patch: (path, body, options) => request(path, { ...options, method: 'PATCH', body }),
    delete: (path, options) => request(path, { ...options, method: 'DELETE' }),
  }
}
