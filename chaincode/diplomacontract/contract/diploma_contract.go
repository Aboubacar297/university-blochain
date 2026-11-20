// Package contract implémente le smart contract du registre de diplômes.
package contract

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperledger/fabric-contract-api-go/v2/contractapi"
)

const (
	docType       = "diploma"
	schemaVersion = 1

	StatusValid   = "VALID"
	StatusRevoked = "REVOKED"

	keyPrefix    = "diploma:"
	keyRangeEnd  = "diploma;" // ';' suit ':' dans l'ordre ASCII : borne supérieure de la plage de clés
	hashIndexKey = "docHash~diplomaId"
	txIndexKey   = "tx~diplomaId"

	// MaxListResults borne les listes non paginées ; utiliser GetDiplomasPage au-delà.
	MaxListResults = 1000

	EventIssued  = "DiplomaIssued"
	EventRevoked = "DiplomaRevoked"
)

// DiplomaContract : émission, vérification et révocation de diplômes.
type DiplomaContract struct {
	contractapi.Contract
}

func diplomaKey(id string) string { return keyPrefix + id }

// txTime renvoie l'horodatage de la transaction (déterministe entre les peers endosseurs).
func txTime(ctx contractapi.TransactionContextInterface) (string, error) {
	ts, err := ctx.GetStub().GetTxTimestamp()
	if err != nil {
		return "", fmt.Errorf("unable to read transaction timestamp: %v", err)
	}
	return ts.AsTime().UTC().Format(time.RFC3339), nil
}

func decodeDiploma(raw []byte) (*Diploma, error) {
	var d Diploma
	if err := json.Unmarshal(raw, &d); err != nil {
		return nil, fmt.Errorf("corrupted ledger record: %v", err)
	}
	return &d, nil
}

func (c *DiplomaContract) readState(ctx contractapi.TransactionContextInterface, id string) (*Diploma, error) {
	raw, err := ctx.GetStub().GetState(diplomaKey(id))
	if err != nil {
		return nil, fmt.Errorf("failed to read the world state: %v", err)
	}
	if raw == nil {
		return nil, fmt.Errorf("the diploma %s does not exist", id)
	}
	return decodeDiploma(raw)
}

func (c *DiplomaContract) writeState(ctx contractapi.TransactionContextInterface, d *Diploma) error {
	raw, err := json.Marshal(d)
	if err != nil {
		return fmt.Errorf("failed to encode the diploma: %v", err)
	}
	return ctx.GetStub().PutState(diplomaKey(d.DiplomaID), raw)
}

// CreateDiploma inscrit un nouveau diplôme (réservé à l'Université / Org1).
// Arguments : voir backend/diploma-api (DiplomasService.create).
func (c *DiplomaContract) CreateDiploma(
	ctx contractapi.TransactionContextInterface,
	diplomaID string, studentRef string, institution string, degree string, major string,
	issueDate string, documentHash string, storageRef string, requestedBy string,
) (*Diploma, error) {
	msp, err := authorize(ctx, "CreateDiploma")
	if err != nil {
		return nil, err
	}

	if err := validateID(diplomaID); err != nil {
		return nil, err
	}
	if err := validateHash("studentRef", studentRef); err != nil {
		return nil, err
	}
	if err := validateHash("documentHash", documentHash); err != nil {
		return nil, err
	}
	if err := validateText("institution", institution, 1, 200); err != nil {
		return nil, err
	}
	if err := validateText("degree", degree, 1, 200); err != nil {
		return nil, err
	}
	if err := validateText("major", major, 0, 200); err != nil {
		return nil, err
	}
	if err := validateText("storageRef", storageRef, 1, 256); err != nil {
		return nil, err
	}
	if err := validateText("requestedBy", requestedBy, 0, 128); err != nil {
		return nil, err
	}
	if err := validateIssueDate(issueDate); err != nil {
		return nil, err
	}

	stub := ctx.GetStub()

	existing, err := stub.GetState(diplomaKey(diplomaID))
	if err != nil {
		return nil, fmt.Errorf("failed to read the world state: %v", err)
	}
	if existing != nil {
		return nil, fmt.Errorf("the diploma %s already exists", diplomaID)
	}

	// Index d'unicité sur l'empreinte du document : un même PDF ne peut pas être émis deux fois.
	hashKey, err := stub.CreateCompositeKey(hashIndexKey, []string{documentHash})
	if err != nil {
		return nil, fmt.Errorf("failed to build the hash index key: %v", err)
	}
	prev, err := stub.GetState(hashKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read the hash index: %v", err)
	}
	if prev != nil {
		return nil, fmt.Errorf("a diploma with the same document hash already exists (%s)", string(prev))
	}

	now, err := txTime(ctx)
	if err != nil {
		return nil, err
	}

	d := &Diploma{
		DocType:       docType,
		SchemaVersion: schemaVersion,
		DiplomaID:     diplomaID,
		StudentRef:    studentRef,
		Institution:   institution,
		Degree:        degree,
		Major:         major,
		IssueDate:     issueDate,
		DocumentHash:  documentHash,
		StorageRef:    storageRef,
		Status:        StatusValid,
		IssuerMSP:     msp,
		CreatedBy:     requestedBy,
		CreatedAt:     now,
		TxID:          stub.GetTxID(),
	}
	if err := c.writeState(ctx, d); err != nil {
		return nil, err
	}
	if err := stub.PutState(hashKey, []byte(diplomaID)); err != nil {
		return nil, fmt.Errorf("failed to write the hash index: %v", err)
	}
	if err := putTxIndex(ctx, d.TxID, diplomaID, "ISSUED", now); err != nil {
		return nil, err
	}

	event, _ := json.Marshal(map[string]string{"diplomaId": diplomaID, "issuerMsp": msp, "createdAt": now})
	if err := stub.SetEvent(EventIssued, event); err != nil {
		return nil, fmt.Errorf("failed to emit event: %v", err)
	}
	return d, nil
}

// ReadDiploma renvoie un diplôme par son identifiant.
func (c *DiplomaContract) ReadDiploma(ctx contractapi.TransactionContextInterface, diplomaID string) (*Diploma, error) {
	if _, err := authorize(ctx, "ReadDiploma"); err != nil {
		return nil, err
	}
	if err := validateID(diplomaID); err != nil {
		return nil, err
	}
	return c.readState(ctx, diplomaID)
}

// GetDiplomaByHash retrouve un diplôme à partir de l'empreinte SHA-256 de son PDF (vérification sans identifiant).
func (c *DiplomaContract) GetDiplomaByHash(ctx contractapi.TransactionContextInterface, documentHash string) (*Diploma, error) {
	if _, err := authorize(ctx, "GetDiplomaByHash"); err != nil {
		return nil, err
	}
	if err := validateHash("documentHash", documentHash); err != nil {
		return nil, err
	}
	hashKey, err := ctx.GetStub().CreateCompositeKey(hashIndexKey, []string{documentHash})
	if err != nil {
		return nil, fmt.Errorf("failed to build the hash index key: %v", err)
	}
	id, err := ctx.GetStub().GetState(hashKey)
	if err != nil {
		return nil, fmt.Errorf("failed to read the hash index: %v", err)
	}
	if id == nil {
		return nil, fmt.Errorf("no diploma matches this document hash: it does not exist")
	}
	return c.readState(ctx, string(id))
}

// RevokeDiploma révoque un diplôme (Université ou Ministère). L'opération est irréversible et tracée.
func (c *DiplomaContract) RevokeDiploma(
	ctx contractapi.TransactionContextInterface, diplomaID string, reason string, requestedBy string,
) (*Diploma, error) {
	msp, err := authorize(ctx, "RevokeDiploma")
	if err != nil {
		return nil, err
	}
	if err := validateID(diplomaID); err != nil {
		return nil, err
	}
	if err := validateText("reason", reason, 3, 500); err != nil {
		return nil, err
	}
	if err := validateText("requestedBy", requestedBy, 0, 128); err != nil {
		return nil, err
	}

	d, err := c.readState(ctx, diplomaID)
	if err != nil {
		return nil, err
	}
	if d.Status == StatusRevoked {
		return nil, fmt.Errorf("the diploma %s is already revoked", diplomaID)
	}

	now, err := txTime(ctx)
	if err != nil {
		return nil, err
	}
	d.Status = StatusRevoked
	d.RevokedAt = now
	d.RevokedBy = requestedBy
	d.RevokedByMSP = msp
	d.RevokeReason = reason
	d.RevokeTxID = ctx.GetStub().GetTxID()

	if err := c.writeState(ctx, d); err != nil {
		return nil, err
	}
	if err := putTxIndex(ctx, d.RevokeTxID, diplomaID, "REVOKED", now); err != nil {
		return nil, err
	}
	event, _ := json.Marshal(map[string]string{"diplomaId": diplomaID, "revokedByMsp": msp, "revokedAt": now})
	if err := ctx.GetStub().SetEvent(EventRevoked, event); err != nil {
		return nil, fmt.Errorf("failed to emit event: %v", err)
	}
	return d, nil
}

// GetDiplomasByStudent liste les diplômes d'un étudiant (requête riche CouchDB sur la référence pseudonymisée).
func (c *DiplomaContract) GetDiplomasByStudent(ctx contractapi.TransactionContextInterface, studentRef string) ([]*Diploma, error) {
	if _, err := authorize(ctx, "GetDiplomasByStudent"); err != nil {
		return nil, err
	}
	if err := validateHash("studentRef", studentRef); err != nil {
		return nil, err
	}

	// La requête est construite par sérialisation JSON (pas de concaténation : pas d'injection de sélecteur).
	query, err := json.Marshal(map[string]interface{}{
		"selector": map[string]interface{}{"docType": docType, "studentRef": studentRef},
		"use_index": []string{"_design/indexStudentRefDoc", "indexStudentRef"},
		"limit":     MaxListResults,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to build the query: %v", err)
	}

	iter, err := ctx.GetStub().GetQueryResult(string(query))
	if err != nil {
		return nil, fmt.Errorf("query failed: %v", err)
	}
	defer iter.Close()

	results := make([]*Diploma, 0)
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to read query results: %v", err)
		}
		d, err := decodeDiploma(kv.Value)
		if err != nil {
			return nil, err
		}
		results = append(results, d)
	}
	return results, nil
}

// GetAllDiplomas : audit (Ministère / Université), limité à MaxListResults ; utiliser GetDiplomasPage pour paginer.
func (c *DiplomaContract) GetAllDiplomas(ctx contractapi.TransactionContextInterface) ([]*Diploma, error) {
	if _, err := authorize(ctx, "GetAllDiplomas"); err != nil {
		return nil, err
	}
	iter, err := ctx.GetStub().GetStateByRange(keyPrefix, keyRangeEnd)
	if err != nil {
		return nil, fmt.Errorf("range query failed: %v", err)
	}
	defer iter.Close()

	results := make([]*Diploma, 0)
	for iter.HasNext() && len(results) < MaxListResults {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to read results: %v", err)
		}
		d, err := decodeDiploma(kv.Value)
		if err != nil {
			return nil, err
		}
		results = append(results, d)
	}
	return results, nil
}

// GetDiplomasPage : liste paginée (pageSize 1..500). Passer le bookmark renvoyé pour obtenir la page suivante.
func (c *DiplomaContract) GetDiplomasPage(ctx contractapi.TransactionContextInterface, pageSize int, bookmark string) (*DiplomaPage, error) {
	if _, err := authorize(ctx, "GetDiplomasPage"); err != nil {
		return nil, err
	}
	if pageSize < 1 || pageSize > 500 {
		return nil, fmt.Errorf("invalid argument: pageSize must be between 1 and 500")
	}
	iter, meta, err := ctx.GetStub().GetStateByRangeWithPagination(keyPrefix, keyRangeEnd, int32(pageSize), bookmark)
	if err != nil {
		return nil, fmt.Errorf("paginated query failed: %v", err)
	}
	defer iter.Close()

	page := &DiplomaPage{Records: make([]*Diploma, 0)}
	for iter.HasNext() {
		kv, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to read results: %v", err)
		}
		d, err := decodeDiploma(kv.Value)
		if err != nil {
			return nil, err
		}
		page.Records = append(page.Records, d)
	}
	page.Count = len(page.Records)
	if meta != nil {
		page.Bookmark = meta.Bookmark
	}
	return page, nil
}

// GetDiplomaHistory renvoie l'historique complet des transactions d'un diplôme (traçabilité).
func (c *DiplomaContract) GetDiplomaHistory(ctx contractapi.TransactionContextInterface, diplomaID string) ([]*HistoryEntry, error) {
	if _, err := authorize(ctx, "GetDiplomaHistory"); err != nil {
		return nil, err
	}
	if err := validateID(diplomaID); err != nil {
		return nil, err
	}
	iter, err := ctx.GetStub().GetHistoryForKey(diplomaKey(diplomaID))
	if err != nil {
		return nil, fmt.Errorf("history query failed: %v", err)
	}
	defer iter.Close()

	entries := make([]*HistoryEntry, 0)
	for iter.HasNext() {
		mod, err := iter.Next()
		if err != nil {
			return nil, fmt.Errorf("failed to read history: %v", err)
		}
		entry := &HistoryEntry{
			TxID:      mod.TxId,
			Timestamp: mod.Timestamp.AsTime().UTC().Format(time.RFC3339),
			IsDelete:  mod.IsDelete,
		}
		if !mod.IsDelete && len(mod.Value) > 0 {
			d, err := decodeDiploma(mod.Value)
			if err != nil {
				return nil, err
			}
			entry.Value = d
		}
		entries = append(entries, entry)
	}
	if len(entries) == 0 {
		return nil, fmt.Errorf("the diploma %s does not exist", diplomaID)
	}
	return entries, nil
}

// putTxIndex enregistre l'association identifiant de transaction -> diplôme (émission ou révocation).
func putTxIndex(ctx contractapi.TransactionContextInterface, txID string, diplomaID string, kind string, at string) error {
	key, err := ctx.GetStub().CreateCompositeKey(txIndexKey, []string{txID})
	if err != nil {
		return fmt.Errorf("failed to build the transaction index key: %v", err)
	}
	raw, err := json.Marshal(txIndexEntry{DiplomaID: diplomaID, Type: kind, Timestamp: at})
	if err != nil {
		return fmt.Errorf("failed to encode the transaction index: %v", err)
	}
	if err := ctx.GetStub().PutState(key, raw); err != nil {
		return fmt.Errorf("failed to write the transaction index: %v", err)
	}
	return nil
}

// GetDiplomaByTx : vérification instantanée à partir d'un identifiant de transaction (QR code, recruteur).
func (c *DiplomaContract) GetDiplomaByTx(ctx contractapi.TransactionContextInterface, txID string) (*TxProof, error) {
	if _, err := authorize(ctx, "GetDiplomaByTx"); err != nil {
		return nil, err
	}
	if err := validateTxID(txID); err != nil {
		return nil, err
	}
	key, err := ctx.GetStub().CreateCompositeKey(txIndexKey, []string{txID})
	if err != nil {
		return nil, fmt.Errorf("failed to build the transaction index key: %v", err)
	}
	raw, err := ctx.GetStub().GetState(key)
	if err != nil {
		return nil, fmt.Errorf("failed to read the transaction index: %v", err)
	}
	if raw == nil {
		return nil, fmt.Errorf("the transaction %s does not exist in the registry", txID)
	}
	var entry txIndexEntry
	if err := json.Unmarshal(raw, &entry); err != nil {
		return nil, fmt.Errorf("corrupted transaction index: %v", err)
	}
	d, err := c.readState(ctx, entry.DiplomaID)
	if err != nil {
		return nil, err
	}
	return &TxProof{TxID: txID, Type: entry.Type, Timestamp: entry.Timestamp, Diploma: d}, nil
}
