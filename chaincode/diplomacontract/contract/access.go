package contract

import (
	"fmt"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

// Organisations du consortium (MSP IDs) - voir blockchain/config/configtx.yaml.
const (
	MSPIssuer    = "Org1MSP" // Université : émission et signature
	MSPRegulator = "Org2MSP" // Ministère : audit et supervision
	MSPRecruiter = "Org3MSP" // Recruteurs : vérification en lecture seule
)

// accessPolicy : organisations autorisées pour chaque fonction du contrat.
// Pour faire évoluer la gouvernance (nouvelle organisation, nouveau rôle), il suffit de modifier cette table,
// puis de déployer une nouvelle version du chaincode (voir CC_VERSION / CC_SEQUENCE).
var accessPolicy = map[string][]string{
	"CreateDiploma":        {MSPIssuer},
	"RevokeDiploma":        {MSPIssuer, MSPRegulator},
	"ReadDiploma":          {MSPIssuer, MSPRegulator, MSPRecruiter},
	"GetDiplomaByHash":     {MSPIssuer, MSPRegulator, MSPRecruiter},
	"GetDiplomaByTx":       {MSPIssuer, MSPRegulator, MSPRecruiter},
	"GetDiplomasByStudent": {MSPIssuer, MSPRegulator},
	"GetAllDiplomas":       {MSPIssuer, MSPRegulator},
	"GetDiplomasPage":      {MSPIssuer, MSPRegulator},
	"GetDiplomaHistory":    {MSPIssuer, MSPRegulator},
}

// authorize vérifie que l'organisation de l'appelant (identité X.509 / MSP) peut exécuter la fonction.
func authorize(ctx contractapi.TransactionContextInterface, function string) (string, error) {
	msp, err := ctx.GetClientIdentity().GetMSPID()
	if err != nil {
		return "", fmt.Errorf("unable to read caller identity: %v", err)
	}
	for _, allowed := range accessPolicy[function] {
		if allowed == msp {
			return msp, nil
		}
	}
	return "", fmt.Errorf("access denied: MSP %s is not authorized to call %s", msp, function)
}
