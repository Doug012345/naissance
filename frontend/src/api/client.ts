/**
 * Petit client HTTP basé sur fetch.
 * Rôle : centraliser la base d'URL, le JSON, l'annulation (AbortSignal)
 * et transformer les ProblemDetails de l'API .NET en une erreur typée.
 */

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  /** Présent pour les 400/422 : { "poidsGrammes": ["Le poids doit…"] } */
  errors?: Record<string, string[]>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `Erreur HTTP ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }

  /** Erreurs par champ, prêtes pour setError() de React Hook Form. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [champ, messages] of Object.entries(this.problem.errors ?? {})) {
      if (messages[0]) out[champ] = messages[0];
    }
    return out;
  }

  get isConflict() { return this.status === 409; }
  get isNotFound() { return this.status === 404; }
  get isValidation() { return this.status === 400 || this.status === 422; }
}

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    let problem: ProblemDetails = { status: res.status };
    try {
      problem = (await res.json()) as ProblemDetails;
    } catch {
      /* corps vide ou non-JSON : on garde le statut seul */
    }
    throw new ApiError(res.status, problem);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return (await res.json()) as T;
}
