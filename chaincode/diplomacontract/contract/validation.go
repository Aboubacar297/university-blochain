package contract

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

var (
	uuidRe  = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	hex64Re = regexp.MustCompile(`^[0-9a-f]{64}$`)
	txIDRe  = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

func validateID(id string) error {
	if !uuidRe.MatchString(id) {
		return fmt.Errorf("invalid argument: diplomaId must be a UUID")
	}
	return nil
}

func validateHash(name, v string) error {
	if !hex64Re.MatchString(v) {
		return fmt.Errorf("invalid argument: %s must be 64 lowercase hexadecimal characters", name)
	}
	return nil
}

func validateText(name, v string, min, max int) error {
	n := len(strings.TrimSpace(v))
	if n < min || len(v) > max {
		return fmt.Errorf("invalid argument: %s must be between %d and %d characters", name, min, max)
	}
	return nil
}

// validateIssueDate accepte une date (AAAA-MM-JJ) ou un horodatage RFC 3339.
func validateIssueDate(v string) error {
	if _, err := time.Parse("2006-01-02", v); err == nil {
		return nil
	}
	if _, err := time.Parse(time.RFC3339, v); err == nil {
		return nil
	}
	return fmt.Errorf("invalid argument: issueDate must be an ISO 8601 date (YYYY-MM-DD) or timestamp")
}

func validateTxID(v string) error {
	if !txIDRe.MatchString(v) {
		return fmt.Errorf("invalid argument: txId must be 64 lowercase hexadecimal characters")
	}
	return nil
}
