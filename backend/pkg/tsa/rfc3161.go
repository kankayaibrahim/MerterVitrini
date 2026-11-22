package tsa

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"time"
)

var (
	oidSHA256          = asn1.ObjectIdentifier{2, 16, 840, 1, 101, 3, 4, 2, 1}
	oidCMSSignedData   = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 7, 2}
	oidTSTInfo         = asn1.ObjectIdentifier{1, 2, 840, 113549, 1, 9, 16, 1, 4}
	errEmptyMerkleTree = errors.New("cannot build merkle root from empty leaves")
)

// TSAEndpoint describes an RFC 3161 Time Stamping Authority endpoint.
type TSAEndpoint struct {
	Name string `json:"name"`
	URL  string `json:"url"`
}

// MerkleProofStep represents one sibling hash node on the path from leaf to Merkle root.
type MerkleProofStep struct {
	Position string `json:"position"` // "left" or "right"
	Hash     string `json:"hash"`
}

// TSAReceipt holds parsed RFC 3161 response fields ready for audit storage and verification.
type TSAReceipt struct {
	Provider          string    `json:"provider"`
	URL               string    `json:"url"`
	Status            int       `json:"status"`
	StatusLabel       string    `json:"status_label"`
	GenTimeUTC        time.Time `json:"gen_time_utc"`
	SerialHex         string    `json:"serial_hex"`
	PolicyOID         string    `json:"policy_oid"`
	MessageImprintHex string    `json:"message_imprint_hex"`
	TokenBase64       string    `json:"token_base64"`
}

type messageImprintASN1 struct {
	HashAlgorithm pkix.AlgorithmIdentifier
	HashedMessage []byte
}

type timeStampReqASN1 struct {
	Version        int
	MessageImprint messageImprintASN1
	ReqPolicy      asn1.ObjectIdentifier `asn1:"optional"`
	Nonce          *big.Int              `asn1:"optional"`
	CertReq        bool                  `asn1:"optional,default:false"`
}

type pkiStatusInfoASN1 struct {
	Status       int
	StatusString []asn1.RawValue `asn1:"optional"`
	FailInfo     asn1.BitString  `asn1:"optional"`
}

type timeStampRespASN1 struct {
	Status         pkiStatusInfoASN1
	TimeStampToken asn1.RawValue `asn1:"optional"`
}

type contentInfoASN1 struct {
	ContentType asn1.ObjectIdentifier
	Content     asn1.RawValue `asn1:"tag:0,explicit,optional"`
}

type encapContentInfoASN1 struct {
	EContentType asn1.ObjectIdentifier
	EContent     []byte `asn1:"tag:0,explicit,optional"`
}

type signedDataASN1 struct {
	Version          int
	DigestAlgorithms []pkix.AlgorithmIdentifier `asn1:"set"`
	EncapContentInfo encapContentInfoASN1
	Certificates     asn1.RawValue `asn1:"optional,tag:0"`
	CRLs             asn1.RawValue `asn1:"optional,tag:1"`
	SignerInfos      asn1.RawValue `asn1:"set"`
}

type tstInfoASN1 struct {
	Version        int
	Policy         asn1.ObjectIdentifier
	MessageImprint messageImprintASN1
	SerialNumber   *big.Int
	GenTime        time.Time        `asn1:"generalized"`
	Accuracy       asn1.RawValue    `asn1:"optional"`
	Ordering       bool             `asn1:"optional,default:false"`
	Nonce          *big.Int         `asn1:"optional"`
	TSA            asn1.RawValue    `asn1:"tag:0,explicit,optional"`
	Extensions     []pkix.Extension `asn1:"tag:1,optional"`
}

// DefaultFreeTSAEndpoints returns independent public RFC 3161 TSA endpoints in priority order.
func DefaultFreeTSAEndpoints(primary string, fallbacks []string) []TSAEndpoint {
	seen := make(map[string]struct{}, 4)
	add := func(list []TSAEndpoint, rawURL string) []TSAEndpoint {
		trimmed := strings.TrimSpace(rawURL)
		if trimmed == "" {
			return list
		}
		key := strings.ToLower(trimmed)
		if _, ok := seen[key]; ok {
			return list
		}
		seen[key] = struct{}{}
		return append(list, TSAEndpoint{
			Name: inferTSAProviderName(trimmed),
			URL:  trimmed,
		})
	}

	var out []TSAEndpoint
	out = add(out, primary)
	for _, fb := range fallbacks {
		out = add(out, fb)
	}
	if len(out) == 0 {
		out = add(out, "http://timestamp.digicert.com")
		out = add(out, "http://timestamp.sectigo.com")
		out = add(out, "https://freetsa.org/tsr")
	}
	return out
}

func inferTSAProviderName(rawURL string) string {
	lower := strings.ToLower(rawURL)
	switch {
	case strings.Contains(lower, "digicert"):
		return "DigiCert Timestamp Authority"
	case strings.Contains(lower, "sectigo"):
		return "Sectigo Public Timestamp Authority"
	case strings.Contains(lower, "freetsa"):
		return "FreeTSA"
	default:
		return "RFC 3161 TSA"
	}
}

// BuildTimeStampRequest encodes a standard RFC 3161 TimeStampReq over a 32-byte SHA-256 digest.
func BuildTimeStampRequest(hash32 []byte) ([]byte, *big.Int, error) {
	if len(hash32) != sha256.Size {
		return nil, nil, fmt.Errorf("invalid digest length: want %d, got %d", sha256.Size, len(hash32))
	}

	nonceBytes := make([]byte, 8)
	if _, err := rand.Read(nonceBytes); err != nil {
		return nil, nil, fmt.Errorf("nonce generation failed: %w", err)
	}
	nonceBytes[0] &= 0x7F // ensure positive ASN.1 integer
	nonce := new(big.Int).SetBytes(nonceBytes)

	req := timeStampReqASN1{
		Version: 1,
		MessageImprint: messageImprintASN1{
			HashAlgorithm: pkix.AlgorithmIdentifier{
				Algorithm:  oidSHA256,
				Parameters: asn1.NullRawValue,
			},
			HashedMessage: hash32,
		},
		Nonce:   nonce,
		CertReq: true,
	}

	der, err := asn1.Marshal(req)
	if err != nil {
		return nil, nil, fmt.Errorf("marshal TimeStampReq failed: %w", err)
	}
	return der, nonce, nil
}

// ParseAndVerifyTimeStampResponse validates an RFC 3161 TimeStampResp DER token against the expected SHA-256 digest and nonce.
func ParseAndVerifyTimeStampResponse(respDER []byte, expectedHash32 []byte, expectedNonce *big.Int) (*TSAReceipt, error) {
	var resp timeStampRespASN1
	if _, err := asn1.Unmarshal(respDER, &resp); err != nil {
		return nil, fmt.Errorf("unmarshal TimeStampResp failed: %w", err)
	}

	if resp.Status.Status != 0 && resp.Status.Status != 1 {
		return nil, fmt.Errorf("TSA rejected request with PKIStatus=%d", resp.Status.Status)
	}
	if len(resp.TimeStampToken.FullBytes) == 0 {
		return nil, errors.New("TSA response missing TimeStampToken")
	}

	var ci contentInfoASN1
	if _, err := asn1.Unmarshal(resp.TimeStampToken.FullBytes, &ci); err != nil {
		return nil, fmt.Errorf("unmarshal ContentInfo failed: %w", err)
	}
	if !ci.ContentType.Equal(oidCMSSignedData) {
		return nil, fmt.Errorf("unexpected CMS content type: %s", ci.ContentType.String())
	}

	var sd signedDataASN1
	if _, err := asn1.Unmarshal(ci.Content.Bytes, &sd); err != nil {
		return nil, fmt.Errorf("unmarshal SignedData failed: %w", err)
	}
	if !sd.EncapContentInfo.EContentType.Equal(oidTSTInfo) {
		return nil, fmt.Errorf("unexpected EncapContentInfo type: %s", sd.EncapContentInfo.EContentType.String())
	}

	var tst tstInfoASN1
	if _, err := asn1.Unmarshal(sd.EncapContentInfo.EContent, &tst); err != nil {
		return nil, fmt.Errorf("unmarshal TSTInfo failed: %w", err)
	}

	if len(expectedHash32) > 0 && !bytes.Equal(tst.MessageImprint.HashedMessage, expectedHash32) {
		return nil, errors.New("TSA message imprint mismatch against anchored digest")
	}
	if expectedNonce != nil && tst.Nonce != nil && tst.Nonce.Cmp(expectedNonce) != 0 {
		return nil, errors.New("TSA nonce mismatch")
	}

	serialHex := ""
	if tst.SerialNumber != nil {
		serialHex = strings.ToUpper(fmt.Sprintf("%X", tst.SerialNumber))
	}

	return &TSAReceipt{
		Status:            resp.Status.Status,
		StatusLabel:       "GRANTED",
		GenTimeUTC:        tst.GenTime.UTC(),
		SerialHex:         serialHex,
		PolicyOID:         tst.Policy.String(),
		MessageImprintHex: hex.EncodeToString(tst.MessageImprint.HashedMessage),
		TokenBase64:       base64.StdEncoding.EncodeToString(respDER),
	}, nil
}

// RequestTimestampWithFallback queries independent RFC 3161 TSA endpoints sequentially until one grants a valid timestamp.
func RequestTimestampWithFallback(ctx context.Context, hash32 []byte, endpoints []TSAEndpoint) (*TSAReceipt, error) {
	reqDER, nonce, err := BuildTimeStampRequest(hash32)
	if err != nil {
		return nil, err
	}

	var errs []string
	client := &http.Client{Timeout: 8 * time.Second}
	for _, ep := range endpoints {
		if strings.TrimSpace(ep.URL) == "" {
			continue
		}
		httpReq, reqErr := http.NewRequestWithContext(ctx, http.MethodPost, ep.URL, bytes.NewReader(reqDER))
		if reqErr != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", ep.Name, reqErr))
			continue
		}
		httpReq.Header.Set("Content-Type", "application/timestamp-query")
		httpReq.Header.Set("User-Agent", "MerterVitrini-ConsentLedger/1.0")

		resp, doErr := client.Do(httpReq)
		if doErr != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", ep.Name, doErr))
			continue
		}
		body, readErr := io.ReadAll(io.LimitReader(resp.Body, 256*1024))
		resp.Body.Close()
		if readErr != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
			errs = append(errs, fmt.Sprintf("%s: HTTP %d", ep.Name, resp.StatusCode))
			continue
		}

		parsed, verifyErr := ParseAndVerifyTimeStampResponse(body, hash32, nonce)
		if verifyErr != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", ep.Name, verifyErr))
			continue
		}
		parsed.Provider = ep.Name
		parsed.URL = ep.URL
		return parsed, nil
	}

	return nil, fmt.Errorf("all RFC 3161 TSA endpoints failed: %s", strings.Join(errs, "; "))
}

func hashHexPair(leftHex, rightHex string) string {
	sum := sha256.Sum256([]byte(strings.ToLower(leftHex) + "|" + strings.ToLower(rightHex)))
	return hex.EncodeToString(sum[:])
}

// ComputeMerkleRoot builds a deterministic SHA-256 binary Merkle root over hex-encoded entry hashes.
func ComputeMerkleRoot(hexLeaves []string) (string, error) {
	if len(hexLeaves) == 0 {
		return "", errEmptyMerkleTree
	}
	level := make([]string, len(hexLeaves))
	for i, h := range hexLeaves {
		level[i] = strings.ToLower(strings.TrimSpace(h))
	}
	for len(level) > 1 {
		next := make([]string, 0, (len(level)+1)/2)
		for i := 0; i < len(level); i += 2 {
			left := level[i]
			right := left
			if i+1 < len(level) {
				right = level[i+1]
			}
			next = append(next, hashHexPair(left, right))
		}
		level = next
	}
	return level[0], nil
}

// BuildMerkleInclusionProof computes the sibling path proving targetIdx is included in the batch Merkle root.
func BuildMerkleInclusionProof(hexLeaves []string, targetIdx int) ([]MerkleProofStep, error) {
	if len(hexLeaves) == 0 {
		return nil, errEmptyMerkleTree
	}
	if targetIdx < 0 || targetIdx >= len(hexLeaves) {
		return nil, fmt.Errorf("target index %d out of range (len=%d)", targetIdx, len(hexLeaves))
	}
	level := make([]string, len(hexLeaves))
	for i, h := range hexLeaves {
		level[i] = strings.ToLower(strings.TrimSpace(h))
	}

	var proof []MerkleProofStep
	idx := targetIdx
	for len(level) > 1 {
		siblingIdx := idx ^ 1
		pos := "right"
		if idx%2 == 1 {
			pos = "left"
		}
		siblingHash := level[idx]
		if siblingIdx < len(level) {
			siblingHash = level[siblingIdx]
		}
		proof = append(proof, MerkleProofStep{Position: pos, Hash: siblingHash})

		next := make([]string, 0, (len(level)+1)/2)
		for i := 0; i < len(level); i += 2 {
			left := level[i]
			right := left
			if i+1 < len(level) {
				right = level[i+1]
			}
			next = append(next, hashHexPair(left, right))
		}
		level = next
		idx /= 2
	}
	return proof, nil
}

// VerifyMerkleInclusionProof checks whether a leaf hash plus sibling proof reproduces expectedRoot.
func VerifyMerkleInclusionProof(leafHex string, proof []MerkleProofStep, expectedRoot string) bool {
	current := strings.ToLower(strings.TrimSpace(leafHex))
	for _, step := range proof {
		if step.Position == "left" {
			current = hashHexPair(step.Hash, current)
		} else {
			current = hashHexPair(current, step.Hash)
		}
	}
	return strings.EqualFold(current, strings.TrimSpace(expectedRoot))
}
