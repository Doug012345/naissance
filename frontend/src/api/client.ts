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

async function verifier(res: Response) {
  if (res.ok) return;
  let problem: ProblemDetails = { status: res.status };
  try {
    problem = (await res.json()) as ProblemDetails;
  } catch {
    /* corps vide ou non-JSON : on garde le statut seul */
  }
  throw new ApiError(res.status, problem);
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  await verifier(res);

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export interface Fichier {
  contenu: Blob;
  nom: string;
  /** En-tête X-Numero-Copie (certificat PDF). */
  numeroCopie: number | null;
}

/** POST qui renvoie un fichier (PDF…) : nom tiré de Content-Disposition. */
export async function telecharger(path: string): Promise<Fichier> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST', headers: { Accept: 'application/pdf' } });
  await verifier(res);

  const disposition = res.headers.get('content-disposition') ?? '';
  const nom =
    /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1] ?? /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? 'document.pdf';
  const copie = res.headers.get('x-numero-copie');
  return { contenu: await res.blob(), nom: decodeURIComponent(nom), numeroCopie: copie ? Number(copie) : null };
}

/** Propose le fichier à l'enregistrement (lien temporaire, libéré aussitôt). */
export function enregistrerFichier({ contenu, nom }: Fichier) {
  const url = URL.createObjectURL(contenu);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nom;
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
