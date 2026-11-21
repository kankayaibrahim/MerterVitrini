package handlers

import (
	"mertervitrini/backend/config"
	"slices"
	"testing"
)

func TestParseXMLSupplierNameIncludesBlackFashion(t *testing.T) {
	feedID, supplierName := parseXMLSupplierName("black_fashion-20261122_020000.xml")
	if feedID != "black_fashion" || supplierName != "Black Fashion" {
		t.Fatalf("expected ('black_fashion', 'Black Fashion'), got (%q, %q)", feedID, supplierName)
	}
}

func TestIsAutonomousPythonScriptConfig(t *testing.T) {
	cfg := map[string]any{
		"parser_type":   "python_script",
		"python_script": "parsers/black_fashion.py",
	}
	if !isAutonomousPythonScriptConfig(cfg) {
		t.Fatalf("expected python_script mapping_config to be recognized")
	}
	if got := resolvePythonScriptPathFromConfig(cfg); got != "parsers/black_fashion.py" {
		t.Fatalf("expected parsers/black_fashion.py, got %q", got)
	}
	if isAutonomousPythonScriptConfig(map[string]any{"parser_type": "generic_xml"}) {
		t.Fatalf("expected generic_xml not to match autonomous python_script")
	}
	if isAutonomousPythonScriptConfig(nil) {
		t.Fatalf("expected nil mapping_config to return false")
	}
}

func TestBuildPythonParserEnv(t *testing.T) {
	cfg := &config.Config{
		DBHost:     "127.0.0.1",
		DBPort:     "5432",
		DBUser:     "postgres",
		DBPassword: "secret",
		DBName:     "merterdevdb",
		RedisURL:   "redis://localhost:6379",
	}
	env := buildPythonParserEnv(
		[]string{"PATH=/usr/bin"},
		"run-123",
		"black_fashion",
		"https://panel.toserof.com/feeds/cc5b687cc5c0bee2e642697247869dad94a89800a0204207.xml",
		cfg,
	)

	required := []string{
		"SYNC_RUN_ID=run-123",
		"FEED_ID=black_fashion",
		"FEED_URL=https://panel.toserof.com/feeds/cc5b687cc5c0bee2e642697247869dad94a89800a0204207.xml",
		"REDIS_URL=redis://localhost:6379",
		"DB_NAME=merterdevdb",
	}
	for _, want := range required {
		if !slices.Contains(env, want) {
			t.Fatalf("expected env to contain %q, got %v", want, env)
		}
	}

	envNoURL := buildPythonParserEnv(nil, "run-456", "black_fashion", "   ", cfg)
	for _, entry := range envNoURL {
		if len(entry) >= 9 && entry[:9] == "FEED_URL=" {
			t.Fatalf("did not expect FEED_URL when blank, got %q", entry)
		}
	}
}
