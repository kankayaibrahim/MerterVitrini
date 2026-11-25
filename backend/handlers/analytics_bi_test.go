package handlers

import (
	"strings"
	"testing"
)

func TestBIBotTopCrawledPathsSQLHasSingleWithClause(t *testing.T) {
	trimmed := strings.TrimSpace(biBotTopCrawledPathsSQL)
	if !strings.HasPrefix(trimmed, "WITH hourly_bounds AS (") {
		t.Fatalf("expected query to start with 'WITH hourly_bounds AS (', got:\n%s", trimmed[:min(120, len(trimmed))])
	}
	if !strings.Contains(trimmed, ",\n\tranked_path_bots AS (") {
		t.Fatalf("expected comma-joined CTE ', ranked_path_bots AS (' in query:\n%s", trimmed)
	}
	withCount := strings.Count(strings.ToUpper(trimmed), "WITH ")
	if withCount != 1 {
		t.Fatalf("expected exactly 1 'WITH ' clause in biBotTopCrawledPathsSQL, found %d:\n%s", withCount, trimmed)
	}
}
