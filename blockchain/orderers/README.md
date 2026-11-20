# orderers/

Les 3 orderers Raft (`orderer1/2/3.example.com`) sont décrits dans `../docker/docker-compose.yaml`
et leur matériel cryptographique est généré dans `../organizations/ordererOrganizations/`.
Les consentants Raft sont déclarés dans `../config/configtx.yaml` (profil `DiplomaChannel`).

Ajouter un orderer (évolution) : générer son identité (cryptogen / Fabric CA), l'ajouter au compose,
mettre à jour la configuration du canal (ajout du consentant) puis le faire rejoindre via `osnadmin channel join`.
