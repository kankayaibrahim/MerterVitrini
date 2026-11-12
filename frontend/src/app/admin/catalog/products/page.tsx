"use client";

import React, { useState, useEffect } from "react";
import CatalogFilters from "@/components/admin/catalog/CatalogFilters";
import ProductGrid from "@/components/admin/catalog/ProductGrid";
import ProductDetailModal from "@/components/admin/catalog/ProductDetailModal";
import { useAdmin } from "@/context/AdminContext";
import { Product } from "@/types/integration";

export default function AdminCatalogProductsPage() {
  const {
    products,
    totalProductsCount,
    feeds,
    flatCategories,
    loadingProducts,
    loadProducts,
    fetchWithConfig
  } = useAdmin();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [offset, setOffset] = useState(0);
  const limit = 24;

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Load products when query, category, or offset changes
  useEffect(() => {
    void loadProducts(limit, offset, selectedCategory, searchQuery);
  }, [loadProducts, limit, offset, selectedCategory, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedCategory("");
    setOffset(0);
  };

  const handleViewProductById = async (productId: string) => {
    try {
      const res = await fetchWithConfig(`/api/v1/products/${productId}`);
      if (res.ok) {
        const prod = await res.json();
        setSelectedProduct(prod);
      }
    } catch (err) {
      console.error("Failed to load product detail:", err);
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Top Filter and Search Bar */}
      <CatalogFilters 
        searchQuery={searchQuery}
        setSearchQuery={(q) => {
          setSearchQuery(q);
          setOffset(0);
        }}
        selectedCategory={selectedCategory}
        setSelectedCategory={(cat) => {
          setSelectedCategory(cat);
          setOffset(0);
        }}
        flatCategories={flatCategories}
        onReset={handleResetFilters}
      />

      {/* Main Grid View */}
      <ProductGrid 
        products={products}
        totalProductsCount={totalProductsCount}
        feeds={feeds}
        loadingProducts={loadingProducts}
        limit={limit}
        offset={offset}
        setOffset={setOffset}
        onViewDetails={handleViewProductById}
      />

      {/* Detail Modal */}
      {selectedProduct && (
        <ProductDetailModal 
          product={selectedProduct}
          feeds={feeds}
          onClose={() => setSelectedProduct(null)}
          onViewProduct={handleViewProductById}
        />
      )}
    </div>
  );
}
