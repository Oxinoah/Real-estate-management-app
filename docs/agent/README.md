# Partie Agent — intégration et présentation

Cette documentation concerne uniquement le parcours Agent. Le point d'entrée
`src/screens/AgentHomeScreen.js` conserve les props `session` et `onLogout` attendues
par `App.js`. Aucun écran Buyer/Seller ou fichier partagé n'est modifié.

## État de livraison

Le code comprend portefeuille assigné, détail/photos/historique, édition,
publication d'un brouillon, finalisation d'une vente sous offre, renseignements,
offres d'achat, consultation/refus des candidatures et statistiques.

Le script SQL est **préparé, non exécuté**. L'application et les règles PostgreSQL
ne sont pas validées par les tests hors ligne. Le parcours Agent exige le contrat
`agent_integration_status` version 1 : sans lui, un message et une possibilité de
réessayer remplacent les fonctions, sans données fictives ni écriture de secours.
La présence du contrat n'est pas un audit du déploiement : recette en base requise.

L'acceptation locative et la finalisation d'une location restent explicitement
indisponibles. Le cahier des charges ne précise pas si accepter réserve le bien,
le loue immédiatement, rejette les autres candidatures ou autorise plusieurs
acceptations. Le code n'applique donc pas les règles de vente à la location.
Le refus d'une candidature pending d'un bien rent/active ne change pas le bien.

## Arborescence

```text
src/screens/AgentHomeScreen.js             entrée, identité, accès, navigation
src/screens/agent/
  AgentPropertyListScreen.js              portefeuille assigné
  AgentPropertyDetailScreen.js            détail, édition et historique
  AgentEnquiriesScreen.js                 consultation et réponse
  AgentDecisionsScreen.js                 offres et candidatures, règles séparées
  AgentStatsScreen.js                     indicateurs du portefeuille
src/components/agent/AgentUI.js            boutons, champs, cartes, états, styles
src/hooks/agent/useAgentResource.js        chargement et exécution d'une action
src/services/agent/agentService.js         requêtes et appels RPC
src/utils/agent/rules.js                   règles, validations, formatage
supabase/schema_03_agent_integration.sql   prérequis, à revoir avant application
tests/agent/agentRules.test.mjs            validations et états métier
tests/agent/agentService.test.mjs          service avec client simulé hors ligne
docs/agent/README.md                       ce document
```

Les composants partagés `Screen`, `Photo`, `StatusBadge` et `TabBar` sont réutilisés
sans modification. Aucun écran Buyer ou Seller n'est importé. La langue de
l'interface reste l'anglais comme les autres écrans ; cette explication est en français.

## Trajet session → requête → affichage

1. La connexion existante lit le profil. `App.js` sélectionne l'accueil Agent et
   lui transmet `{ user, role, fullName }` et `onLogout`.
2. `AgentHomeScreen` vérifie la présence de l'identité, crée un service avec le
   client Supabase partagé et `session.user.id`, puis demande le contrat serveur.
3. Un écran appelle `useAgentResource`. Le service lit les biens avec `agent_id`
   égal à cet identifiant. Les demandes utilisent une jointure `properties!inner`
   et le même filtre d'affectation. La RLS doit imposer cette restriction en base.
4. Le hook distingue chargement, échec et résultat vide. Une actualisation retire
   les anciennes données ; une ancienne requête ne remplace pas un résultat récent.
5. Une écriture valide le formulaire et appelle un RPC unique. Le serveur contrôle
   à nouveau le rôle et l'affectation, verrouille le bien et refuse les champs interdits.
6. Seule une réponse non nulle sans erreur produit un succès. `onChanged` incrémente
   une révision, les données affichées sont relues, et les statistiques sont
   recalculées à leur prochaine lecture. Aucun compteur fictif n'est incrémenté.

Le verrou local de `useAgentAction` empêche un double clic avant même le prochain
rendu React. Les boutons sont aussi désactivés pendant l'envoi. En cas d'échec,
le formulaire n'est pas vidé. Les comparaisons `updated_at` et `expected_response`
protègent respectivement l'édition et la réponse contre l'écrasement concurrent.
Une erreur de concurrence demande une actualisation explicite avant nouvelle saisie.

## Fonctions à comprendre pour l'oral

- `createAgentService` regroupe les échanges et reçoit un client injecté : les tests
  peuvent ainsi simuler Supabase sans utiliser un compte réel.
- `readAllPages` lit des pages avec un total exact et un ordre par identifiant.
  Il continue même si le serveur réduit la taille d'une page, et refuse un résultat
  tronqué, dupliqué ou un total changeant. Ce parcours de listes n'est pas une
  transaction de lecture : des changements concurrents demandent parfois une actualisation.
- `validateProperty` renvoie uniquement six champs autorisés. Le propriétaire,
  l'affectation et le statut ne sont jamais inclus dans l'édition du contenu.
- `canEditProperty` et `propertyTransitions` exposent les opérations définissables
  côté interface ; les mêmes restrictions sont imposées par le SQL.
- `agent_assigned_property` est un helper privé qui vérifie le véritable rôle,
  verrouille le bien et vérifie son affectation. Il n'est pas exposé au client.
- `agent_guard_property`, `agent_guard_decision` et `agent_guard_enquiry` protègent
  aussi les écritures REST directes : cacher un bouton ne protège pas une table.
- `accept_offer` conserve la signature partagée. Le déclencheur
  `agent_apply_offer_acceptance` rejette les autres pending et passe le bien sous
  offre dans **la même transaction**. Le verrou du bien et l'index unique partiel
  empêchent deux offres acceptées. Aucune succession d'updates côté mobile ne simule cela.
- L'ancien `properties_log_status` reste le seul mécanisme de création des lignes
  d'historique. Le nouveau code n'insère aucune ligne dans `status_history`.
- `agent_portfolio_stats` effectue une agrégation SQL complète en un seul snapshot.
  Les limites de pagination REST ne réduisent pas les totaux. `validateStats`
  refuse un objet de statistiques incomplet plutôt que d'afficher des faux totaux.

## Prérequis de base et revue d'équipe

Ne pas appliquer de script depuis l'application. Un membre autorisé doit d'abord
examiner la base de test et le fichier `supabase/schema_03_agent_integration.sql`.
Il suppose les tables, rôles Supabase et politiques exactes des deux schémas actuels.
Il est destiné à une application initiale, pas à être rejoué sans contrôle : les
nouveaux déclencheurs ne sont pas recréés avec effacement automatique.

Le script est transactionnel. Il s'arrête si des offres déjà acceptées sont
dupliquées ou incohérentes avec le bien ; il ne répare et ne supprime aucune donnée.
L'équipe doit comprendre et résoudre les données historiques avant de réessayer.

Effets attendus, à tester aussi sur Buyer et Seller :

- **Profils :** une inscription produit le rôle Buyer. Les rôles Seller/Agent sont
  attribués par une opération de confiance hors application. Les métadonnées
  d'inscription ne donnent plus un rôle privilégié. Un utilisateur conserve le
  droit de modifier son nom/téléphone, mais pas son identifiant, rôle ou date.
  Les rôles existants ne sont pas réattribués. L'exemple du README général qui
  propose un rôle via `signUp.options.data` n'est plus valable après cette intégration.
- **Affectation :** `properties.agent_id` doit être renseigné par un opérateur
  autorisé et pointer vers un profil Agent. Aucun écran d'auto-affectation n'est
  créé. Les seeds actuels ne renseignent pas ce champ : un portefeuille peut être vide.
- **Lecture :** les Agents ne lisent que les biens assignés. Buyers et Sellers
  conservent le catalogue publié ; les Sellers gardent leurs propres brouillons.
  `can_manage_property` limite les échanges/historiques aux propriétaires Seller
  et aux Agents assignés. La politique générale existante de lecture des profils
  n'est pas refondue ici ; sa visibilité du téléphone reste un point de revue partagé.
- **Création/suppression :** création propre Seller, statut initial draft/active,
  affectation initiale nulle ; suppression propre Seller conservée. Aucune création
  ou suppression Agent n'est autorisée par cette intégration.
- **Contenu :** édition uniquement draft/active. Par prudence, tous les champs de
  contenu sont gelés à partir d'under_offer, car le cahier ne précise pas lesquels.
  Changer vente/location est refusé si une offre ou candidature existe déjà.
  Les identifiants, le propriétaire, l'affectation et la date de création restent protégés.
- **Statuts :** draft → active ; active/sale → under_offer via une acceptation ;
  under_offer/sale → sold avec exactement une offre acceptée. Aucune sortie de
  sold/rented. Aucune transition locative finale tant que sa règle n'est pas décidée.
  Le SQL protège aussi ces règles pour les écritures directes Seller.
- **Offres :** les Buyers créent leurs propres pending sur une vente active.
  Seller propriétaire et Agent assigné peuvent décider. Une décision finale ne
  revient pas en pending ; les champs de l'offre sont immuables hors statut.
  Les mises à jour directes vers accepted déclenchent aussi l'opération atomique.
- **Locations :** les Buyers créent leurs pending sur une location active.
  Les gestionnaires peuvent refuser ; l'acceptation est bloquée jusqu'à clarification,
  y compris pour une écriture Seller directe, pour ne pas contourner la cohérence.
- **Renseignements :** Buyer auteur à la création, sans réponse initiale ;
  gestionnaire autorisé pour une réponse non vide. Aucun changement d'auteur/bien/message.
- **Permissions RPC :** seulement authenticated pour les points d'entrée,
  vérification serveur du rôle dans chaque action ; helpers et fonctions de
  déclencheurs retirés des RPC exécutables par les clients. Aucune clé privilégiée
  n'est ajoutée à l'application.

Les gardes reconnaissent comme non fiables les requêtes JWT `anon`/`authenticated`.
Les opérations administratives SQL/dashboard/service-role restent de confiance.
Leur usage pour provisionner des données exige une vérification humaine de cohérence.
Les visites et leurs politiques ne sont pas étendues dans cette livraison.

Le choix Supabase face à l'exigence de base locale reste une décision d'équipe/
enseignant. Ce travail conserve le client et l'architecture existants ; il ne
crée pas une seconde base ou un mécanisme de synchronisation implicite.

## Vérifications locales sans installation ni réseau

Avec un Node récent qui détecte les modules ES des fichiers `.js` (Node 24 utilisé) :

```powershell
node --test tests/agent/agentRules.test.mjs tests/agent/agentService.test.mjs
```

Les tests n'importent pas le client partagé, ne lisent pas `.env`, n'exécutent
pas React/Expo et ne contactent aucune base. Node peut avertir que le package
n'indique pas `type: module` ; ne pas changer la configuration partagée pour cela.
Ils vérifient des règles et requêtes, pas l'exécution du SQL, la RLS ou le rendu.

Une analyse syntaxique JSX et des chemins d'import est aussi possible avec les
outils déjà disponibles dans l'environnement ; aucun build applicatif n'a été lancé.

## Recette manuelle à effectuer après revue et déploiement de test

Créer des comptes distincts Agent A/Agent B, Seller V1/V2 et Buyer B1/B2 par une
opération de confiance. Préparer, sans utiliser de données personnelles :

| Bien | Agent | Seller | Transaction | Prix | Statut |
|---|---|---|---|---:|---|
| S1 | A | V1 | sale | 100000 | active |
| S2 | A | V1 | sale | 200000 | active |
| R1 | A | V2 | rent | 900 | active |
| D1 | A | V2 | sale | 150000 | draft |
| S3 | B | V2 | sale | 300000 | active |

Ajouter deux offres pending de B1/B2 sur S1, aucune sur S2/D1/R1, une candidature
pending sur R1 et un renseignement sur S1. Les données sont des prérequis de test,
pas un fallback dans l'application. Conserver aussi un compte Agent sans affectation.

1. **Contrat absent :** avant intégration, ouvrir l'Agent. Message explicite,
   bouton de reprise, aucune donnée fictive ni action d'écriture possible.
2. **Portefeuille :** A voit S1/S2/R1/D1 ; B voit S3 ; le compte vide voit une liste
   vide sans erreur. Après réaffectation administrative de S2 à B, A ne le retrouve
   plus au rafraîchissement et ses anciens formulaires ne peuvent plus le sauvegarder.
3. **Accès direct :** avec les sessions non privilégiées, tenter les RPC et REST
   sur le bien de l'autre Agent, changer seller_id/agent_id, puis changer son rôle
   ou son identifiant de profil. Refus attendu côté base, pas seulement dans l'UI.
   Vérifier qu'un Buyer ne peut pas appeler une action Agent.
4. **Édition :** A modifie S2 ; relire après reconnexion. Tester prix vide/négatif/
   infini/trois décimales et localisation vide. Couper le réseau après saisie :
   erreur sans succès et valeurs conservées. Deux fenêtres sur la même version :
   la seconde sauvegarde doit échouer sans écraser la première.
5. **Statuts/historique :** publier D1 et obtenir une seule nouvelle entrée.
   Vérifier que active → sold ou rented échoue. Après acceptation d'une offre S1,
   le contenu est verrouillé ; finaliser la vente, puis vérifier sold → active refusé.
6. **Renseignements :** B1 envoie une demande sur S1 depuis Buyer. A répond ;
   B1 retrouve la réponse dans son activité. B2 et l'Agent B ne peuvent pas lire
   cet échange privé. Tester réponse vide, double clic et conflit de deux réponses.
7. **Offres :** A accepte une offre S1 : exactement une accepted, l'autre rejected,
   S1 under_offer et une seule entrée d'historique. Réessayer une offre finale :
   refus. Avec deux sessions autorisées, accepter simultanément deux pending sur
   un nouveau bien : une seule doit réussir. Vérifier les trois tables après coup.
   Les conflits/verrous peuvent faire échouer une requête, jamais laisser un demi-succès.
8. **Candidatures :** A voit R1, B ne voit pas ses demandes. Acceptation désactivée ;
   refus confirmé → rejected, R1 reste active après reconnexion. Tenter accepted
   par REST direct : refus jusqu'à décision métier et évolution du contrat.
9. **Statistiques initiales :** pour A, quatre biens ; moyenne ventes 150000,
   moyenne loyers 900/mois ; actifs V1=2 et V2=1 ; S1=2 offres et les trois autres=0.
   S3 est exclu. Après modification/acceptation/publication, actualiser les résultats.
   Moyennes : tous les statuts du portefeuille ; « par utilisateur » = par Seller.
   Tester aussi zéro bien et des volumes dépassant la limite REST configurée.
10. **Régression partagée :** Buyer conserve catalogue, favoris, envoi de demandes
    et offres/candidatures valides ; Seller conserve ses droits propres et la
    signature `accept_offer(bigint)`. Aucun compte ne peut s'auto-promouvoir.

Ces scénarios restent **à exécuter**. Ils ne sont pas validés par les tests simulés.
