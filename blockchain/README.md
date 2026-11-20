# Couche blockchain — Registre de diplômes (Hyperledger Fabric 2.5 LTS (2.5.16))

Cette couche correspond à la **couche 3** (réseau consortium) du schéma d'architecture et au chaincode Go de la couche 2.
Elle s'intègre dans l'arborescence `university-blockchain/` :

| Dossier | Contenu |
|---|---|
| `blockchain/config/` | `configtx.yaml` (consortium, canal, politiques), `crypto-config.yaml`, `network.env` (versions, noms) |
| `blockchain/docker/` | `docker-compose.yaml` : 3 orderers Raft, 3 peers (Org1/Org2/Org3), 3 CouchDB |
| `blockchain/organizations/` | certificats X.509 / MSP / TLS générés (ne pas versionner) |
| `blockchain/channel-artifacts/` | bloc de genèse du canal, package du chaincode (généré) |
| `blockchain/scripts/network.sh` | automatisation complète (up, canal, déploiement, tests, connexion du backend) |
| `chaincode/diplomacontract/` | smart contract Go + index CouchDB |
| `security/policies/` | politique d'endossement (`endorsement-policy.txt`) |
| `deployment/Makefile` | raccourcis (`make all`, `make down`, …) |

## Architecture déployée

| Élément | Rôle | Port hôte |
|---|---|---|
| `orderer1/2/3.example.com` | Service de commande Raft (3 nœuds, tolère la panne d'un nœud) | 7050 / 8050 / 9050 (admin 7053 / 8053 / 9053) |
| `peer0.org1.example.com` + `couchdb0` | **Org1 – Université** : émission et signature | 7051 |
| `peer0.org2.example.com` + `couchdb1` | **Org2 – Ministère** : audit et supervision | 9051 |
| `peer0.org3.example.com` + `couchdb2` | **Org3 – Recruteurs** : vérification en lecture seule | 11051 |
| Canal `diploma-channel` | canal partagé, créé avec l'API de participation aux canaux (sans canal système) | — |

## Gouvernance (contrôle d'accès dans le chaincode)

| Fonction | Org1 Université | Org2 Ministère | Org3 Recruteurs |
|---|:-:|:-:|:-:|
| `CreateDiploma` | ✔ | ✘ | ✘ |
| `RevokeDiploma` | ✔ | ✔ | ✘ |
| `ReadDiploma`, `GetDiplomaByHash` | ✔ | ✔ | ✔ |
| `GetDiplomasByStudent`, `GetAllDiplomas`, `GetDiplomasPage`, `GetDiplomaHistory` | ✔ | ✔ | ✘ |

Le contrôle s'appuie sur l'identité X.509 de l'appelant (MSP ID). La table est dans `chaincode/diplomacontract/contract/access.go`.
La politique d'endossement par défaut est `OR('Org1MSP.peer','Org2MSP.peer')` (`security/policies/endorsement-policy.txt`).

## Prérequis

1. Docker Desktop démarré (intégration WSL activée), Go ≥ 1.21, `curl`, `git`.
2. Images Fabric **2.5.16** (série LTS ; version 2.5.15 ou plus récente **obligatoire avec Docker Engine 29+**, sinon l'installation du chaincode échoue avec `write unix @->/var/run/docker.sock: broken pipe`) et binaires de la série 2.5 :

```bash
cd ~
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.16 docker samples binary
```

Si vous aviez installé une autre version, relancez la commande : elle remplace les binaires dans `~/fabric-samples/bin`.

Vérification locale du chaincode (sans cgo, comme dans le conteneur de compilation) :

```bash
cd chaincode/diplomacontract && go mod tidy -go=1.21 && CGO_ENABLED=0 go build ./... && CGO_ENABLED=0 go vet ./...
```

## Démarrage rapide

```bash
cd ~/university-blockchain/blockchain/scripts
./network.sh all          # certificats, réseau, canal, chaincode, test, connexion du backend
```

Ou étape par étape : `./network.sh up` → `channel` → `deploy` → `test` → `connect-backend`.
Le premier `deploy` est long (téléchargement des dépendances Go et compilation du chaincode dans Docker, sur 3 peers).

### Connexion avec le backend NestJS

`./network.sh connect-backend` :
- copie l'identité `User1@org1.example.com` et le certificat TLS du peer dans `security/certificates/org1/` ;
- met à jour `backend/diploma-api/.env` (`FABRIC_MOCK=false`, canal, chaincode, chemins des certificats).

Puis redémarrez l'API (`npm run start:dev`) et vérifiez `curl -s http://localhost:3000/health` : `"fabric":true`.

Contrat d'interface avec le backend (arguments dans l'ordre) :

| Fonction | Arguments |
|---|---|
| `CreateDiploma` | `diplomaId, studentRef, institution, degree, major, issueDate, documentHash, storageRef, requestedBy` |
| `ReadDiploma` | `diplomaId` |
| `RevokeDiploma` | `diplomaId, reason, requestedBy` |
| `GetDiplomasByStudent` | `studentRef` |
| `GetAllDiplomas` | — |
| `GetDiplomaHistory` | `diplomaId` |
| *(extensions)* `GetDiplomaByHash`, `GetDiplomasPage(pageSize, bookmark)` | `documentHash` ; `pageSize, bookmark` |

## Évolutivité

- **Nouvelle version du chaincode** (sans arrêt du réseau) : `CC_VERSION=1.1 CC_SEQUENCE=2 ./network.sh deploy`.
- **Schéma des données** : champ `schemaVersion` dans chaque enregistrement, pour migrer les données progressivement.
- **Listes volumineuses** : `GetDiplomasPage` (pagination) ; index CouchDB dans `META-INF/statedb/couchdb/indexes/`.
- **Événements** : `DiplomaIssued` et `DiplomaRevoked` permettent à d'autres services (notifications, analytique) de s'abonner.
- **Nouveaux orderers / organisations** : l'API de participation aux canaux et les mises à jour de configuration de canal
  permettent d'ajouter des nœuds ou des organisations sans reconstruire le réseau.
- **Gouvernance** : ajouter une organisation ou un rôle = modifier `accessPolicy` + nouvelle version du chaincode.

## Cohérence avec les normes

Conception cohérente avec la norme **ISO/IEC 23257** (architecture de référence blockchain et DLT) citée dans votre document :
séparation des couches, consortium permissionné, gouvernance explicite. Mécanismes de sécurité utilisés : certificats X.509 et MSP,
TLS sur toutes les communications (peers, orderers, canal d'administration), hachage SHA-256, signatures ECDSA (P-256 par défaut
avec cryptogen), aucune donnée personnelle en clair dans le ledger. Cela soutient une démarche **ISO/IEC 27001**, sans constituer
à lui seul une certification (qui relève de l'organisation et de ses processus).

## Limites actuelles et passage en production

- Ce réseau est un **environnement de développement sur une seule machine**. Le dimensionnement de votre document (6 serveurs)
  se retrouve en répartissant chaque service du compose sur sa machine.
- `cryptogen` est réservé au développement : en production, utiliser **Fabric CA** (CA-Org1/2/3), idéalement avec des clés
  protégées par HSM, et mettre en place sauvegardes et supervision (métriques Prometheus des peers/orderers).
- Changer les identifiants CouchDB (`config/network.env`) et ne jamais exposer leurs ports.
- La politique `OR(Org1, Org2)` permet à l'Université d'émettre sans attendre l'endossement du Ministère. Pour imposer les deux
  signatures (`AND`), définir les **peers d'ancrage** de chaque organisation (découverte entre organisations), puis modifier la
  politique et redéployer avec `CC_SEQUENCE` incrémenté.
- Le code a été relu mais **n'a pas été exécuté ici** (pas de Docker ni de Fabric dans l'environnement de rédaction) :
  les premiers essais sur votre machine peuvent nécessiter de petits ajustements.
