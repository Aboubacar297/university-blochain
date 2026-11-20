#!/usr/bin/env bash
# =============================================================================
#  Registre de diplômes - Réseau Hyperledger Fabric (3 orgs, 3 orderers Raft, CouchDB)
#  Usage : ./network.sh <commande>      (./network.sh help)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$BC_DIR/.." && pwd)"

# Paramètres (config/network.env) ; les variables d'environnement déjà définies restent prioritaires.
for v in FABRIC_VERSION FABRIC_IMAGE_TAG CHANNEL_NAME CC_NAME CC_VERSION CC_SEQUENCE; do
  eval "preset_$v=\${$v:-}"
done
set -a; source "$BC_DIR/config/network.env"; set +a
for v in FABRIC_VERSION FABRIC_IMAGE_TAG CHANNEL_NAME CC_NAME CC_VERSION CC_SEQUENCE; do
  eval "[ -n \"\${preset_$v}\" ] && export $v=\"\${preset_$v}\" || true"
done

FABRIC_SAMPLES_DIR="${FABRIC_SAMPLES_DIR:-$HOME/fabric-samples}"
export PATH="$FABRIC_SAMPLES_DIR/bin:$PATH"

ORG_DIR="$BC_DIR/organizations"
ART_DIR="$BC_DIR/channel-artifacts"
CC_DIR="$PROJECT_DIR/chaincode/diplomacontract"
POLICY_FILE="$PROJECT_DIR/security/policies/endorsement-policy.txt"
BLOCK="$ART_DIR/${CHANNEL_NAME}.block"
CC_PKG="$ART_DIR/${CC_NAME}_${CC_VERSION}.tar.gz"
ORDERER_CA="$ORG_DIR/ordererOrganizations/example.com/tlsca/tlsca.example.com-cert.pem"
COMPOSE=(docker compose -p diploma -f "$BC_DIR/docker/docker-compose.yaml" --env-file "$BC_DIR/config/network.env")

PEER_PORTS=(0 7051 9051 11051)      # index = numéro d'organisation
ORDERER_PORTS=(0 7050 8050 9050)
ORDERER_ADMIN_PORTS=(0 7053 8053 9053)

log()  { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✔ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m⚠ %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✘ %s\033[0m\n' "$*" >&2; exit 1; }

retry() { # retry <essais> <pause> <commande...>
  local n=$1 pause=$2 i; shift 2
  for ((i = 1; i <= n; i++)); do
    "$@" && return 0
    warn "tentative $i/$n échouée, nouvel essai dans ${pause}s..."
    sleep "$pause"
  done
  return 1
}

# ----------------------------------------------------------------------------- prérequis
check_prereqs() {
  log "Vérification des prérequis"
  command -v docker >/dev/null || die "docker introuvable"
  docker info >/dev/null 2>&1 || die "le démon Docker ne répond pas (ouvrez Docker Desktop)"
  docker compose version >/dev/null 2>&1 || die "plugin 'docker compose' introuvable"
  for b in cryptogen configtxgen osnadmin peer; do
    command -v "$b" >/dev/null || die "binaire '$b' introuvable dans $FABRIC_SAMPLES_DIR/bin
   → installez Fabric : cd ~ && ./install-fabric.sh --fabric-version $FABRIC_VERSION docker samples binary"
  done
  local pv; pv="$(peer version 2>/dev/null | awk '/Version:/ {print $2; exit}')"; pv="${pv#v}"
  ok "binaire peer $pv ; images des conteneurs : $FABRIC_IMAGE_TAG"
  case "$pv" in 2.5.*) ;; *) warn "binaire peer $pv : la série 2.5 est recommandée (install-fabric.sh --fabric-version $FABRIC_VERSION)" ;; esac
  # Docker Engine 29+ exige Fabric >= 2.5.15 (correctif de compatibilité de la compilation du chaincode)
  local dv; dv="$(docker version --format '{{.Server.Version}}' 2>/dev/null || true)"
  case "$dv" in
    29.*|[3-9][0-9].*)
      case "$FABRIC_VERSION" in
        2.5.1[5-9]|2.5.[2-9][0-9]|3.*) ;;
        *) die "Docker $dv nécessite Fabric 2.5.15 ou plus récent (version configurée : $FABRIC_VERSION, voir config/network.env)" ;;
      esac ;;
  esac
  for img in fabric-peer fabric-orderer; do
    docker image inspect "hyperledger/$img:$FABRIC_IMAGE_TAG" >/dev/null 2>&1 \
      || { warn "image hyperledger/$img:$FABRIC_IMAGE_TAG absente : téléchargement"; docker pull "hyperledger/$img:$FABRIC_IMAGE_TAG" >/dev/null \
           || die "téléchargement impossible : docker pull hyperledger/$img:$FABRIC_IMAGE_TAG"; }
  done
  # Images de compilation du chaincode : le peer les référence par la série (ex. 2.5) ; on les aligne sur FABRIC_IMAGE_TAG
  local series="${FABRIC_IMAGE_TAG%.*}"
  for img in fabric-ccenv fabric-baseos; do
    docker image inspect "hyperledger/$img:$FABRIC_IMAGE_TAG" >/dev/null 2>&1 \
      || docker pull "hyperledger/$img:$FABRIC_IMAGE_TAG" >/dev/null \
      || die "téléchargement impossible : docker pull hyperledger/$img:$FABRIC_IMAGE_TAG"
    docker tag "hyperledger/$img:$FABRIC_IMAGE_TAG" "hyperledger/$img:$series"
  done
  [ -f "$FABRIC_SAMPLES_DIR/config/core.yaml" ] || die "core.yaml introuvable dans $FABRIC_SAMPLES_DIR/config"
  ok "prérequis OK"
}

# ----------------------------------------------------------------------------- environnement par organisation
peer_tls_ca() { echo "$ORG_DIR/peerOrganizations/org$1.example.com/peers/peer0.org$1.example.com/tls/ca.crt"; }

set_org() { # set_org <1|2|3> [admin|user]
  local n=$1 who="${2:-admin}" ident
  [ "$who" = "admin" ] && ident="Admin@org$n.example.com" || ident="User1@org$n.example.com"
  export FABRIC_CFG_PATH="$FABRIC_SAMPLES_DIR/config"
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID="Org${n}MSP"
  export CORE_PEER_TLS_ROOTCERT_FILE="$(peer_tls_ca "$n")"
  export CORE_PEER_MSPCONFIGPATH="$ORG_DIR/peerOrganizations/org$n.example.com/users/$ident/msp"
  export CORE_PEER_ADDRESS="localhost:${PEER_PORTS[$n]}"
}

orderer_flags() {
  echo "-o localhost:7050 --ordererTLSHostnameOverride orderer1.example.com --tls --cafile $ORDERER_CA"
}

# ----------------------------------------------------------------------------- matériel cryptographique et bloc de genèse du canal
generate_crypto() {
  log "Génération du matériel cryptographique (cryptogen) : Org1, Org2, Org3, orderers"
  rm -rf "$ORG_DIR/peerOrganizations" "$ORG_DIR/ordererOrganizations"
  cryptogen generate --config="$BC_DIR/config/crypto-config.yaml" --output="$ORG_DIR"
  ok "certificats X.509 / MSP / TLS générés dans blockchain/organizations"
}

generate_channel_block() {
  log "Création du bloc de genèse du canal '$CHANNEL_NAME' (Raft, 3 consentants)"
  mkdir -p "$ART_DIR"
  FABRIC_CFG_PATH="$BC_DIR/config" configtxgen -profile DiplomaChannel \
    -outputBlock "$BLOCK" -channelID "$CHANNEL_NAME"
  ok "$BLOCK"
}

# ----------------------------------------------------------------------------- démarrage / arrêt
cmd_up() {
  check_prereqs
  [ -d "$ORG_DIR/peerOrganizations" ] || generate_crypto
  [ -f "$BLOCK" ] || generate_channel_block
  log "Démarrage des conteneurs (3 orderers, 3 peers, 3 CouchDB)"
  "${COMPOSE[@]}" up -d
  sleep 5
  "${COMPOSE[@]}" ps
  ok "réseau démarré"
}

cmd_stop() { log "Arrêt (les données sont conservées)"; "${COMPOSE[@]}" stop; }
cmd_start() { log "Redémarrage"; "${COMPOSE[@]}" start; }

cmd_down() {
  log "Arrêt et suppression du réseau (volumes, certificats, canal, conteneurs de chaincode)"
  "${COMPOSE[@]}" down -v --remove-orphans || true
  docker ps -aq --filter "name=dev-peer" | xargs -r docker rm -f >/dev/null 2>&1 || true
  docker images -q "dev-peer*" | xargs -r docker rmi -f >/dev/null 2>&1 || true
  rm -rf "$ORG_DIR/peerOrganizations" "$ORG_DIR/ordererOrganizations" "$ART_DIR"/*
  rm -rf "$CC_DIR/vendor"
  ok "réseau supprimé"
}

# ----------------------------------------------------------------------------- canal
osnadmin_flags() { # osnadmin_flags <n° orderer>
  local i=$1 tls="$ORG_DIR/ordererOrganizations/example.com/orderers/orderer$1.example.com/tls"
  echo "-o localhost:${ORDERER_ADMIN_PORTS[$i]} --ca-file $ORDERER_CA --client-cert $tls/server.crt --client-key $tls/server.key"
}

join_orderers() {
  local i
  for i in 1 2 3; do
    # shellcheck disable=SC2046
    retry 6 4 osnadmin channel join --channelID "$CHANNEL_NAME" --config-block "$BLOCK" $(osnadmin_flags "$i") >/dev/null \
      || die "orderer$i n'a pas pu rejoindre le canal"
    ok "orderer$i.example.com a rejoint $CHANNEL_NAME"
  done
}

join_peers() {
  local n
  for n in 1 2 3; do
    set_org "$n"
    if peer channel list 2>/dev/null | grep -qx "$CHANNEL_NAME"; then
      ok "peer0.org$n.example.com est déjà membre de $CHANNEL_NAME"; continue
    fi
    retry 8 5 peer channel join -b "$BLOCK" >/dev/null 2>&1 \
      || { peer channel join -b "$BLOCK" || true; die "peer0.org$n n'a pas pu rejoindre le canal"; }
    ok "peer0.org$n.example.com a rejoint $CHANNEL_NAME"
  done
}

cmd_channel() {
  check_prereqs
  [ -f "$BLOCK" ] || generate_channel_block
  log "Les 3 orderers rejoignent le canal (API de participation aux canaux)"
  join_orderers
  log "Attente de l'élection du leader Raft..."
  sleep 6
  log "Les 3 peers rejoignent le canal"
  join_peers
  log "Contrôle"
  # shellcheck disable=SC2046
  osnadmin channel list $(osnadmin_flags 1) || true
  set_org 1; peer channel list || true
}

# ----------------------------------------------------------------------------- chaincode
prepare_chaincode() {
  log "Préparation des dépendances Go du chaincode (go mod tidy + vendor)"
  command -v go >/dev/null || die "Go introuvable (nécessaire pour vendoriser les dépendances du chaincode)"
  ( cd "$CC_DIR" && GOTOOLCHAIN=local go mod tidy -go=1.21 && GOTOOLCHAIN=local go mod vendor )
  ok "dépendances prêtes"
}

endorsement_policy() { tr -d '\n' < "$POLICY_FILE"; }

cmd_deploy() {
  check_prereqs
  [ -f "$POLICY_FILE" ] || die "politique d'endossement introuvable : $POLICY_FILE"
  local policy; policy="$(endorsement_policy)"
  prepare_chaincode

  log "Package du chaincode ${CC_NAME} v${CC_VERSION}"
  set_org 1
  peer lifecycle chaincode package "$CC_PKG" --path "$CC_DIR" --lang golang --label "${CC_NAME}_${CC_VERSION}"
  local pkg_id; pkg_id="$(peer lifecycle chaincode calculatepackageid "$CC_PKG")"
  ok "package $pkg_id"

  local n out
  log "Installation sur les 3 peers (la compilation dans Docker peut durer plusieurs minutes)"
  for n in 1 2 3; do
    set_org "$n"
    if out="$(peer lifecycle chaincode install "$CC_PKG" 2>&1)"; then
      ok "installé sur peer0.org$n"
    elif grep -q "already successfully installed" <<<"$out"; then
      ok "déjà installé sur peer0.org$n"
    else
      echo "$out" >&2; die "échec de l'installation sur peer0.org$n"
    fi
  done

  log "Approbation par les 3 organisations (politique d'endossement : $policy)"
  for n in 1 2 3; do
    set_org "$n"
    # shellcheck disable=SC2046
    peer lifecycle chaincode approveformyorg $(orderer_flags) --channelID "$CHANNEL_NAME" \
      --name "$CC_NAME" --version "$CC_VERSION" --package-id "$pkg_id" --sequence "$CC_SEQUENCE" \
      --signature-policy "$policy"
    ok "Org$n a approuvé"
  done

  log "Validation de la définition du chaincode"
  set_org 1
  peer lifecycle chaincode checkcommitreadiness --channelID "$CHANNEL_NAME" --name "$CC_NAME" \
    --version "$CC_VERSION" --sequence "$CC_SEQUENCE" --signature-policy "$policy" --output json

  log "Commit sur le canal"
  # shellcheck disable=SC2046
  peer lifecycle chaincode commit $(orderer_flags) --channelID "$CHANNEL_NAME" \
    --name "$CC_NAME" --version "$CC_VERSION" --sequence "$CC_SEQUENCE" --signature-policy "$policy" \
    --peerAddresses localhost:7051 --tlsRootCertFiles "$(peer_tls_ca 1)" \
    --peerAddresses localhost:9051 --tlsRootCertFiles "$(peer_tls_ca 2)" \
    --peerAddresses localhost:11051 --tlsRootCertFiles "$(peer_tls_ca 3)"
  sleep 3
  peer lifecycle chaincode querycommitted --channelID "$CHANNEL_NAME" --name "$CC_NAME"
  ok "chaincode ${CC_NAME} v${CC_VERSION} (séquence ${CC_SEQUENCE}) déployé"
}

# ----------------------------------------------------------------------------- test de bout en bout
invoke_as() { # invoke_as <org> <fonction> <args JSON>
  local n=$1 fn=$2 args=$3
  set_org "$n"
  # shellcheck disable=SC2046
  peer chaincode invoke $(orderer_flags) -C "$CHANNEL_NAME" -n "$CC_NAME" \
    --peerAddresses "localhost:${PEER_PORTS[$n]}" --tlsRootCertFiles "$(peer_tls_ca "$n")" \
    --waitForEvent -c "{\"function\":\"$fn\",\"Args\":$args}"
}

query_as() { # query_as <org> <fonction> <args JSON>
  set_org "$1"
  peer chaincode query -C "$CHANNEL_NAME" -n "$CC_NAME" -c "{\"function\":\"$2\",\"Args\":$3}"
}

cmd_test() {
  log "Test de bout en bout du chaincode ${CC_NAME}"
  local id hash ref
  id="$(cat /proc/sys/kernel/random/uuid)"
  hash="$(printf 'pdf-%s' "$id" | sha256sum | cut -d' ' -f1)"
  ref="$(printf 'etudiant-test' | sha256sum | cut -d' ' -f1)"

  echo "1) Émission par l'Université (Org1)"
  invoke_as 1 CreateDiploma "[\"$id\",\"$ref\",\"Université Mohammed V de Rabat\",\"Master\",\"SNIA\",\"2026-07-15\",\"$hash\",\"diplomas/$id.pdf.enc\",\"test-script\"]"
  echo "2) Lecture par le recruteur (Org3, lecture seule)"
  query_as 3 ReadDiploma "[\"$id\"]"
  echo "3) Recherche par empreinte (Org3)"
  query_as 3 GetDiplomaByHash "[\"$hash\"]"
  echo "4) Liste des diplômes de l'étudiant (Org1, requête riche CouchDB)"
  query_as 1 GetDiplomasByStudent "[\"$ref\"]"
  echo "5) L'écriture par le recruteur (Org3) doit être REFUSÉE"
  if invoke_as 3 CreateDiploma "[\"$(cat /proc/sys/kernel/random/uuid)\",\"$ref\",\"X\",\"X\",\"\",\"2026-07-15\",\"$(printf 'x' | sha256sum | cut -d' ' -f1)\",\"x\",\"t\"]" >/dev/null 2>&1; then
    die "ÉCHEC : Org3 a pu écrire dans le registre"
  else
    ok "écriture par Org3 refusée (access denied)"
  fi
  echo "6) Révocation par le Ministère (Org2)"
  invoke_as 2 RevokeDiploma "[\"$id\",\"Diplôme de test révoqué\",\"test-script\"]"
  query_as 3 ReadDiploma "[\"$id\"]"
  echo "7) Historique des transactions (Org2)"
  query_as 2 GetDiplomaHistory "[\"$id\"]"
  ok "tous les tests sont passés"
}

# ----------------------------------------------------------------------------- connexion avec le backend NestJS
set_env_var() { # set_env_var <fichier> <clé> <valeur>
  local f=$1 k=$2 v=$3
  touch "$f"
  grep -v "^${k}=" "$f" > "$f.tmp" || true
  printf '%s=%s\n' "$k" "$v" >> "$f.tmp"
  mv "$f.tmp" "$f"
}

cmd_connect_backend() {
  log "Export de l'identité Org1 (User1) vers security/certificates/org1"
  local src="$ORG_DIR/peerOrganizations/org1.example.com"
  local dst="$PROJECT_DIR/security/certificates/org1"
  [ -d "$src" ] || die "matériel cryptographique absent : lancez './network.sh up' d'abord"
  rm -rf "$dst"
  mkdir -p "$dst/users" "$dst/peers/peer0.org1.example.com"
  cp -r "$src/users/User1@org1.example.com" "$dst/users/"
  cp -r "$src/peers/peer0.org1.example.com/tls" "$dst/peers/peer0.org1.example.com/"
  chmod -R go-rwx "$dst"

  local env_file="$PROJECT_DIR/backend/diploma-api/.env"
  if [ -f "$env_file" ]; then
    log "Mise à jour de $env_file"
    set_env_var "$env_file" FABRIC_MOCK false
    set_env_var "$env_file" FABRIC_MSP_ID Org1MSP
    set_env_var "$env_file" FABRIC_CHANNEL "$CHANNEL_NAME"
    set_env_var "$env_file" FABRIC_CHAINCODE "$CC_NAME"
    set_env_var "$env_file" FABRIC_PEER_ENDPOINT localhost:7051
    set_env_var "$env_file" FABRIC_PEER_HOST_ALIAS peer0.org1.example.com
    set_env_var "$env_file" FABRIC_CERT_PATH "$dst/users/User1@org1.example.com/msp/signcerts"
    set_env_var "$env_file" FABRIC_KEY_PATH "$dst/users/User1@org1.example.com/msp/keystore"
    set_env_var "$env_file" FABRIC_TLS_CERT_PATH "$dst/peers/peer0.org1.example.com/tls/ca.crt"
    ok "backend configuré pour le réseau Fabric (FABRIC_MOCK=false)"
  else
    warn "backend/diploma-api/.env introuvable : copiez .env.example vers .env puis relancez cette commande"
  fi
  echo
  echo "Redémarrez l'API :  cd backend/diploma-api && npm run start:dev"
  echo "Contrôle         :  curl -s http://localhost:3000/health"
}

cmd_status() {
  "${COMPOSE[@]}" ps
  for i in 1 2 3; do
    echo "--- orderer$i"
    # shellcheck disable=SC2046
    osnadmin channel list $(osnadmin_flags "$i") 2>&1 | tail -n 3 || true
  done
}

cmd_logs() { "${COMPOSE[@]}" logs -f --tail=100 "${1:-}"; }

usage() {
  cat <<USAGE
Commandes :
  up               génère les certificats + le bloc du canal, démarre les conteneurs
  channel          orderers et peers rejoignent le canal '$CHANNEL_NAME'
  deploy           package / install / approve / commit du chaincode '$CC_NAME'
  test             test de bout en bout (émission, lecture, refus Org3, révocation, historique)
  connect-backend  exporte l'identité Org1 et configure backend/diploma-api/.env
  all              up + channel + deploy + test + connect-backend
  status           état des conteneurs et du canal
  stop | start     arrête / redémarre sans perdre les données
  down             supprime tout (conteneurs, volumes, certificats)
  logs [service]   journaux

Mise à jour du chaincode :  CC_VERSION=1.1 CC_SEQUENCE=2 ./network.sh deploy
USAGE
}

case "${1:-help}" in
  up)               cmd_up ;;
  channel)          cmd_channel ;;
  deploy)           cmd_deploy ;;
  test)             cmd_test ;;
  connect-backend)  cmd_connect_backend ;;
  all)              cmd_up; cmd_channel; cmd_deploy; cmd_test; cmd_connect_backend ;;
  status)           cmd_status ;;
  stop)             cmd_stop ;;
  start)            cmd_start ;;
  down)             cmd_down ;;
  logs)             shift; cmd_logs "${1:-}" ;;
  help|-h|--help)   usage ;;
  *)                usage; exit 1 ;;
esac
