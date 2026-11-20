package contract

// Diploma est l'enregistrement stocké dans le World State (CouchDB).
// Aucune donnée personnelle en clair : l'étudiant est désigné par une référence pseudonymisée (HMAC-SHA256)
// et seul le hachage SHA-256 du PDF est inscrit (le fichier chiffré reste hors chaîne, dans le stockage S3).
type Diploma struct {
	DocType       string `json:"docType"`
	SchemaVersion int    `json:"schemaVersion"`
	DiplomaID     string `json:"diplomaId"`
	StudentRef    string `json:"studentRef"`
	Institution   string `json:"institution"`
	Degree        string `json:"degree"`
	Major         string `json:"major"`
	IssueDate     string `json:"issueDate"`
	DocumentHash  string `json:"documentHash"`
	StorageRef    string `json:"storageRef"`
	Status        string `json:"status"`
	IssuerMSP     string `json:"issuerMsp"`
	CreatedBy     string `json:"createdBy"`
	CreatedAt     string `json:"createdAt"`
	TxID          string `json:"txId"`
	RevokedAt     string `json:"revokedAt,omitempty"`
	RevokedBy     string `json:"revokedBy,omitempty"`
	RevokedByMSP  string `json:"revokedByMsp,omitempty"`
	RevokeReason  string `json:"revokeReason,omitempty"`
	RevokeTxID    string `json:"revokeTxId,omitempty"`
}

// HistoryEntry : une modification du diplôme dans le ledger (traçabilité).
type HistoryEntry struct {
	TxID      string   `json:"txId"`
	Timestamp string   `json:"timestamp"`
	IsDelete  bool     `json:"isDelete"`
	Value     *Diploma `json:"value"`
}

// DiplomaPage : résultat paginé (scalabilité des listes).
type DiplomaPage struct {
	Records  []*Diploma `json:"records"`
	Bookmark string     `json:"bookmark"`
	Count    int        `json:"count"`
}

// TxProof : preuve qu'une transaction du registre (émission ou révocation) existe et à quel diplôme elle se rapporte.
// Utilisée pour la vérification instantanée par identifiant de transaction (recruteur, QR code).
type TxProof struct {
	TxID      string   `json:"txId"`
	Type      string   `json:"type"` // ISSUED ou REVOKED
	Timestamp string   `json:"timestamp"`
	Diploma   *Diploma `json:"diploma"`
}

type txIndexEntry struct {
	DiplomaID string `json:"diplomaId"`
	Type      string `json:"type"`
	Timestamp string `json:"timestamp"`
}
