import axios, { AxiosInstance } from 'axios'
import https from 'https'
import type {
  UniplusToken,
  UniplusEntidade,
  UniplusProduto,
  UniplusVenda,
  UniplusVendaItem,
} from '@/types/uniplus'

interface UniplusClientConfig {
  serverUrl: string
  authCode: string
  userId: string
  userPassword: string
}

export class UniplusClient {
  private config: UniplusClientConfig
  private http: AxiosInstance
  private token: UniplusToken | null = null

  constructor(config: UniplusClientConfig) {
    this.config = config
    // Self-signed cert on Yoda — only for this specific configured server
    const agent = new https.Agent({ rejectUnauthorized: false })
    this.http = axios.create({
      baseURL: config.serverUrl,
      httpsAgent: agent,
      timeout: 30000,
    })
  }

  // ─── Token Management ──────────────────────────────────────────────────

  private isTokenValid(): boolean {
    if (!this.token) return false
    const elapsed = Date.now() - this.token.obtained_at
    // Refresh 60s before expiry
    return elapsed < (this.token.expires_in - 60) * 1000
  }

  private async authenticate(): Promise<string> {
    if (this.isTokenValid()) return this.token!.access_token

    const { data } = await this.http.post<Omit<UniplusToken, 'obtained_at'>>(
      '/oauth/token',
      'grant_type=client_credentials',
      {
        headers: {
          Authorization: `Basic ${this.config.authCode}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    )

    this.token = { ...data, obtained_at: Date.now() }
    return this.token.access_token
  }

  private async getHeaders(): Promise<Record<string, string>> {
    const accessToken = await this.authenticate()
    return {
      Authorization: `Bearer ${accessToken}`,
      userid: this.config.userId,
      password: this.config.userPassword,
    }
  }

  // ─── Generic Methods ──────────────────────────────────────────────────

  async get<T>(path: string, params?: Record<string, string | number>): Promise<T[]> {
    const headers = await this.getHeaders()
    const { data } = await this.http.get<T[] | { value: T[] }>(path, { headers, params })
    // API returns either array or { value: [...] }
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object' && 'value' in data) return data.value
    return []
  }

  async getAll<T>(path: string, params?: Record<string, string | number>): Promise<T[]> {
    const PAGE_SIZE = 100
    let offset = 0
    const all: T[] = []

    while (true) {
      const page = await this.get<T>(path, { ...params, limit: PAGE_SIZE, offset })
      all.push(...page)
      if (page.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    }

    return all
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getHeaders()
    const { data } = await this.http.post<T>(path, body, { headers })
    return data
  }

  async put<T>(path: string, body: unknown): Promise<T> {
    const headers = await this.getHeaders()
    const { data } = await this.http.put<T>(path, body, { headers })
    return data
  }

  // ─── Specific Methods ─────────────────────────────────────────────────

  async getEntidades(tipo?: number): Promise<UniplusEntidade[]> {
    const params: Record<string, string | number> = {}
    if (tipo !== undefined) params['tipo.eq'] = tipo
    return this.getAll<UniplusEntidade>('/public-api/v1/entidades', params)
  }

  async getClientes(): Promise<UniplusEntidade[]> {
    return this.getEntidades(1)
  }

  async getVendedores(): Promise<UniplusEntidade[]> {
    return this.getEntidades(4)
  }

  async getProdutos(): Promise<UniplusProduto[]> {
    return this.getAll<UniplusProduto>('/public-api/v1/produtos')
  }

  async getCondicoesPagamento(): Promise<unknown[]> {
    return this.getAll('/public-api/v1/commons/condicaopagamento')
  }

  async getVendas(desde?: string): Promise<UniplusVenda[]> {
    const params: Record<string, string | number> = {}
    if (desde) params['emissao.ge'] = desde
    return this.getAll<UniplusVenda>('/public-api/v2/venda', params)
  }

  async getVendaItens(desde?: string): Promise<UniplusVendaItem[]> {
    const params: Record<string, string | number> = {}
    if (desde) params['emissao.ge'] = desde
    return this.getAll<UniplusVendaItem>('/public-api/v2/venda-item', params)
  }

  async createEntidade(entidade: Partial<UniplusEntidade>): Promise<UniplusEntidade> {
    return this.post('/public-api/v1/entidades', entidade)
  }

  async updateEntidade(entidade: Partial<UniplusEntidade>): Promise<UniplusEntidade> {
    return this.put('/public-api/v1/entidades', entidade)
  }

  // ─── Connection Test ──────────────────────────────────────────────────

  async testConnection(): Promise<{ ok: boolean; version?: string; error?: string }> {
    try {
      await this.authenticate()
      // Try fetching 1 entity to confirm full access
      await this.get('/public-api/v1/entidades', { limit: 1 })
      return { ok: true }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro desconhecido'
      return { ok: false, error: message }
    }
  }
}
