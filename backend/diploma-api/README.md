# diploma-api — Backend du registre de diplômes (NestJS · Fabric Gateway · MinIO · Keycloak)

Couche 2 de l'architecture : **API métier**, **Fabric Gateway** et authentification, située entre les interfaces
(React / Flutter) et le réseau Hyperledger Fabric. Dossier cible dans l'arborescence du projet : `backend/diploma-api/`.

## Principe de fonctionnement

| Étape | Ce que fait le backend |
|---|---|
| Émission | Calcule le **SHA-256** du PDF, pseudonymise l'étudiant (**HMAC-SHA256**), chiffre le PDF en **AES-256-GCM**, le dépose dans **MinIO**, puis inscrit uniquement l'empreinte et les métadonnées dans Fabric (`CreateDiploma`). Si Fabric échoue, l'objet MinIO est supprimé. |
| Vérification | Recalcule le SHA-256 du PDF présenté et le compare à l'empreinte inscrite dans Fabric. Un seul bit modifié invalide la vérification. Un diplôme `REVOKED` n'est jamais valide. |
| Révocation | Transaction `RevokeDiploma` (Université ou Ministère). |
| Partage | L'étudiant génère un lien signé à durée limitée ; le recruteur le vérifie sans compte via `/public/verify/:token`. |
| Conformité RGPD | Aucune donnée personnelle en clair dans la blockchain : seulement `studentRef` (pseudonyme), l'empreinte et des métadonnées du diplôme. |

> **Stockage S3 :** l'image Docker `minio/minio` n'est plus distribuée (dépôts retirés de Docker Hub en 2026). Le `docker-compose.yml`
> utilise **RustFS** (compatible S3). Le code n'a pas changé : il utilise un client S3 standard, et les variables `MINIO_*`
> du `.env` désignent simplement le serveur S3 (RustFS, Garage, AWS S3…).

## Prérequis

- Node.js 20+
- Réseau Fabric 2.x démarré (canal `diploma-channel`, chaincode `diplomacontract` déployé) avec la **Gateway** activée sur le peer
- MinIO et Keycloak (fournis dans `docker-compose.yml` pour le développement)

## Démarrage

```bash
cp .env.example .env
# Générer les secrets :
#   openssl rand -hex 32   -> ENCRYPTION_KEY_HEX, STUDENT_REF_PEPPER, SHARE_TOKEN_SECRET
npm install
npm run start:dev          # http://localhost:3000  — Swagger : http://localhost:3000/docs
```

Avec Docker (MinIO + Keycloak + API) : renseigner dans `.env` `MINIO_SECRET_KEY`, `KEYCLOAK_DB_PASSWORD`,
`KEYCLOAK_ADMIN_PASSWORD`, `FABRIC_ID_DIR` (dossier de l'utilisateur Org1) et `FABRIC_PEER_TLS_DIR`, puis `docker compose up --build`.

> ⚠️ Le `.env`, les clés privées (`*.pem`, `*.key`) et le dossier `secrets/` ne doivent jamais être versionnés.

## Configuration Keycloak

> Import automatique : `docker compose up -d keycloak` importe le realm `university` depuis `keycloak/university-realm.json`
> (rôles, client `diploma-frontend` avec PKCE, comptes de test `univ1`, `ministere1`, `recruteur1`, `D130012345`, mot de passe
> `Diplome#2026`). Le claim `student_id` reprend le nom d'utilisateur : l'étudiant se connecte avec son identifiant étudiant.
> Les étapes manuelles ci-dessous ne servent que si vous ne souhaitez pas utiliser l'import.

1. Créer un realm `university`.
2. Créer les **rôles de realm** : `university`, `ministry`, `recruiter`, `student`.
3. Créer un client public (ex. `diploma-frontend`) et un utilisateur par rôle.
4. Pour les étudiants, ajouter un attribut utilisateur `student_id` (CNE / Massar) et un *mapper* « User Attribute » vers le claim
   de jeton `student_id` (Access token : activé).
5. Renseigner `KEYCLOAK_URL` et `KEYCLOAK_REALM` dans `.env`. Les jetons sont vérifiés via le JWKS du realm (RS256).

## Contrat attendu du chaincode Go (`diplomacontract`)

Le backend appelle les fonctions suivantes (tous les arguments sont des chaînes ; les retours sont du JSON) :

| Fonction | Arguments | Type | Retour |
|---|---|---|---|
| `CreateDiploma` | `diplomaId, studentRef, institution, degree, major, issueDate, documentHash, storageRef, requestedBy` | submit | `DiplomaRecord` |
| `ReadDiploma` | `diplomaId` | evaluate | `DiplomaRecord` (erreur « does not exist » si absent) |
| `RevokeDiploma` | `diplomaId, reason, requestedBy` | submit | `DiplomaRecord` (erreur « already revoked » si déjà révoqué) |
| `GetDiplomasByStudent` | `studentRef` | evaluate | `DiplomaRecord[]` (requête riche CouchDB sur `studentRef`) |
| `GetAllDiplomas` | — | evaluate | `DiplomaRecord[]` |
| `GetDiplomaHistory` | `diplomaId` | evaluate | `HistoryEntry[]` (`GetHistoryForKey`) |

Les types `DiplomaRecord` et `HistoryEntry` sont définis dans `src/diplomas/diploma.model.ts`. Le chaincode doit renvoyer
des messages d'erreur contenant `does not exist`, `already exists` ou `already revoked` : ils sont traduits en 404 / 409.
Le chaincode doit aussi contrôler les droits via l'identité MSP de l'appelant (émission : Org1 ; révocation : Org1 ou Org2).

## Endpoints

| Méthode | Route | Rôles | Description |
|---|---|---|---|
| POST | `/diplomas` | university | Émission (multipart : `file` PDF, `studentId`, `institution`, `degree`, `major?`, `issueDate`) |
| POST | `/diplomas/verify` | recruiter, university, ministry | Vérification (multipart : `file` PDF, `diplomaId`) |
| GET | `/diplomas` | university, ministry | Liste du registre |
| GET | `/diplomas/me` | student | Diplômes de l'étudiant connecté |
| GET | `/diplomas/audit/all` | ministry | Audit national |
| GET | `/diplomas/:id` | tous | Détails d'un diplôme (l'étudiant ne voit que les siens) |
| GET | `/diplomas/:id/history` | ministry, university | Historique des transactions |
| GET | `/diplomas/:id/document` | university, ministry, student (propriétaire) | PDF déchiffré, contrôle d'intégrité inclus |
| POST | `/diplomas/:id/revoke` | university, ministry | Révocation (`{ "reason": "..." }`) |
| POST | `/diplomas/:id/share` | student (propriétaire) | Lien de partage (`{ "ttlMinutes": 60 }`) |
| GET | `/diplomas/:id/credential` | university, ministry, student | Justificatif Open Badges 3.0 (JSON-LD) |
| GET | `/transactions/:txId` | recruiter, university, ministry | Vérification instantanée d'une transaction du registre |
| GET | `/stats` | ministry, university | Statistiques des 12 derniers mois (tableau de bord) |
| POST | `/access/request` | public | Demande d'accès étudiant (Turnstile + honeypot, 5 requêtes/min/IP) |
| GET | `/access/me` | student | État du cycle de 30 jours (compte à rebours) |
| GET | `/public/verify/:token` | public | Vérification via lien de partage |
| GET | `/health` | public | État Fabric / MinIO |

### Exemples

```bash
TOKEN=...   # jeton Keycloak du rôle "university"

curl -X POST http://localhost:3000/diplomas \
  -H "Authorization: Bearer $TOKEN" \
  -F file=@diplome.pdf -F studentId=D130012345 \
  -F institution="Université Mohammed V de Rabat" \
  -F degree="Master" -F major="SNIA" -F issueDate=2026-07-15

curl -X POST http://localhost:3000/diplomas/verify \
  -H "Authorization: Bearer $RECRUITER_TOKEN" \
  -F file=@diplome.pdf -F diplomaId=<UUID>
```

## Structure

```
src/
├── main.ts                  # bootstrap : helmet, CORS, validation, Swagger
├── app.module.ts
├── config/                  # configuration typée + validation des variables d'environnement
├── fabric/                  # FabricService : connexion gRPC, submit / evaluate, mapping des erreurs
├── storage/                 # StorageService : MinIO (S3)
├── common/                  # CryptoService : SHA-256, HMAC, AES-256-GCM
├── auth/                    # AuthGuard (JWT Keycloak), RolesGuard, @Roles, @CurrentUser
├── diplomas/                # contrôleur, service, DTOs, modèle
├── public/                  # vérification publique par lien de partage
└── health/
```

## Cycle de vie des accès étudiants (30 jours)

`POST /access/request` recoupe les informations saisies par l'étudiant avec les données d'identité chiffrées hors chaîne,
puis crée ou réactive son compte Keycloak et délivre un mot de passe temporaire (changement imposé à la première
connexion). L'accès dure `ACCESS_WINDOW_DAYS` jours ; une tâche planifiée horaire (`AccessLifecycleJob`) désactive le
compte et ferme ses sessions à l'échéance. La régénération repasse par la même vérification d'identité.

Prérequis : le client confidentiel `diploma-backend` (créé par l'import du realm) avec les rôles `manage-users`,
`view-users` et `query-users` de `realm-management`. **Changez son secret avant toute mise en ligne.**

## Sécurité du transport

`FORCE_HTTPS=true` active la redirection HTTP vers HTTPS et HSTS (2 ans, sous-domaines, preload). En production,
`TURNSTILE_SECRET_KEY`, `KEYCLOAK_ADMIN_CLIENT_SECRET`, `CORS_ORIGINS` et `FORCE_HTTPS=true` sont obligatoires : le
démarrage échoue sinon. Une limitation de débit globale (120 requêtes/min/IP) protège l'API, avec un plafond plus strict
sur la demande d'accès.

## Remarques de sécurité et limites

- Ce backend utilise **une identité Fabric unique (Org1)**. Pour un fonctionnement multi-organisations, déployer une instance par
  organisation (identité Org2, Org3) ou ajouter une sélection d'identité par rôle.
- Prévoir en production : TLS devant l'API (reverse proxy), limitation de débit (ex. `@nestjs/throttler`), gestion des secrets
  (Vault / Docker secrets), rotation de `ENCRYPTION_KEY_HEX` et sauvegardes chiffrées de MinIO.
- Le lien de partage donne accès aux seules métadonnées publiques du diplôme, jamais au PDF.
- Le code a été relu et vérifié syntaxiquement, mais **non exécuté contre un réseau Fabric réel** : tester d'abord sur votre
  réseau de développement.
