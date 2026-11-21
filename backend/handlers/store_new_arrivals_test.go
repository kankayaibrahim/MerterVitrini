package handlers

import (
	"net/url"
	"strings"
	"testing"
)

func TestBuildCatalogFilterSQLNewDays(t *testing.T) {
	t.Run("filters last 7 days when new_days=7", func(t *testing.T) {
		q := url.Values{"new_days": {"7"}}
		sql, args, nextIdx := buildCatalogFilterSQL(q, 1.0, "p.price")
		if !strings.Contains(sql, "p.created_at >= NOW() - make_interval(days => $1)") {
			t.Fatalf("expected make_interval predicate in SQL, got: %s", sql)
		}
		if len(args) != 1 || args[0] != 7 || nextIdx != 2 {
			t.Fatalf("expected args=[7] and nextIdx=2, got args=%+v nextIdx=%d", args, nextIdx)
		}
	})

	t.Run("clamps excessive new_days to 365", func(t *testing.T) {
		q := url.Values{"new_days": {"999"}}
		_, args, _ := buildCatalogFilterSQL(q, 1.0, "p.price")
		if len(args) != 1 || args[0] != 365 {
			t.Fatalf("expected clamped arg 365, got %+v", args)
		}
	})

	t.Run("ignores non-positive or invalid new_days", func(t *testing.T) {
		for _, badVal := range []string{"0", "-5", "abc"} {
			q := url.Values{"new_days": {badVal}}
			sql, args, nextIdx := buildCatalogFilterSQL(q, 1.0, "p.price")
			if strings.Contains(sql, "make_interval") {
				t.Fatalf("did not expect make_interval for new_days=%q, got: %s", badVal, sql)
			}
			if len(args) != 0 || nextIdx != 1 {
				t.Fatalf("expected 0 args for new_days=%q, got %+v", badVal, args)
			}
		}
	})

	t.Run("virtual category_id=yeni-urunler defaults to 7 days without DB category lookup", func(t *testing.T) {
		q := url.Values{"category_id": {"yeni-urunler"}}
		sql, args, nextIdx := buildCatalogFilterSQL(q, 1.0, "p.price")
		if strings.Contains(sql, "catalog.categories") {
			t.Fatalf("expected virtual yeni-urunler to skip catalog.categories lookup, got: %s", sql)
		}
		if !strings.Contains(sql, "p.created_at >= NOW() - make_interval(days => $1)") {
			t.Fatalf("expected default 7-day filter for yeni-urunler, got: %s", sql)
		}
		if len(args) != 1 || args[0] != 7 || nextIdx != 2 {
			t.Fatalf("expected args=[7] nextIdx=2, got args=%+v nextIdx=%d", args, nextIdx)
		}
	})

	t.Run("virtual category_id=tum-urunler skips DB category lookup and does not add new_days", func(t *testing.T) {
		q := url.Values{"category_id": {"tum-urunler"}}
		sql, args, nextIdx := buildCatalogFilterSQL(q, 1.0, "p.price")
		if strings.Contains(sql, "catalog.categories") || strings.Contains(sql, "make_interval") {
			t.Fatalf("unexpected category/new_days clause for tum-urunler: %s", sql)
		}
		if len(args) != 0 || nextIdx != 1 {
			t.Fatalf("expected 0 args nextIdx=1, got args=%+v nextIdx=%d", args, nextIdx)
		}
	})

	t.Run("combined filters preserve sequential placeholders", func(t *testing.T) {
		q := url.Values{
			"brand_id": {"brand-1"},
			"new_days": {"7"},
			"gender":   {"Kadin"},
		}
		sql, args, nextIdx := buildCatalogFilterSQL(q, 1.0, "p.price")
		if len(args) != 3 || nextIdx != 4 {
			t.Fatalf("expected 3 args and nextIdx=4, got args=%+v nextIdx=%d", args, nextIdx)
		}
		if !strings.Contains(sql, "p.brand_id IN ($1)") ||
			!strings.Contains(sql, "make_interval(days => $2)") ||
			!strings.Contains(sql, "p.gender IN ($3)") {
			t.Fatalf("unexpected combined SQL: %s", sql)
		}
	})
}

func TestBuildCatalogOrderByNewestDeterministic(t *testing.T) {
	for _, sortKey := range []string{"newest", ""} {
		got := buildCatalogOrderBy(sortKey, "p.price")
		want := " ORDER BY p.created_at DESC, p.id DESC"
		if got != want {
			t.Fatalf("buildCatalogOrderBy(%q) = %q, want %q", sortKey, got, want)
		}
	}
}

func TestMapStoreAPIToPublicPathNewDays(t *testing.T) {
	if got := mapStoreAPIToPublicPath("/api/v1/store/products", url.Values{"new_days": {"7"}}); got != "/yeni-urunler" {
		t.Fatalf("expected /yeni-urunler for new_days=7, got %q", got)
	}
	if got := mapStoreAPIToPublicPath("/api/v1/store/products", url.Values{"category_id": {"yeni-urunler"}}); got != "/yeni-urunler" {
		t.Fatalf("expected /yeni-urunler for virtual category, got %q", got)
	}
	if got := mapStoreAPIToPublicPath("/api/v1/store/products", url.Values{"category_id": {"elbise"}, "new_days": {"7"}}); got != "/elbise" {
		t.Fatalf("expected /elbise when specific category_id is present, got %q", got)
	}
}
