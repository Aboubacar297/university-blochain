// Chaincode "diplomacontract" : registre de diplômes (Hyperledger Fabric 2.5+).
package main

import (
	"log"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
	dc "github.com/univ-rabat/diplomacontract/contract"
)

func main() {
	chaincode, err := contractapi.NewChaincode(&dc.DiplomaContract{})
	if err != nil {
		log.Panicf("erreur de création du chaincode diplomacontract : %v", err)
	}
	if err := chaincode.Start(); err != nil {
		log.Panicf("erreur de démarrage du chaincode diplomacontract : %v", err)
	}
}
