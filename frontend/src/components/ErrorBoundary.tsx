import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Change de valeur → la boundary se réinitialise (ex. changement de route). */
  resetKey?: unknown;
  onReset?: () => void;
  children: ReactNode;
}

interface State {
  erreur: Error | null;
}

/**
 * Les Error Boundaries sont ENCORE des composants classe en React 19
 * (getDerivedStateFromError n'a pas d'équivalent en hook).
 * Elles attrapent les erreurs de RENDU — pas celles des handlers ni des promesses
 * (celles-là, on les gère via TanStack Query : isError / error).
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { erreur: null };

  static getDerivedStateFromError(erreur: Error): State {
    return { erreur };
  }

  componentDidCatch(erreur: Error, info: ErrorInfo) {
    // Ici : envoyer à Application Insights / Sentry.
    console.error('Erreur de rendu', erreur, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.erreur && prev.resetKey !== this.props.resetKey) {
      this.setState({ erreur: null });
    }
  }

  private reessayer = () => {
    this.props.onReset?.();
    this.setState({ erreur: null });
  };

  render() {
    if (this.state.erreur) {
      return (
        <div role="alert" className="encart encart--erreur">
          <h2>Un problème est survenu</h2>
          <p>{this.state.erreur.message}</p>
          <button type="button" onClick={this.reessayer}>
            Réessayer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
