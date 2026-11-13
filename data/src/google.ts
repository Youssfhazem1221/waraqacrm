// ============================================================
// Google Sheets API client for Workers: service-account auth (RS256 JWT signed
// with WebCrypto) and the handful of Sheets calls the data Worker needs.
//
// Every write uses valueInputOption=RAW, so the Sheet stores exactly what was
// sent: a phone number keeps its leading zero, and text that starts with "="
// stays text instead of becoming a formula. That removes the formula-injection
// guard the old Apps Script needed on every customer field.
// ============================================================

import type { Row } from './schema';

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const API = 'https://sheets.googleapis.com/v4/spreadsheets';

export interface ServiceAccount {
  email: string;
  /** PEM "-----BEGIN PRIVATE KEY-----..." (PKCS#8). `\n` escapes are accepted. */
  privateKey: string;
}

function b64url(data: ArrayBuffer | Uint8Array | string): string {
  const bytes =
    typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [^-]+-----|-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}

/** What the data Worker needs from a spreadsheet (the real API, or the dev fake). */
export type SheetsLike = Pick<SheetsClient, 'spreadsheetId' | 'tabs' | 'batchGet' | 'batchUpdate' | 'append' | 'clear' | 'structure'>;

export class SheetsClient {
  private token: { value: string; exp: number } | null = null;
  private key: CryptoKey | null = null;

  constructor(
    private sa: ServiceAccount,
    readonly spreadsheetId: string,
  ) {}

  private async accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (this.token && this.token.exp - 60 > now) return this.token.value;

    this.key ??= await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(this.sa.privateKey),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claims = b64url(
      JSON.stringify({ iss: this.sa.email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
    );
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', this.key, new TextEncoder().encode(`${header}.${claims}`));
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${header}.${claims}.${b64url(sig)}`,
      }),
    });
    if (!res.ok) throw new Error(`Google auth failed (${res.status}): ${await res.text()}`);
    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.token = { value: data.access_token, exp: now + data.expires_in };
    return this.token.value;
  }

  private async call<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
    const res = await fetch(`${API}/${this.spreadsheetId}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${await this.accessToken()}`,
        'content-type': 'application/json',
        ...(init.headers || {}),
      },
    });
    // 429/5xx are transient on the Sheets API; back off and retry twice.
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
      return this.call<T>(path, init, attempt + 1);
    }
    if (!res.ok) {
      const text = await res.text();
      let message = text;
      try {
        message = (JSON.parse(text) as { error?: { message?: string } }).error?.message || text;
      } catch {
        // not JSON
      }
      if (res.status === 403 || res.status === 404) {
        message = `The data Worker cannot open the Sheet (${res.status}). Share it with ${this.sa.email} as Editor. Google said: ${message}`;
      }
      throw new Error(message);
    }
    return (await res.json()) as T;
  }

  /** Tab titles and ids. */
  async tabs(): Promise<{ title: string; sheetId: number }[]> {
    const data = await this.call<{ sheets: { properties: { title: string; sheetId: number } }[] }>(
      '?fields=sheets.properties(title,sheetId)',
    );
    return data.sheets.map((s) => s.properties);
  }

  /** Several ranges in one request. Missing tabs come back empty. */
  async batchGet(ranges: string[]): Promise<Row[][]> {
    const qs = new URLSearchParams({ valueRenderOption: 'UNFORMATTED_VALUE', dateTimeRenderOption: 'FORMATTED_STRING' });
    for (const r of ranges) qs.append('ranges', r);
    const data = await this.call<{ valueRanges: { values?: Row[] }[] }>(`/values:batchGet?${qs}`);
    return data.valueRanges.map((v) => v.values ?? []);
  }

  /** Write individual ranges (cells or rows) in one request. */
  async batchUpdate(data: { range: string; values: Row[] }[]): Promise<void> {
    if (!data.length) return;
    await this.call('/values:batchUpdate', {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data }),
    });
  }

  /** Append rows after the last row of a tab. */
  async append(range: string, rows: Row[]): Promise<void> {
    if (!rows.length) return;
    const qs = new URLSearchParams({ valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS' });
    await this.call(`/values/${encodeURIComponent(range)}:append?${qs}`, {
      method: 'POST',
      body: JSON.stringify({ values: rows }),
    });
  }

  async clear(range: string): Promise<void> {
    await this.call(`/values/${encodeURIComponent(range)}:clear`, { method: 'POST', body: '{}' });
  }

  /** Structural changes: add tabs, delete rows, formatting, validation. */
  async structure(requests: unknown[]): Promise<void> {
    if (!requests.length) return;
    await this.call(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests }) });
  }
}
