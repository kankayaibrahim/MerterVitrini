package handlers

import (
	"fmt"
	"testing"
)

func TestBuildProductIndexNowURLs(t *testing.T) {
	slugs := []string{
		"  /erkek-triko-kazak-1a2b/ ",
		"erkek-triko-kazak-1a2b",
		"",
		"   ",
		"kadin elbise 9x8y",
	}

	urls, productCount := BuildProductIndexNowURLs(slugs)
	if productCount != 2 {
		t.Fatalf("expected 2 unique valid products, got %d", productCount)
	}

	expectedLen := 2 * 8
	if len(urls) != expectedLen {
		t.Fatalf("expected %d localized URLs, got %d", expectedLen, len(urls))
	}

	expectedFirst := "https://mertervitrini.com.tr/product/erkek-triko-kazak-1a2b"
	if urls[0] != expectedFirst {
		t.Fatalf("expected first URL %q, got %q", expectedFirst, urls[0])
	}
	expectedLast := "https://mertervitrini.com.tr/product/kadin%20elbise%209x8y?lang=bg"
	if urls[len(urls)-1] != expectedLast {
		t.Fatalf("expected last URL %q, got %q", expectedLast, urls[len(urls)-1])
	}
}

func TestNormalizeAndChunkIndexNowURLs(t *testing.T) {
	raw := []string{
		"",
		"  ",
		"/product/relative-path",
		"ftp://mertervitrini.com.tr/file.xml",
		"https://mertervitrini.com.tr/product/a",
		"  https://mertervitrini.com.tr/product/a  ",
		"http://mertervitrini.com.tr/product/b",
	}

	chunks := NormalizeAndChunkIndexNowURLs(raw, 0)
	if len(chunks) != 1 {
		t.Fatalf("expected 1 chunk, got %d", len(chunks))
	}
	if len(chunks[0]) != 2 {
		t.Fatalf("expected 2 valid deduplicated URLs, got %d (%v)", len(chunks[0]), chunks[0])
	}

	bulk := make([]string, 0, 25003)
	for i := 0; i < 25003; i++ {
		bulk = append(bulk, fmt.Sprintf("https://mertervitrini.com.tr/product/item-%d", i))
	}
	bulkChunks := NormalizeAndChunkIndexNowURLs(bulk, indexNowMaxChunkSize)
	if len(bulkChunks) != 3 {
		t.Fatalf("expected 3 chunks for 25003 URLs, got %d", len(bulkChunks))
	}
	if len(bulkChunks[0]) != 10000 || len(bulkChunks[1]) != 10000 || len(bulkChunks[2]) != 5003 {
		t.Fatalf("unexpected chunk sizes: %d, %d, %d", len(bulkChunks[0]), len(bulkChunks[1]), len(bulkChunks[2]))
	}
}
