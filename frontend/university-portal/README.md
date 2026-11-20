# university-portal — Portail web du registre de diplômes

Interface de la **couche 1** (React, TypeScript, Vite). Elle s'appuie sur l'API `diploma-api` (couche 2) et sur Keycloak.
Dossier cible : `frontend/university-portal/`.

## Direction artistique : Obsidienne, Or Champagne et Émeraude

| Rôle | Valeur | Usage |
|---|---|---|
| Fond principal | `#0D1110` | Arrière-plan de l'application |
| Cartes et conteneurs | `#161B1A`, bordures `#262E2C` | Fiches, panneaux, tableaux |
| Action principale | `#D4B46A` sur texte `#0D1110` | **Un seul bouton par vue** |
| Validation blockchain, statut actif | `#10B981` | Diplôme valide, accès actif, coche du sceau |

Tous les jetons sont dans `src/styles/tokens.css`. Les couples texte / fond ont été mesurés : le plus faible atteint
**5,2:1**, au-delà du minimum AA de 4,5:1 (texte) et 3:1 (composants d'interface).

**Hiérarchie des actions.** Une vue ne comporte qu'un bouton or. Les actions secondaires sont des liens soulignés
(`variant="link"`), les actions destructrices un lien rouge (`dangerlink`) menant à une confirmation. Le rouge plein
n'apparaît que dans la boîte de dialogue de confirmation. Seul le bandeau de consentement présente deux boutons de poids
égal, « Accepter » et « Refuser », comme l'exige le RGPD.

**Typographie.** IBM Plex Sans pour l'interface, IBM Plex Serif pour les titres des fiches et les grands nombres,
auto-hébergées via `@fontsource` (aucun appel à un CDN).

**Mobile.** Les tableaux se transforment en listes étiquetées sous 44 rem, le graphique reste un SVG fluide dont
l'infobulle laisse place au tableau de données, les formulaires passent sur une colonne, le menu devient un panneau
dépliant. Les cibles tactiles font au moins 44 px.

## Fonctionnalités par acteur

| Rôle | Pages |
|---|---|
| **Université** | Émission (identité complète du titulaire, identifiant unique, filière, année, PDF, empreinte calculée dans le navigateur), registre, fiche, révocation motivée, historique, tableau de bord |
| **Ministère** | Tableau de bord (courbes interactives sur 12 mois), audit du registre, fiche, historique, révocation |
| **Recruteur** | Vérification instantanée d'une transaction blockchain (QR code ou identifiant) et vérification d'un document PDF |
| **Étudiant** | Demande d'authentification en ligne, compte à rebours d'accès, consultation, téléchargement, justificatif Open Badges, lien de partage |
| **Sans compte** | Accueil, demande d'accès, vérification par lien, politique de confidentialité, CGU |

### Cycle de vie de 30 jours

L'étudiant saisit ses informations personnelles et les détails de son diplôme sur `/request-access`. Le backend les
recoupe avec les données enregistrées par l'université ; en cas de concordance, il crée ou réactive le compte Keycloak et
délivre un mot de passe temporaire. L'accès est valable 30 jours : le portail affiche « Accès actif : expire dans X jours »
(ambre sous 7 jours, rouge à l'expiration). Une tâche planifiée horaire côté backend désactive le compte et ferme les
sessions à l'échéance. La régénération (`/request-access?mode=regenerate`) repasse par la même vérification d'identité.

## Démarrage

```bash
cp .env.example .env
npm install
npm run dev            # http://localhost:5173
```

`npm run build` vérifie les types puis produit `dist/`.

## Sécurité : aucune donnée sensible côté client

Tout ce qui commence par `VITE_` est intégré au code envoyé au navigateur. Ce dépôt n'y place que des valeurs publiques :
URL de l'API et de Keycloak, identifiant du client public, **clé publique** Turnstile, nom de l'établissement. Les secrets
(clé secrète Turnstile, secret du compte de service Keycloak, clés de chiffrement, poivre de pseudonymisation) vivent
uniquement dans `backend/diploma-api/.env` et ne sortent jamais du serveur.

La validation des formulaires côté client n'est qu'un confort de saisie : les mêmes règles sont ré-appliquées par le
backend, qui reste seul juge. La protection anti-robot combine un **champ piège** (honeypot, hors écran et hors du
parcours clavier) et **Cloudflare Turnstile**, dont le jeton est vérifié côté serveur.

`nginx.conf` force la redirection HTTPS, active HSTS (2 ans, sous-domaines, preload) et une CSP restrictive.
Adaptez-y les domaines de votre API, de Keycloak et de l'outil d'audience.

## RGPD, mesure d'audience et pages légales

Le bandeau de consentement bloque tout traceur non essentiel tant qu'aucun choix n'a été fait. Le script de mesure
d'audience (Plausible par défaut) n'est inséré dans la page qu'après acceptation, et il est retiré si le consentement est
retiré. Le choix se modifie à tout moment par « Gérer les cookies » en pied de page.

Les pages `/privacy` et `/terms` traitent le cas particulier de la blockchain : pseudonymisation par HMAC-SHA256,
chiffrement hors chaîne, et effet d'une demande d'effacement sur une écriture immuable. **Ces textes sont des modèles de
travail** : laissez `VITE_LEGAL_DRAFT=true` tant que le délégué à la protection des données et le service juridique ne les
ont pas validés ; un bandeau d'avertissement s'affiche alors en tête de page.

## Référencement et performance

Chaque page définit son `<title>`, sa description, ses balises Open Graph et Twitter Card, son lien canonique et sa
directive robots (`src/lib/useSeo.ts`). Les espaces authentifiés et les liens de partage sont en `noindex`.
`public/robots.txt` et `public/sitemap.xml` n'exposent que les pages publiques : **remplacez-y le domaine d'exemple**
par celui de votre installation.

Le jeu de favicons (ICO multi-tailles, SVG, PNG, icône iOS, icônes d'installation) et l'image de partage `og-image.png`
sont générés à la palette du thème. Les vues secondaires sont chargées à la demande (`React.lazy`), les images portent un
texte alternatif et un chargement différé, et les fichiers versionnés sont mis en cache un an par nginx.

## Structure

```
src/
├── main.tsx, App.tsx          # point d'entrée, routes (chargement différé)
├── config.ts                  # variables publiques, refus de démarrer si une valeur manque en production
├── auth/                      # Keycloak (OIDC, PKCE S256), contexte d'authentification
├── api/                       # client HTTP, diplômes, transactions, statistiques, accès
├── i18n/                      # dictionnaires fr / en (423 messages chacun)
├── components/                # interface : graphique, onglets, QR code, Turnstile, consentement…
├── pages/                     # Home, RequestAccess, Issue, DiplomaList, DiplomaDetail, MyDiplomas,
│                              # Dashboard, Verify, PublicVerify, Legal (CGU + confidentialité), NotFound
├── lib/                       # hachage SHA-256, validation stricte, formats, SEO, hooks
└── styles/                    # tokens.css (jetons) et app.css
public/                        # favicons, og-image, manifest, robots.txt, sitemap.xml
```

## Limites connues

- Le code a été relu, les dictionnaires et les liens vérifiés automatiquement, mais **il n'a pas été compilé ici**
  (pas de réseau pour installer les paquets) : lancez `npm run build` pour détecter d'éventuelles erreurs de typage.
- Application web uniquement : l'application mobile Flutter du schéma n'est pas incluse.
- Interface en français et en anglais ; l'arabe demandera un dictionnaire supplémentaire et une relecture de l'affichage
  de droite à gauche (les propriétés CSS logiques sont déjà en place).
- L'état du cycle de vie des accès est conservé dans un fichier JSON côté backend : pour plusieurs instances, remplacez-le
  par une base de données.
