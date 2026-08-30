/**
 * Client HTTP mínim per a les fonts obertes. Les APIs de la Generalitat i de
 * l'AOC responen bé però no sempre: fallen esporàdicament amb 502 i 504, i
 * tallen si se les martelleja. Reintents amb espera creixent i una pausa entre
 * pàgines, que és el que fa que una ingesta de 43.000 files acabi.
 */

export class HttpError extends Error {
  constructor(readonly status: number, readonly url: string, readonly body: string) {
    super(`HTTP ${status} a ${url}: ${body.slice(0, 200)}`);
    this.name = "HttpError";
  }
}

export const USER_AGENT = "quivoto/0.1 (brúixola electoral municipal; hola@quivoto.cat)";

export type FetchJsonOptions = {
  retries?: number;
  timeoutMs?: number;
  /** Pausa abans de la crida, per no saturar la font. */
  delayMs?: number;
};

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const { retries = 4, timeoutMs = 60_000, delayMs = 0 } = options;
  if (delayMs > 0) await sleep(delayMs);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: "application/json", "user-agent": USER_AGENT },
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        // 4xx que no siguin 429 no milloraran reintentant.
        if (response.status < 500 && response.status !== 429) {
          throw new HttpError(response.status, url, body);
        }
        throw new HttpError(response.status, url, body);
      }
      return (await response.json()) as T;
    } catch (error) {
      lastError = error;
      if (error instanceof HttpError && error.status < 500 && error.status !== 429) throw error;
      if (attempt === retries) break;
      await sleep(500 * 2 ** attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError;
}
