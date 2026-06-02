BEGIN;

-- 1. Create catalog.blog_posts table
CREATE TABLE catalog.blog_posts (
    id uuid DEFAULT uuidv7() PRIMARY KEY,
    slug VARCHAR(150) NOT NULL UNIQUE,
    cover_image VARCHAR(255) NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. Create catalog.blog_post_translations table
CREATE TABLE catalog.blog_post_translations (
    post_id uuid REFERENCES catalog.blog_posts(id) ON DELETE CASCADE NOT NULL,
    language_code VARCHAR(10) NOT NULL,
    title VARCHAR(255) NOT NULL,
    summary TEXT NULL,
    content TEXT NOT NULL,
    meta_title VARCHAR(255) NULL,
    meta_description TEXT NULL,
    PRIMARY KEY (post_id, language_code)
);

CREATE INDEX idx_blog_post_translations_lang ON catalog.blog_post_translations(language_code);
CREATE INDEX idx_blog_posts_is_active ON catalog.blog_posts(is_active);

COMMIT;
