-- Migration 0009: Supplier Applications Table
CREATE TABLE IF NOT EXISTS catalog.supplier_applications (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL,
    contact_name VARCHAR(100) NOT NULL,
    email VARCHAR(150) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    city VARCHAR(100) NULL,
    category VARCHAR(100) NULL,
    instagram VARCHAR(150) NULL,
    website VARCHAR(200) NULL,
    notes TEXT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    admin_notes TEXT NULL,
    ip_address VARCHAR(50) NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_supplier_applications_status ON catalog.supplier_applications(status);
CREATE INDEX IF NOT EXISTS idx_supplier_applications_created_at ON catalog.supplier_applications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_supplier_applications_email ON catalog.supplier_applications(email);

COMMENT ON TABLE catalog.supplier_applications IS 'Toptancı tedarikçi adaylarının vitrinden yaptığı başvurular';
