package db

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	"mertervitrini/backend/config"
)

func writeTempCACert(t *testing.T) string {
	t.Helper()
	priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "Test Redis CA"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(24 * time.Hour),
		KeyUsage:     x509.KeyUsageCertSign | x509.KeyUsageDigitalSignature,
		IsCA:         true,
		BasicConstraintsValid: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &priv.PublicKey, priv)
	if err != nil {
		t.Fatal(err)
	}
	caPath := filepath.Join(t.TempDir(), "ca.crt")
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	if err := os.WriteFile(caPath, pemBytes, 0600); err != nil {
		t.Fatal(err)
	}
	return caPath
}

func TestBuildRedisOptions(t *testing.T) {
	opt, err := buildRedisOptions(&config.Config{})
	if err != nil || opt != nil {
		t.Fatalf("expected (nil, nil) for empty RedisURL, got (%v, %v)", opt, err)
	}

	plainOpt, err := buildRedisOptions(&config.Config{RedisURL: "redis://127.0.0.1:6379/0"})
	if err != nil || plainOpt == nil {
		t.Fatalf("expected valid options for plain redis URL, got (%v, %v)", plainOpt, err)
	}
	if plainOpt.TLSConfig != nil {
		t.Fatalf("expected nil TLSConfig for non-TLS redis URL, got %+v", plainOpt.TLSConfig)
	}

	caPath := writeTempCACert(t)
	tlsOpt, err := buildRedisOptions(&config.Config{
		RedisURL:       "rediss://:pass@127.0.0.1:6379/0",
		RedisTLSCACert: caPath,
	})
	if err != nil || tlsOpt == nil {
		t.Fatalf("expected valid TLS options, got (%v, %v)", tlsOpt, err)
	}
	if tlsOpt.TLSConfig == nil || tlsOpt.TLSConfig.RootCAs == nil {
		t.Fatalf("expected TLSConfig with custom RootCAs, got %+v", tlsOpt.TLSConfig)
	}

	missingOpt, err := buildRedisOptions(&config.Config{
		RedisURL:       "rediss://:pass@127.0.0.1:6379/0",
		RedisTLSCACert: filepath.Join(t.TempDir(), "missing.crt"),
	})
	if err == nil || missingOpt != nil {
		t.Fatalf("expected error for missing CA file, got (%v, %v)", missingOpt, err)
	}
}
