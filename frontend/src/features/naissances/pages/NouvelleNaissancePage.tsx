import { useNavigate } from 'react-router-dom';
import { NaissanceForm } from '../components/NaissanceForm';
import { useEnregistrerNaissance } from '../hooks';

/**
 * Page « conteneur » : elle branche la mutation et la navigation.
 * Le formulaire, lui, ne sait rien de TanStack Query ni du routeur → facile à tester.
 */
export default function NouvelleNaissancePage() {
  const navigate = useNavigate();
  const { mutateAsync } = useEnregistrerNaissance();

  return (
    <section aria-labelledby="titre-nouvelle">
      <h1 id="titre-nouvelle">Déclarer une naissance</h1>
      <p className="intro">Les champs marqués d’un * sont obligatoires.</p>
      <NaissanceForm
        onSoumettre={async (requete) => {
          const { id } = await mutateAsync(requete);
          // `state` : message flash affiché une seule fois par la page détail.
          navigate(`/naissances/${id}`, { state: { message: 'Naissance enregistrée avec succès.' } });
        }}
      />
    </section>
  );
}
