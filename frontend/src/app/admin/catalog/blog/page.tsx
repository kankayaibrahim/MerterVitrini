"use client";

import React from "react";
import BlogManager from "@/components/admin/catalog/BlogManager";
import { useAdmin } from "@/context/AdminContext";

export default function AdminCatalogBlogPage() {
  const { apiUrl, token } = useAdmin();

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      <BlogManager apiUrl={apiUrl} token={token} />
    </div>
  );
}
