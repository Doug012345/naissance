import { http } from './client';

// Miroir de Naissances.Api/Endpoints/AuthEndpoints.cs.
// Le cookie de session est HttpOnly : JavaScript ne le voit jamais, le navigateur l'envoie seul.

export interface Utilisateur {
  courriel: string;
}

export interface ChangerMotDePasseRequete {
  motDePasseActuel: string;
  nouveauMotDePasse: string;
}

export const authApi = {
  moi(signal?: AbortSignal) {
    return http<Utilisateur>('/api/auth/moi', { signal });
  },

  connexion(courriel: string, motDePasse: string) {
    return http<Utilisateur>('/api/auth/connexion', {
      method: 'POST',
      body: JSON.stringify({ courriel, motDePasse }),
    });
  },

  deconnexion() {
    return http<void>('/api/auth/deconnexion', { method: 'POST' });
  },

  changerMotDePasse(requete: ChangerMotDePasseRequete) {
    return http<void>('/api/auth/mot-de-passe', {
      method: 'POST',
      body: JSON.stringify(requete),
    });
  },

  /** Répond 202 que le compte existe ou non (on ne révèle pas les comptes). */
  motDePasseOublie(courriel: string) {
    return http<void>('/api/auth/mot-de-passe-oublie', {
      method: 'POST',
      body: JSON.stringify({ courriel }),
    });
  },

  reinitialiser(requete: ReinitialisationRequete) {
    return http<void>('/api/auth/reinitialisation', {
      method: 'POST',
      body: JSON.stringify(requete),
    });
  },
};

export interface ReinitialisationRequete {
  utilisateurId: string;
  jeton: string;
  nouveauMotDePasse: string;
}
