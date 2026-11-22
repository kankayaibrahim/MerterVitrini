package tsa

import (
	"crypto/sha256"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/hex"
	"math/big"
	"testing"
	"time"
)

func TestComputeMerkleRootAndInclusionProof(t *testing.T) {
	sizes := []int{1, 2, 3, 5, 8}
	for _, n := range sizes {
		leaves := make([]string, n)
		for i := 0; i < n; i++ {
			sum := sha256.Sum256([]byte{byte(n), byte(i)})
			leaves[i] = hex.EncodeToString(sum[:])
		}

		root, err := ComputeMerkleRoot(leaves)
		if err != nil {
			t.Fatalf("size %d ComputeMerkleRoot error: %v", n, err)
		}

		for idx, leaf := range leaves {
			proof, err := BuildMerkleInclusionProof(leaves, idx)
			if err != nil {
				t.Fatalf("size %d idx %d proof error: %v", n, idx, err)
			}
			if !VerifyMerkleInclusionProof(leaf, proof, root) {
				t.Fatalf("size %d idx %d failed valid proof verification", n, idx)
			}
			if VerifyMerkleInclusionProof(hex.EncodeToString(make([]byte, 32)), proof, root) && leaf != hex.EncodeToString(make([]byte, 32)) {
				t.Fatalf("size %d idx %d accepted tampered leaf", n, idx)
			}
		}
	}

	if _, err := ComputeMerkleRoot(nil); err == nil {
		t.Fatalf("expected error on empty Merkle leaves")
	}
}

func TestBuildAndParseRFC3161Roundtrip(t *testing.T) {
	digest := sha256.Sum256([]byte("mertervitrini-consent-anchor-v1"))
	reqDER, nonce, err := BuildTimeStampRequest(digest[:])
	if err != nil {
		t.Fatalf("BuildTimeStampRequest failed: %v", err)
	}
	if len(reqDER) < 32 || nonce == nil {
		t.Fatalf("unexpected TimeStampReq output: len=%d nonce=%v", len(reqDER), nonce)
	}

	// Construct a synthetic TimeStampResp matching RFC 3161 DER structure to test ParseAndVerifyTimeStampResponse
	tst := tstInfoASN1{
		Version: 1,
		Policy:  asn1.ObjectIdentifier{1, 2, 3, 4},
		MessageImprint: messageImprintASN1{
			HashAlgorithm: pkix.AlgorithmIdentifier{Algorithm: oidSHA256, Parameters: asn1.NullRawValue},
			HashedMessage: digest[:],
		},
		SerialNumber: big.NewInt(987654321),
		GenTime:      time.Date(2026, 11, 22, 0, 15, 0, 0, time.UTC),
		Nonce:        nonce,
	}
	tstDER, err := asn1.Marshal(tst)
	if err != nil {
		t.Fatalf("marshal tstInfo failed: %v", err)
	}

	sd := signedDataASN1{
		Version:          3,
		DigestAlgorithms: []pkix.AlgorithmIdentifier{{Algorithm: oidSHA256}},
		EncapContentInfo: encapContentInfoASN1{
			EContentType: oidTSTInfo,
			EContent:     tstDER,
		},
		SignerInfos: asn1.RawValue{Class: asn1.ClassUniversal, Tag: asn1.TagSet, IsCompound: true, Bytes: nil},
	}
	sdDER, err := asn1.Marshal(sd)
	if err != nil {
		t.Fatalf("marshal signedData failed: %v", err)
	}

	ci := contentInfoASN1{
		ContentType: oidCMSSignedData,
		Content:     asn1.RawValue{Class: asn1.ClassContextSpecific, Tag: 0, IsCompound: true, Bytes: sdDER},
	}
	ciDER, err := asn1.Marshal(ci)
	if err != nil {
		t.Fatalf("marshal contentInfo failed: %v", err)
	}

	resp := timeStampRespASN1{
		Status:         pkiStatusInfoASN1{Status: 0},
		TimeStampToken: asn1.RawValue{FullBytes: ciDER},
	}
	respDER, err := asn1.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal timeStampResp failed: %v", err)
	}

	receipt, err := ParseAndVerifyTimeStampResponse(respDER, digest[:], nonce)
	if err != nil {
		t.Fatalf("ParseAndVerifyTimeStampResponse failed on valid token: %v", err)
	}
	if receipt.Status != 0 || receipt.PolicyOID != "1.2.3.4" || receipt.SerialHex == "" {
		t.Fatalf("unexpected parsed TSA receipt: %+v", receipt)
	}

	wrongDigest := sha256.Sum256([]byte("tampered"))
	if _, err := ParseAndVerifyTimeStampResponse(respDER, wrongDigest[:], nonce); err == nil {
		t.Fatalf("expected digest mismatch error when verifying tampered imprint")
	}
}
