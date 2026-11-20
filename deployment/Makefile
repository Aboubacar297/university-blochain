# Orchestration du déploiement (voir blockchain/scripts/network.sh pour le détail de chaque étape)
NET := ../blockchain/scripts/network.sh

.PHONY: help all up channel deploy test connect-backend status stop start down

help:
	@$(NET) help

all:              ## réseau complet + chaincode + test + connexion du backend
	@$(NET) all
up:
	@$(NET) up
channel:
	@$(NET) channel
deploy:
	@$(NET) deploy
test:
	@$(NET) test
connect-backend:
	@$(NET) connect-backend
status:
	@$(NET) status
stop:
	@$(NET) stop
start:
	@$(NET) start
down:
	@$(NET) down
