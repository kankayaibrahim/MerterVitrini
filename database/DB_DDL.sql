-- =========================================================================
-- MERTER VİTRİNİ MASTER DATABASE DDL SCHEMA (PostgreSQL 18.7)
-- Exported directly from live database: merterdevdb
-- Consolidates historical migrations 0005 through 0049 (preserved in git history)
-- Schemas: analytics, catalog, compliance, extensions, identity, integration
-- =========================================================================
--
-- PostgreSQL database dump
--


-- Dumped from database version 18.7
-- Dumped by pg_dump version 18.7

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: analytics; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA analytics;


--
-- Name: catalog; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA catalog;


--
-- Name: compliance; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA compliance;


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: identity; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA identity;


--
-- Name: integration; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA integration;


--
-- Name: ltree; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS ltree WITH SCHEMA extensions;


--
-- Name: EXTENSION ltree; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION ltree IS 'data type for hierarchical tree-like structures';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: policy_type; Type: TYPE; Schema: catalog; Owner: -
--

CREATE TYPE catalog.policy_type AS ENUM (
    'cancellation_and_return',
    'terms_of_service',
    'privacy_policy',
    'supplier_agreement',
    'copyright_and_takedown',
    'cookie_policy'
);


--
-- Name: email_address; Type: DOMAIN; Schema: identity; Owner: -
--

CREATE DOMAIN identity.email_address AS character varying(150)
	CONSTRAINT email_address_check CHECK (((VALUE)::text ~* '^[a-zA-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$'::text));


--
-- Name: DOMAIN email_address; Type: COMMENT; Schema: identity; Owner: -
--

COMMENT ON DOMAIN identity.email_address IS 'RFC 5322 standartlarına uygun e-posta formatı doğrulama domaini';


--
-- Name: otp_purpose; Type: TYPE; Schema: identity; Owner: -
--

CREATE TYPE identity.otp_purpose AS ENUM (
    'login_verification',
    'password_reset',
    'critical_action'
);


--
-- Name: TYPE otp_purpose; Type: COMMENT; Schema: identity; Owner: -
--

COMMENT ON TYPE identity.otp_purpose IS 'Tek kullanımlık şifrelerin (OTP) oluşturulma amaçları';


--
-- Name: user_role; Type: TYPE; Schema: identity; Owner: -
--

CREATE TYPE identity.user_role AS ENUM (
    'super_admin',
    'admin',
    'editor',
    'sales_manager',
    'warehouse'
);


--
-- Name: TYPE user_role; Type: COMMENT; Schema: identity; Owner: -
--

COMMENT ON TYPE identity.user_role IS 'Sistemdeki kullanıcı rolleri ve yetkilendirme seviyeleri';


--
-- Name: fn_slugify(text); Type: FUNCTION; Schema: catalog; Owner: -
--

CREATE FUNCTION catalog.fn_slugify(p_text text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $_$
DECLARE
    v_slug text;
BEGIN
    v_slug := lower(p_text);
    -- Türkçe karakterleri ingilizce equivalents ile değiştiriyoruz
    v_slug := translate(v_slug, 'ıışşğğüüööccçc', 'iissgguuoocccc');
    -- Alfasayısal olmayan karakterleri tire ile değiştir
    v_slug := regexp_replace(v_slug, '[^a-z0-9]+', '-', 'g');
    -- Baştaki ve sondaki tireleri temizle
    v_slug := regexp_replace(v_slug, '^-|-$', '', 'g');
    RETURN v_slug;
END;
$_$;


--
-- Name: FUNCTION fn_slugify(p_text text); Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON FUNCTION catalog.fn_slugify(p_text text) IS 'Girilen metni SEO uyumlu, Türkçe karakterlerden arındırılmış küçük harfli URL slug''ına dönüştürür';


--
-- Name: to_base36(bigint); Type: FUNCTION; Schema: catalog; Owner: -
--

CREATE FUNCTION catalog.to_base36(val bigint) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
  chars text := '0123456789abcdefghijklmnopqrstuvwxyz';
  result text := '';
  remainder int;
BEGIN
  IF val = 0 THEN RETURN '0'; END IF;
  WHILE val > 0 LOOP
    remainder := val % 36;
    result := substr(chars, remainder + 1, 1) || result;
    val := val / 36;
  END LOOP;
  RETURN result;
END;
$$;


--
-- Name: trig_brand_slug(); Type: FUNCTION; Schema: catalog; Owner: -
--

CREATE FUNCTION catalog.trig_brand_slug() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF NEW.slug IS NULL OR NEW.slug = '' THEN
        NEW.slug := catalog.fn_slugify(NEW.name);
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: trig_calculate_category_path(); Type: FUNCTION; Schema: catalog; Owner: -
--

CREATE FUNCTION catalog.trig_calculate_category_path() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_parent_path text;
    v_clean_id text;
BEGIN
    -- UUIDv7'deki tire işaretlerini ltree standardına uydurmak için temizliyoruz
    v_clean_id := replace(NEW.id::text, '-', '');

    -- Eğer üst kategori yoksa (Kök dizin), path sadece temizlenmiş kendi id'sidir
    IF NEW.parent_id IS NULL THEN
        NEW.node_path := v_clean_id::extensions.ltree;
    ELSE
        -- Üst kategorinin mevcut node_path değerini text olarak alıyoruz
        SELECT node_path::text INTO v_parent_path 
        FROM catalog.categories 
        WHERE id = NEW.parent_id;

        -- Üst kategorinin patikası ile yeni temizlenmiş ID'yi nokta ile birleştiriyoruz
        NEW.node_path := (v_parent_path || '.' || v_clean_id)::extensions.ltree;
    END IF;

    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION trig_calculate_category_path(); Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON FUNCTION catalog.trig_calculate_category_path() IS 'Yeni kategori eklendiğinde veya üst kategorisi değiştiğinde otomatik olarak ltree node_path hesaplayan trigger fonksiyonu';


--
-- Name: trig_product_custom_sku(); Type: FUNCTION; Schema: catalog; Owner: -
--

CREATE FUNCTION catalog.trig_product_custom_sku() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_alias VARCHAR(50);
BEGIN
    IF NEW.slug_id IS NULL OR NEW.slug_id = '' THEN
        NEW.slug_id := catalog.to_base36(nextval('catalog.products_slug_id_seq'));
    END IF;

    IF NEW.brand_id IS NOT NULL THEN
        SELECT NULLIF(BTRIM(alias_code), '') INTO v_alias
        FROM catalog.brands
        WHERE id = NEW.brand_id;
    END IF;

    IF (v_alias IS NULL OR v_alias = '') AND NEW.feed_id IS NOT NULL THEN
        SELECT NULLIF(BTRIM(alias_code), '') INTO v_alias
        FROM integration.xml_feeds
        WHERE id = NEW.feed_id;
    END IF;

    NEW.custom_sku := upper(coalesce(v_alias, 'PROD') || '-' || NEW.slug_id);
    RETURN NEW;
END;
$$;


--
-- Name: trig_product_slug(); Type: FUNCTION; Schema: catalog; Owner: -
--

CREATE FUNCTION catalog.trig_product_slug() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
                BEGIN
                    -- Ensure slug_id is generated
                    IF NEW.slug_id IS NULL OR NEW.slug_id = '' THEN
                        NEW.slug_id := catalog.to_base36(nextval('catalog.products_slug_id_seq'));
                    END IF;

                    -- Generate base slug
                    IF NEW.slug IS NULL OR NEW.slug = '' THEN
                        NEW.slug := catalog.fn_slugify(NEW.title);
                    END IF;

                    -- Append slug_id if not already at the end of the slug
                    IF NOT (NEW.slug LIKE '%' || NEW.slug_id) THEN
                        NEW.slug := NEW.slug || '-' || NEW.slug_id;
                    END IF;
                    
                    RETURN NEW;
                END;
                $$;


--
-- Name: trig_update_category_children_path(); Type: FUNCTION; Schema: catalog; Owner: -
--

CREATE FUNCTION catalog.trig_update_category_children_path() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Eğer kategorinin kendi node_path'i değiştiyse altındaki tüm çocukları da güncelle
    IF (OLD.node_path IS DISTINCT FROM NEW.node_path) THEN
        UPDATE catalog.categories
        SET node_path = NEW.node_path || extensions.subpath(node_path, extensions.nlevel(OLD.node_path))
        WHERE node_path <@ OLD.node_path AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION trig_update_category_children_path(); Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON FUNCTION catalog.trig_update_category_children_path() IS 'Bir kategorinin node_path değeri değiştiğinde altındaki tüm kategorilerin node_path değerlerini otomatik güncelleyen trigger fonksiyonu';


--
-- Name: trig_variant_custom_sku(); Type: FUNCTION; Schema: catalog; Owner: -
--

CREATE FUNCTION catalog.trig_variant_custom_sku() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
                    DECLARE
                        v_prod_sku VARCHAR(100);
                        v_suffix VARCHAR(50);
                    BEGIN
                        SELECT custom_sku INTO v_prod_sku 
                        FROM catalog.products 
                        WHERE id = NEW.product_id;
                        
                        IF NEW.custom_sku IS NULL OR NEW.custom_sku = '' THEN
                            IF NEW.variant_size IS NOT NULL AND NEW.variant_size != '' THEN
                                v_suffix := catalog.fn_slugify(NEW.variant_size);
                            ELSE
                                v_suffix := regexp_replace(NEW.source_variant_id, '[^a-zA-Z0-9]+', '', 'g');
                            END IF;
                            
                            IF NEW.is_single THEN
                                v_suffix := v_suffix || '-single';
                            END IF;
                            
                            NEW.custom_sku := upper(coalesce(v_prod_sku, 'VAR') || '-' || v_suffix);
                        END IF;
                        RETURN NEW;
                    END;
                    $$;


--
-- Name: prevent_immutable_mutation(); Type: FUNCTION; Schema: compliance; Owner: -
--

CREATE FUNCTION compliance.prevent_immutable_mutation() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
		BEGIN
			RAISE EXCEPTION 'Compliance table % is append-only (WORM); % operations are forbidden for forensic integrity.', TG_TABLE_NAME, TG_OP;
		END;
		$$;


--
-- Name: fn_generate_otp(uuid, identity.otp_purpose); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.fn_generate_otp(p_user_id uuid, p_purpose identity.otp_purpose DEFAULT 'login_verification'::identity.otp_purpose) RETURNS character varying
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_generated_code VARCHAR(6);
    v_random_value INT;
BEGIN
    -- 1. Önce o kullanıcının bekleyen, daha önce üretilmiş aktif TÜM OTP'lerini iptal ediyoruz
    UPDATE identity.user_otps
    SET is_used = true, used_at = CURRENT_TIMESTAMP
    WHERE user_id = p_user_id AND is_used = false AND purpose = p_purpose;

    -- 2. Kriptografik olarak güvenli rastgele 6 haneli sayı üretiyoruz (100000 ile 999999 arası)
    -- extensions.gen_random_bytes ve encode fonksiyonları kullanılıyor
    v_random_value := abs(('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::int);
    v_generated_code := ((v_random_value % 900000) + 100000)::VARCHAR(6);

    -- 3. Üretilen kodu ve 3 dakikalık geçerlilik süresini tabloya INSERT ediyoruz
    INSERT INTO identity.user_otps (
        id, 
        user_id,
        otp_code,
        purpose,
        is_used,
        attempt_count,
        max_attempts,
        expires_at
    ) VALUES (
        uuidv7(), 
        p_user_id,
        v_generated_code,
        p_purpose,
        false,
        0,
        3,
        CURRENT_TIMESTAMP + INTERVAL '3 minutes'
    );

    RETURN v_generated_code;
END;
$$;


--
-- Name: FUNCTION fn_generate_otp(p_user_id uuid, p_purpose identity.otp_purpose); Type: COMMENT; Schema: identity; Owner: -
--

COMMENT ON FUNCTION identity.fn_generate_otp(p_user_id uuid, p_purpose identity.otp_purpose) IS 'Kullanıcı için 6 haneli, 3 dakika geçerli, güvenli bir tek kullanımlık şifre (OTP) üreten fonksiyon';


--
-- Name: fn_verify_otp(uuid, character varying, identity.otp_purpose); Type: FUNCTION; Schema: identity; Owner: -
--

CREATE FUNCTION identity.fn_verify_otp(p_user_id uuid, p_otp_code character varying, p_purpose identity.otp_purpose DEFAULT 'login_verification'::identity.otp_purpose) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_otp_id uuid;
    v_attempt_count INT;
    v_max_attempts INT;
    v_correct_code VARCHAR(6);
BEGIN
    -- 1. Kullanıcının o amaç için üretilmiş son aktif (kullanılmamış ve süresi dolmamış) OTP kaydını buluyoruz
    SELECT id, otp_code, attempt_count, max_attempts
    INTO v_otp_id, v_correct_code, v_attempt_count, v_max_attempts
    FROM identity.user_otps
    WHERE user_id = p_user_id 
      AND purpose = p_purpose 
      AND is_used = false 
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_otp_id IS NULL THEN
        RETURN false;
    END IF;

    -- 2. Kod doğru mu kontrol et
    IF v_correct_code = p_otp_code THEN
        UPDATE identity.user_otps
        SET is_used = true, used_at = CURRENT_TIMESTAMP
        WHERE id = v_otp_id;
        
        RETURN true;
    ELSE
        v_attempt_count := v_attempt_count + 1;
        
        IF v_attempt_count >= v_max_attempts THEN
            UPDATE identity.user_otps
            SET attempt_count = v_attempt_count, is_used = true, used_at = CURRENT_TIMESTAMP
            WHERE id = v_otp_id;
        ELSE
            UPDATE identity.user_otps
            SET attempt_count = v_attempt_count
            WHERE id = v_otp_id;
        END IF;
        
        RETURN false;
    END IF;
END;
$$;


--
-- Name: FUNCTION fn_verify_otp(p_user_id uuid, p_otp_code character varying, p_purpose identity.otp_purpose); Type: COMMENT; Schema: identity; Owner: -
--

COMMENT ON FUNCTION identity.fn_verify_otp(p_user_id uuid, p_otp_code character varying, p_purpose identity.otp_purpose) IS 'Kullanıcı tarafından girilen tek kullanımlık şifreyi (OTP) doğrulayan ve güvenlik denetimlerini yapan fonksiyon';


--
-- Name: sp_create_user(character varying, character varying, identity.email_address, character varying, identity.user_role); Type: PROCEDURE; Schema: identity; Owner: -
--

CREATE PROCEDURE identity.sp_create_user(IN p_first_name character varying, IN p_last_name character varying, IN p_email identity.email_address, IN p_plain_password character varying, IN p_role identity.user_role DEFAULT 'editor'::identity.user_role)
    LANGUAGE plpgsql
    AS $$
DECLARE
    hashed_password VARCHAR(255);
BEGIN
    -- Şifreyi veritabanı seviyesinde bcrypt ile hash'liyoruz.
    -- extensions.crypt ve extensions.gen_salt kullanarak extensions şemasına yönlendiriyoruz.
    hashed_password := extensions.crypt(p_plain_password, extensions.gen_salt('bf', 10));

    INSERT INTO identity.users (
        id, 
        first_name,
        last_name,
        email,
        password_hash,
        role,
        is_active,
        is_blocked,
        failed_login_attempts
    ) VALUES (
        uuidv7(), 
        p_first_name,
        p_last_name,
        p_email,
        hashed_password,
        p_role,
        true,
        false,
        0
    );

    RAISE NOTICE 'Kullanıcı % % (% rolüyle) başarıyla oluşturuldu.', p_first_name, p_last_name, p_role;
END;
$$;


--
-- Name: PROCEDURE sp_create_user(IN p_first_name character varying, IN p_last_name character varying, IN p_email identity.email_address, IN p_plain_password character varying, IN p_role identity.user_role); Type: COMMENT; Schema: identity; Owner: -
--

COMMENT ON PROCEDURE identity.sp_create_user(IN p_first_name character varying, IN p_last_name character varying, IN p_email identity.email_address, IN p_plain_password character varying, IN p_role identity.user_role) IS 'Yeni bir kullanıcıyı şifresini bcrypt ile hashleyerek güvenli bir şekilde oluşturan saklı yordam';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: bot_crawl_hourly; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.bot_crawl_hourly (
    bucket_hour timestamp with time zone NOT NULL,
    bot_name character varying(60) NOT NULL,
    bot_category character varying(32) NOT NULL,
    path character varying(500) NOT NULL,
    status_class character varying(8) DEFAULT '2xx'::character varying NOT NULL,
    hits bigint DEFAULT 0 NOT NULL,
    last_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: bot_crawl_logs; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.bot_crawl_logs (
    id bigint NOT NULL,
    bot_name character varying(60) NOT NULL,
    path character varying(500) NOT NULL,
    user_agent text DEFAULT ''::text NOT NULL,
    ip_hash character varying(64) DEFAULT ''::character varying NOT NULL,
    country_code character varying(10) DEFAULT ''::character varying NOT NULL,
    status_code smallint DEFAULT 200 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: bot_crawl_logs_id_seq; Type: SEQUENCE; Schema: analytics; Owner: -
--

CREATE SEQUENCE analytics.bot_crawl_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: bot_crawl_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: analytics; Owner: -
--

ALTER SEQUENCE analytics.bot_crawl_logs_id_seq OWNED BY analytics.bot_crawl_logs.id;


--
-- Name: brand_events; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.brand_events (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid NOT NULL,
    product_id uuid,
    event_type character varying(50) NOT NULL,
    visitor_id character varying(120) DEFAULT ''::character varying NOT NULL,
    country_code character varying(10) DEFAULT 'TR'::character varying NOT NULL,
    language_code character varying(10) DEFAULT 'tr'::character varying NOT NULL,
    device_type character varying(30) DEFAULT 'desktop'::character varying NOT NULL,
    referrer_host character varying(255) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: log_ingest_cursors; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.log_ingest_cursors (
    source_key character varying(120) NOT NULL,
    file_inode bigint DEFAULT 0 NOT NULL,
    byte_offset bigint DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: member_events; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.member_events (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id character varying(128),
    visitor_id character varying(64),
    session_id character varying(64),
    event_type character varying(50) NOT NULL,
    event_category character varying(32) DEFAULT 'navigation'::character varying NOT NULL,
    title character varying(300) NOT NULL,
    subtitle character varying(500),
    url_path character varying(500),
    entity_type character varying(40),
    entity_id character varying(128),
    image_url text,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    duration_sec integer DEFAULT 0 NOT NULL,
    device_type character varying(20) DEFAULT 'desktop'::character varying,
    browser character varying(50),
    os character varying(50),
    country_code character varying(10),
    ip_address character varying(64),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: page_views; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.page_views (
    id bigint NOT NULL,
    visitor_id character varying(64) NOT NULL,
    session_id character varying(64),
    url text NOT NULL,
    path character varying(500) NOT NULL,
    referrer text,
    referrer_host character varying(255),
    utm_source character varying(100),
    utm_medium character varying(100),
    utm_campaign character varying(100),
    device_type character varying(20) DEFAULT 'desktop'::character varying,
    browser character varying(50),
    os character varying(50),
    language character varying(10) DEFAULT 'tr'::character varying,
    screen_width integer DEFAULT 0,
    screen_height integer DEFAULT 0,
    ip_hash character varying(64),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id character varying(128),
    page_title character varying(300),
    duration_sec integer DEFAULT 0 NOT NULL,
    country_code character varying(10) DEFAULT ''::character varying NOT NULL,
    city character varying(100) DEFAULT ''::character varying NOT NULL,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL,
    utm_term character varying(150) DEFAULT ''::character varying NOT NULL,
    utm_content character varying(150) DEFAULT ''::character varying NOT NULL,
    click_id character varying(150) DEFAULT ''::character varying NOT NULL,
    scroll_depth_pct smallint DEFAULT 0 NOT NULL,
    is_bot boolean DEFAULT false NOT NULL,
    bot_name character varying(60) DEFAULT ''::character varying NOT NULL,
    is_new_visitor boolean DEFAULT false NOT NULL,
    lcp_ms integer DEFAULT 0 NOT NULL,
    cls_score numeric(8,4) DEFAULT 0 NOT NULL,
    inp_ms integer DEFAULT 0 NOT NULL,
    ttfb_ms integer DEFAULT 0 NOT NULL,
    referrer_keyword character varying(200) DEFAULT ''::character varying NOT NULL
);


--
-- Name: page_views_id_seq; Type: SEQUENCE; Schema: analytics; Owner: -
--

CREATE SEQUENCE analytics.page_views_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: page_views_id_seq; Type: SEQUENCE OWNED BY; Schema: analytics; Owner: -
--

ALTER SEQUENCE analytics.page_views_id_seq OWNED BY analytics.page_views.id;


--
-- Name: search_logs; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.search_logs (
    id bigint NOT NULL,
    visitor_id character varying(64) DEFAULT ''::character varying NOT NULL,
    session_id character varying(64) DEFAULT ''::character varying NOT NULL,
    user_id character varying(128),
    query_text character varying(250) NOT NULL,
    normalized_query character varying(250) NOT NULL,
    language_code character varying(10) DEFAULT 'tr'::character varying NOT NULL,
    country_code character varying(10) DEFAULT ''::character varying NOT NULL,
    category_slug character varying(160) DEFAULT ''::character varying NOT NULL,
    results_count integer DEFAULT 0 NOT NULL,
    has_filters boolean DEFAULT false NOT NULL,
    clicked_product_id character varying(64),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_zero_result boolean DEFAULT false NOT NULL
);


--
-- Name: search_logs_id_seq; Type: SEQUENCE; Schema: analytics; Owner: -
--

CREATE SEQUENCE analytics.search_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: search_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: analytics; Owner: -
--

ALTER SEQUENCE analytics.search_logs_id_seq OWNED BY analytics.search_logs.id;


--
-- Name: user_visitor_links; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.user_visitor_links (
    user_id character varying(128) NOT NULL,
    visitor_id character varying(64) NOT NULL,
    first_linked_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: whatsapp_clicks; Type: TABLE; Schema: analytics; Owner: -
--

CREATE TABLE analytics.whatsapp_clicks (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid,
    product_id uuid,
    user_id character varying(128) DEFAULT ''::character varying NOT NULL,
    visitor_id character varying(128) DEFAULT ''::character varying NOT NULL,
    target_phone character varying(64) DEFAULT ''::character varying NOT NULL,
    source_surface character varying(64) DEFAULT ''::character varying NOT NULL,
    page_path character varying(500) DEFAULT ''::character varying NOT NULL,
    country_code character varying(10) DEFAULT 'TR'::character varying NOT NULL,
    language_code character varying(10) DEFAULT 'tr'::character varying NOT NULL,
    device_type character varying(30) DEFAULT 'desktop'::character varying NOT NULL,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL,
    referrer_host character varying(255) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: attribute_translations; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.attribute_translations (
    attribute_id uuid NOT NULL,
    language_code character varying(10) NOT NULL,
    attribute_name character varying(100) CONSTRAINT attribute_translations_name_not_null NOT NULL
);


--
-- Name: attribute_value_translations; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.attribute_value_translations (
    attribute_value_id uuid NOT NULL,
    language_code character varying(10) NOT NULL,
    attribute_value character varying(255) CONSTRAINT attribute_value_translations_value_not_null NOT NULL
);


--
-- Name: attribute_values; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.attribute_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attribute_id uuid NOT NULL,
    attribute_value character varying(255) CONSTRAINT attribute_values_value_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: attributes; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.attributes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    attribute_name character varying(100) CONSTRAINT attributes_name_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: blog_post_translations; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.blog_post_translations (
    post_id uuid NOT NULL,
    language_code character varying(10) NOT NULL,
    title character varying(255) NOT NULL,
    summary text,
    content text NOT NULL,
    meta_title character varying(255),
    meta_description text,
    slug character varying(200)
);


--
-- Name: blog_posts; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.blog_posts (
    id uuid DEFAULT uuidv7() NOT NULL,
    slug character varying(150) NOT NULL,
    cover_image character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: brands; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.brands (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_name character varying(100) CONSTRAINT brands_name_not_null NOT NULL,
    slug character varying(150) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    alias_code character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    website character varying(255),
    phone character varying(50),
    addresses jsonb,
    company_type character varying(50) DEFAULT 'uretici_toptanci'::character varying NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    whatsapp_phone character varying(50) DEFAULT ''::character varying NOT NULL,
    public_email character varying(150) DEFAULT ''::character varying NOT NULL,
    instagram_handle character varying(100) DEFAULT ''::character varying NOT NULL,
    location_address text DEFAULT ''::text NOT NULL,
    export_countries text DEFAULT ''::text NOT NULL,
    min_order_quantity integer DEFAULT 1 NOT NULL,
    supports_private_label boolean DEFAULT false NOT NULL,
    supports_fason boolean DEFAULT false NOT NULL,
    is_verified boolean DEFAULT true NOT NULL,
    bank_name character varying(150) DEFAULT ''::character varying NOT NULL,
    bank_account_holder character varying(200) DEFAULT ''::character varying NOT NULL,
    iban character varying(64) DEFAULT ''::character varying NOT NULL,
    description_translations jsonb DEFAULT '{}'::jsonb NOT NULL,
    city character varying(100) DEFAULT 'İstanbul'::character varying NOT NULL,
    district character varying(100) DEFAULT 'Merter'::character varying NOT NULL,
    short_description text DEFAULT ''::text NOT NULL,
    cover_image_url text DEFAULT ''::text NOT NULL,
    landline_phone character varying(50) DEFAULT ''::character varying NOT NULL,
    whatsapp_only_ordering boolean DEFAULT false NOT NULL,
    subdomain character varying(63),
    subdomain_enabled boolean DEFAULT true NOT NULL,
    CONSTRAINT chk_brands_subdomain_format CHECK (((subdomain IS NULL) OR (((subdomain)::text ~ '^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])$'::text) AND ((subdomain)::text !~~ '%--%'::text))))
);


--
-- Name: TABLE brands; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.brands IS 'Ürünlerin üretici / tedarikçi marka kartları';


--
-- Name: COLUMN brands.id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.brands.id IS 'Markanın benzersiz kimliği (UUIDv7)';


--
-- Name: COLUMN brands.brand_name; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.brands.brand_name IS 'Markanın adı (örn: lustrin, Jane''s, Etika vb.)';


--
-- Name: COLUMN brands.slug; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.brands.slug IS 'Markanın SEO uyumlu URL yolu (otomatik üretilir)';


--
-- Name: COLUMN brands.website; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.brands.website IS 'Tedarikçinin resmi web sitesi adresi';


--
-- Name: COLUMN brands.phone; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.brands.phone IS 'Tedarikçinin iletişim telefon numarası';


--
-- Name: COLUMN brands.addresses; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.brands.addresses IS 'Tedarikçinin birden fazla adres bilgisini ve dükkan harita koordinatlarını tutan JSONB dizisi';


--
-- Name: buyer_rfq_offers; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.buyer_rfq_offers (
    id uuid DEFAULT uuidv7() NOT NULL,
    rfq_id uuid NOT NULL,
    brand_id uuid NOT NULL,
    offered_unit_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    min_order_quantity integer DEFAULT 1 NOT NULL,
    delivery_days integer DEFAULT 7 NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    supplier_phone character varying(60) DEFAULT ''::character varying NOT NULL,
    supplier_whatsapp character varying(60) DEFAULT ''::character varying NOT NULL,
    status character varying(30) DEFAULT 'SENT'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: buyer_rfq_seq; Type: SEQUENCE; Schema: catalog; Owner: -
--

CREATE SEQUENCE catalog.buyer_rfq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: buyer_rfqs; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.buyer_rfqs (
    id uuid DEFAULT uuidv7() NOT NULL,
    rfq_number character varying(40) NOT NULL,
    title character varying(255) NOT NULL,
    category_name character varying(150) DEFAULT ''::character varying NOT NULL,
    target_quantity integer DEFAULT 100 NOT NULL,
    unit_type character varying(30) DEFAULT 'ADET'::character varying NOT NULL,
    target_price numeric(12,2),
    currency character varying(10) DEFAULT 'USD'::character varying NOT NULL,
    production_type character varying(50) DEFAULT 'hazir_toptan'::character varying NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    buyer_name character varying(150) NOT NULL,
    buyer_company character varying(150) DEFAULT ''::character varying NOT NULL,
    buyer_country character varying(80) DEFAULT 'Türkiye'::character varying NOT NULL,
    buyer_phone character varying(60) NOT NULL,
    buyer_whatsapp character varying(60) DEFAULT ''::character varying NOT NULL,
    buyer_email character varying(150) DEFAULT ''::character varying NOT NULL,
    status character varying(30) DEFAULT 'APPROVED'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cart_items; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.cart_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    cart_id uuid NOT NULL,
    product_id uuid NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    custom_unit_price numeric(12,2),
    offer_message_id uuid,
    CONSTRAINT cart_items_quantity_check CHECK ((quantity > 0))
);


--
-- Name: carts; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.carts (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id character varying(255) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: categories; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.categories (
    id uuid DEFAULT uuidv7() NOT NULL,
    parent_id uuid,
    title character varying(100) NOT NULL,
    slug character varying(150) NOT NULL,
    node_path extensions.ltree NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE categories; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.categories IS 'Sınırsız derinlikte alt kategori desteği ve ltree yapısı içeren kategori ağacı tablosu';


--
-- Name: COLUMN categories.id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.categories.id IS 'Kategorinin benzersiz kimliği (UUIDv7 formatında)';


--
-- Name: COLUMN categories.parent_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.categories.parent_id IS 'Varsa üst kategorinin benzersiz kimliği (Self-referencing Foreign Key)';


--
-- Name: COLUMN categories.title; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.categories.title IS 'Kategori başlığı / adı';


--
-- Name: COLUMN categories.slug; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.categories.slug IS 'Kategori için SEO uyumlu ve benzersiz URL yolu';


--
-- Name: COLUMN categories.node_path; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.categories.node_path IS 'ltree formatında, kökten bu kategoriye kadar olan hiyerarşik yol';


--
-- Name: COLUMN categories.is_active; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.categories.is_active IS 'Kategorinin aktiflik / yayında olma durumu';


--
-- Name: COLUMN categories.created_at; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.categories.created_at IS 'Kategorinin oluşturulma zamanı';


--
-- Name: COLUMN categories.updated_at; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.categories.updated_at IS 'Kategorinin son güncellenme zamanı';


--
-- Name: category_translations; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.category_translations (
    category_id uuid NOT NULL,
    language_code character varying(10) NOT NULL,
    title character varying(100) NOT NULL,
    seo_description text
);


--
-- Name: chat_messages; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.chat_messages (
    id uuid DEFAULT uuidv7() NOT NULL,
    room_id uuid NOT NULL,
    sender_type character varying(20) NOT NULL,
    sender_id character varying(255) NOT NULL,
    sender_name character varying(150) NOT NULL,
    message_type character varying(30) DEFAULT 'text'::character varying NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chat_messages_message_type_check CHECK (((message_type)::text = ANY ((ARRAY['text'::character varying, 'product_card'::character varying, 'custom_offer'::character varying, 'image'::character varying])::text[]))),
    CONSTRAINT chat_messages_sender_type_check CHECK (((sender_type)::text = ANY ((ARRAY['customer'::character varying, 'supplier'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: chat_rooms; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.chat_rooms (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid NOT NULL,
    supplier_user_id uuid,
    customer_id character varying(255) NOT NULL,
    customer_name character varying(150) DEFAULT 'Misafir Alıcı'::character varying NOT NULL,
    customer_email character varying(150),
    customer_phone character varying(50),
    initial_product_id uuid,
    last_message_preview text DEFAULT ''::text NOT NULL,
    last_message_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    unread_customer_count integer DEFAULT 0 NOT NULL,
    unread_supplier_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: color_translations; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.color_translations (
    color_id uuid NOT NULL,
    language_code character varying(10) NOT NULL,
    color_name character varying(100) CONSTRAINT color_translations_name_not_null NOT NULL
);


--
-- Name: TABLE color_translations; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.color_translations IS 'Renklerin çok dilli çeviri karşılıkları';


--
-- Name: COLUMN color_translations.color_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.color_translations.color_id IS 'Çevirisi yapılan rengin referans kimliği (Foreign Key)';


--
-- Name: COLUMN color_translations.language_code; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.color_translations.language_code IS 'Çevirinin dil kodu (en, pl, bg, ar, ru, de)';


--
-- Name: COLUMN color_translations.color_name; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.color_translations.color_name IS 'Rengin hedef dildeki çeviri karşılığı';


--
-- Name: colors; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.colors (
    id uuid DEFAULT uuidv7() NOT NULL,
    color_name character varying(100) CONSTRAINT colors_name_not_null NOT NULL,
    color_code character varying(7),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE colors; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.colors IS 'Tüm toptan tedarikçilerden toplanan renk kartları';


--
-- Name: COLUMN colors.id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.colors.id IS 'Rengin benzersiz kimliği (UUIDv7)';


--
-- Name: COLUMN colors.color_name; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.colors.color_name IS 'Rengin Türkçe varsayılan adı';


--
-- Name: COLUMN colors.color_code; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.colors.color_code IS 'Rengin hex kod karşılığı (İsteğe bağlı)';


--
-- Name: countries; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.countries (
    id uuid DEFAULT uuidv7() NOT NULL,
    code character varying(10) NOT NULL,
    phone_code integer,
    localized_names jsonb CONSTRAINT countries_names_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: country_cities; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.country_cities (
    id uuid DEFAULT uuidv7() NOT NULL,
    state_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: country_group_memberships; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.country_group_memberships (
    country_id uuid NOT NULL,
    group_id uuid NOT NULL
);


--
-- Name: country_groups; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.country_groups (
    id uuid DEFAULT uuidv7() NOT NULL,
    code character varying(50) NOT NULL,
    localized_names jsonb CONSTRAINT country_groups_names_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: country_states; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.country_states (
    id uuid DEFAULT uuidv7() NOT NULL,
    country_id uuid NOT NULL,
    code character varying(50) NOT NULL,
    state_name character varying(150) CONSTRAINT country_states_name_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: currencies; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.currencies (
    id uuid DEFAULT uuidv7() NOT NULL,
    currency_code character varying(10) CONSTRAINT currencies_name_not_null NOT NULL,
    symbol character varying(10) NOT NULL,
    full_name character varying(150) NOT NULL,
    is_active boolean DEFAULT true CONSTRAINT currencies_active_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: customer_favorite_suppliers; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.customer_favorite_suppliers (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id character varying(255) NOT NULL,
    brand_id uuid NOT NULL,
    notify_new_products boolean DEFAULT true NOT NULL,
    notify_via_email boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: exchange_rates; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.exchange_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    currency_code character varying(3) NOT NULL,
    buying_rate numeric(12,4) NOT NULL,
    selling_rate numeric(12,4) NOT NULL,
    publication_date date NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: fabric_translations; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.fabric_translations (
    fabric_id uuid NOT NULL,
    language_code character varying(10) NOT NULL,
    fabric_name character varying(100) CONSTRAINT fabric_translations_name_not_null NOT NULL
);


--
-- Name: TABLE fabric_translations; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.fabric_translations IS 'Kumaşların çok dilli çeviri karşılıkları';


--
-- Name: COLUMN fabric_translations.fabric_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.fabric_translations.fabric_id IS 'Çevirisi yapılan kumaşın referans kimliği (Foreign Key)';


--
-- Name: COLUMN fabric_translations.language_code; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.fabric_translations.language_code IS 'Çevirinin dil kodu (en, pl, bg, ar, ru, de)';


--
-- Name: COLUMN fabric_translations.fabric_name; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.fabric_translations.fabric_name IS 'Kumaşın hedef dildeki çeviri karşılığı';


--
-- Name: fabrics; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.fabrics (
    id uuid DEFAULT uuidv7() NOT NULL,
    fabric_name character varying(100) CONSTRAINT fabrics_name_not_null NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: TABLE fabrics; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.fabrics IS 'Tüm toptan tedarikçilerden toplanan kumaş kartları';


--
-- Name: COLUMN fabrics.id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.fabrics.id IS 'Kumaşın benzersiz kimliği (UUIDv7)';


--
-- Name: COLUMN fabrics.fabric_name; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.fabrics.fabric_name IS 'Kumaşın Türkçe varsayılan adı';


--
-- Name: indexnow_automation_state; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.indexnow_automation_state (
    singleton_guard boolean DEFAULT true NOT NULL,
    auto_enabled boolean DEFAULT true NOT NULL,
    initial_backfill_completed_at timestamp with time zone,
    initial_backfill_status character varying(24) DEFAULT 'pending'::character varying NOT NULL,
    initial_backfill_last_error text DEFAULT ''::text NOT NULL,
    last_sweep_at timestamp with time zone,
    last_sweep_summary jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT indexnow_automation_state_singleton_guard_check CHECK ((singleton_guard = true))
);


--
-- Name: indexnow_logs; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.indexnow_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    trigger_source character varying(40) DEFAULT 'manual'::character varying NOT NULL,
    source_label character varying(240) DEFAULT ''::character varying NOT NULL,
    feed_id uuid,
    sync_run_id uuid,
    host character varying(120) DEFAULT 'mertervitrini.com.tr'::character varying NOT NULL,
    product_count integer DEFAULT 0 NOT NULL,
    url_count integer DEFAULT 0 NOT NULL,
    sample_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    status character varying(24) DEFAULT 'pending'::character varying NOT NULL,
    http_status integer DEFAULT 0 NOT NULL,
    response_message text DEFAULT ''::text NOT NULL,
    duration_ms integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: languages; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.languages (
    id uuid DEFAULT uuidv7() NOT NULL,
    code character varying(10) NOT NULL,
    label character varying(100) NOT NULL,
    flag character varying(10) NOT NULL,
    category_prefix character varying(10) NOT NULL,
    text_direction character varying(10) DEFAULT 'ltr'::character varying CONSTRAINT languages_dir_not_null NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: legal_consent_logs; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.legal_consent_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    consent_type character varying(64) NOT NULL,
    policy_type character varying(64) NOT NULL,
    policy_version integer DEFAULT 1 NOT NULL,
    actor_role character varying(32) NOT NULL,
    actor_user_id character varying(128),
    brand_id uuid,
    entity_type character varying(64),
    entity_id character varying(128),
    email character varying(255),
    ip_address character varying(64),
    user_agent text,
    accepted_text_hash character varying(64),
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    accepted_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: legal_policies; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.legal_policies (
    id uuid DEFAULT uuidv7() NOT NULL,
    policy_type catalog.policy_type CONSTRAINT legal_policies_type_not_null NOT NULL,
    policy_version integer CONSTRAINT legal_policies_version_not_null NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: mobile_notifications; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.mobile_notifications (
    id uuid DEFAULT uuidv7() NOT NULL,
    recipient_type character varying(20) DEFAULT 'customer'::character varying NOT NULL,
    recipient_id character varying(255) DEFAULT ''::character varying NOT NULL,
    title character varying(200) NOT NULL,
    body text DEFAULT ''::text NOT NULL,
    notification_type character varying(50) DEFAULT 'system'::character varying NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_role character varying(30) DEFAULT 'customer'::character varying NOT NULL,
    user_id character varying(255) DEFAULT ''::character varying NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT mobile_notifications_recipient_type_check CHECK (((recipient_type)::text = ANY ((ARRAY['customer'::character varying, 'supplier'::character varying])::text[])))
);


--
-- Name: mobile_wishlist; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.mobile_wishlist (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id character varying(255) NOT NULL,
    product_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: product_images; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.product_images (
    id uuid DEFAULT uuidv7() NOT NULL,
    product_id uuid NOT NULL,
    image_url character varying(255) NOT NULL,
    sort_order integer DEFAULT 0,
    is_cover boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    original_size_bytes bigint,
    optimized_size_bytes bigint,
    is_optimized boolean DEFAULT false NOT NULL,
    optimized_at timestamp with time zone
);


--
-- Name: TABLE product_images; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.product_images IS 'Ürünlerin e-ticaret sitesinde görüntülenecek görselleri';


--
-- Name: COLUMN product_images.id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.product_images.id IS 'Görselin sistemdeki benzersiz kimliği (UUIDv7)';


--
-- Name: COLUMN product_images.product_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.product_images.product_id IS 'Görselin ait olduğu ürün kartı referansı';


--
-- Name: COLUMN product_images.image_url; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.product_images.image_url IS 'Görsel dosyasının CDN veya uzak sunucu tam adresi';


--
-- Name: COLUMN product_images.sort_order; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.product_images.sort_order IS 'Görsellerin sıralama önceliği (küçük olan önce gelir)';


--
-- Name: COLUMN product_images.is_cover; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.product_images.is_cover IS 'Bu görselin ürün kapak resmi olup olmadığı durumu';


--
-- Name: COLUMN product_images.original_size_bytes; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.product_images.original_size_bytes IS 'Görselin optimizasyon öncesi orijinal dosya boyutu (byte)';


--
-- Name: COLUMN product_images.optimized_size_bytes; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.product_images.optimized_size_bytes IS 'Görselin optimizasyon sonrası sıkıştırılmış dosya boyutu (byte)';


--
-- Name: COLUMN product_images.is_optimized; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.product_images.is_optimized IS 'Görselin Pillow optimizasyon işleminden geçip geçmediği durumu';


--
-- Name: COLUMN product_images.optimized_at; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.product_images.optimized_at IS 'Görselin optimize edildiği zaman damgası';


--
-- Name: product_translations; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.product_translations (
    product_id uuid NOT NULL,
    language_code character varying(10) NOT NULL,
    title character varying(255) NOT NULL,
    short_description text,
    description text
);


--
-- Name: products_slug_id_seq; Type: SEQUENCE; Schema: catalog; Owner: -
--

CREATE SEQUENCE catalog.products_slug_id_seq
    START WITH 100000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: products; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.products (
    id uuid DEFAULT uuidv7() NOT NULL,
    feed_id character varying(50),
    source_product_id character varying(100) NOT NULL,
    title character varying(255) NOT NULL,
    slug character varying(255) NOT NULL,
    custom_sku character varying(100) NOT NULL,
    short_description text,
    description text,
    brand_id uuid,
    category_id uuid,
    gender character varying(20),
    season character varying(50),
    desi_volume numeric(10,2) DEFAULT 0,
    shipping_weight_kg numeric(10,3) DEFAULT 0,
    packing_ratio character varying(100),
    series_ratio character varying(100),
    minimum_order_quantity integer DEFAULT 1,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_run_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    meta_attributes jsonb,
    slug_id character varying(8) DEFAULT catalog.to_base36(nextval('catalog.products_slug_id_seq'::regclass)),
    source_product_group_id character varying(100),
    price numeric(15,4) DEFAULT 0.00 NOT NULL,
    discounted_price numeric(15,4),
    currency character varying(10) DEFAULT 'TRY'::character varying,
    tax_rate numeric(5,2) DEFAULT 10.00,
    stock integer DEFAULT 0 NOT NULL,
    sku character varying(100),
    barcode character varying(100),
    source_url character varying(512),
    color_id uuid,
    fabric_id uuid,
    buying_price numeric(15,4) DEFAULT 0.00 NOT NULL,
    single_price numeric(15,4),
    deleted_at timestamp with time zone,
    is_archived boolean DEFAULT false NOT NULL,
    archived_at timestamp with time zone,
    series_stock integer DEFAULT 100 NOT NULL,
    deactivated_at timestamp with time zone,
    indexnow_notified_at timestamp with time zone,
    content_responsibility_accepted boolean DEFAULT false NOT NULL,
    content_responsibility_accepted_at timestamp with time zone,
    content_responsibility_version integer
);


--
-- Name: TABLE products; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.products IS 'Sistemdeki toptan satışa sunulan ana ürün grup/kart bilgileri';


--
-- Name: COLUMN products.id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.id IS 'Ürün grubunun sistemdeki benzersiz kimliği (UUIDv7)';


--
-- Name: COLUMN products.feed_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.feed_id IS 'Ürünün beslendiği XML entegrasyon kaynağı referansı';


--
-- Name: COLUMN products.source_product_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.source_product_id IS 'XML kaynağından gelen özgün ürün grup ID''si';


--
-- Name: COLUMN products.title; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.title IS 'Ürünün satış adı';


--
-- Name: COLUMN products.slug; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.slug IS 'Ürünün SEO uyumlu URL yolu (otomatik üretilir)';


--
-- Name: COLUMN products.custom_sku; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.custom_sku IS 'Ön yüzde gösterilecek, asıl tedarikçiyi gizleyen özel stok kodu (örn: EDUSA-62382)';


--
-- Name: COLUMN products.short_description; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.short_description IS 'HTML destekli kısa ön yazı veya manken bilgisi';


--
-- Name: COLUMN products.description; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.description IS 'HTML destekli detaylı ürün açıklaması ve beden ölçü tabloları';


--
-- Name: COLUMN products.brand_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.brand_id IS 'Ürünün markası';


--
-- Name: COLUMN products.category_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.category_id IS 'Ürünün ait olduğu kategori';


--
-- Name: COLUMN products.gender; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.gender IS 'Hedef cinsiyet grubu (Kadın, Erkek, Kız vb.)';


--
-- Name: COLUMN products.season; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.season IS 'Ürün sezonu (Yazlık, Kışlık, Dört Mevsim)';


--
-- Name: COLUMN products.desi_volume; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.desi_volume IS 'Paketlenmiş ürünün kargo desi değeri';


--
-- Name: COLUMN products.shipping_weight_kg; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.shipping_weight_kg IS 'Ürünün kargo ağırlığı (KG)';


--
-- Name: COLUMN products.packing_ratio; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.packing_ratio IS 'Toptan asorti beden paket içeriği dağılımı (örn: 1S-2M-1L)';


--
-- Name: COLUMN products.series_ratio; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.series_ratio IS 'Toptan seri paketleme çarpanı (örn: 2-2-2)';


--
-- Name: COLUMN products.minimum_order_quantity; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.minimum_order_quantity IS 'Bu üründen toptan sepete eklenebilecek minimum miktar';


--
-- Name: COLUMN products.is_active; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.is_active IS 'Ürünün yayında olup olmadığı (XML''de yoksa pasife çekilir)';


--
-- Name: COLUMN products.last_sync_run_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.last_sync_run_id IS 'Ürünün en son hangi import/sync oturumunda tespit edildiği';


--
-- Name: COLUMN products.meta_attributes; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.meta_attributes IS 'XML kaynaklarına göre değişen ek özelliklerin saklandığı esnek JSONB alanı';


--
-- Name: COLUMN products.color_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.color_id IS 'Ürünün master colors tablosundaki ilişkili renk UUID kimliği';


--
-- Name: COLUMN products.fabric_id; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON COLUMN catalog.products.fabric_id IS 'Ürünün master fabrics tablosundaki ilişkili kumaş UUID kimliği';


--
-- Name: mv_products; Type: MATERIALIZED VIEW; Schema: catalog; Owner: -
--

CREATE MATERIALIZED VIEW catalog.mv_products AS
 SELECT p.id,
    p.feed_id,
    p.source_product_id,
    p.source_product_group_id,
    p.title,
    p.slug,
    p.slug_id,
    p.custom_sku,
    p.short_description,
    p.description,
    p.brand_id,
    p.category_id,
    p.gender,
    p.season,
    COALESCE(fab.fabric_name, 'Polyester'::character varying) AS kumas_fabric,
    p.desi_volume,
    p.shipping_weight_kg,
    p.packing_ratio,
    p.series_ratio,
    p.minimum_order_quantity,
    p.price,
    p.discounted_price,
    p.single_price,
    p.buying_price,
    p.currency,
    p.tax_rate,
    COALESCE(col.color_name, 'Standart'::character varying) AS color,
    p.stock,
    p.sku,
    p.barcode,
    p.is_active,
    p.created_at,
    p.updated_at,
    b.brand_name,
    c.title AS category_title,
    c.node_path,
    COALESCE(( SELECT json_agg(json_build_object('id', img.id, 'product_id', img.product_id, 'image_url', img.image_url, 'sort_order', img.sort_order, 'is_cover', img.is_cover) ORDER BY img.sort_order) AS json_agg
           FROM catalog.product_images img
          WHERE (img.product_id = p.id)), '[]'::json) AS images_json,
    COALESCE(( SELECT json_object_agg(t.language_code, json_build_object('title', t.title, 'short_description', t.short_description, 'description', t.description)) AS json_object_agg
           FROM catalog.product_translations t
          WHERE (t.product_id = p.id)), '{}'::json) AS translations_json
   FROM ((((catalog.products p
     JOIN catalog.brands b ON (((p.brand_id = b.id) AND (b.is_active = true))))
     LEFT JOIN catalog.categories c ON ((p.category_id = c.id)))
     LEFT JOIN catalog.colors col ON ((p.color_id = col.id)))
     LEFT JOIN catalog.fabrics fab ON ((p.fabric_id = fab.id)))
  WHERE (p.is_active = true)
  WITH NO DATA;


--
-- Name: newsletter_campaigns; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.newsletter_campaigns (
    id uuid DEFAULT uuidv7() NOT NULL,
    subject character varying(255) NOT NULL,
    target_lang character varying(10) DEFAULT 'all'::character varying NOT NULL,
    content_summary text DEFAULT ''::text NOT NULL,
    sponsor_brand_id uuid,
    recipient_count integer DEFAULT 0 NOT NULL,
    status character varying(32) DEFAULT 'SENT'::character varying NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: newsletter_subscribers; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.newsletter_subscribers (
    id uuid DEFAULT uuidv7() NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(150) DEFAULT ''::character varying NOT NULL,
    company_name character varying(200) DEFAULT ''::character varying NOT NULL,
    country character varying(100) DEFAULT ''::character varying NOT NULL,
    preferred_lang character varying(10) DEFAULT 'tr'::character varying NOT NULL,
    interested_categories character varying(255) DEFAULT ''::character varying NOT NULL,
    kvkk_consent boolean DEFAULT true NOT NULL,
    commercial_consent boolean DEFAULT true NOT NULL,
    consent_ip character varying(64) DEFAULT ''::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    unsubscribed_at timestamp with time zone
);


--
-- Name: order_items; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.order_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_id uuid NOT NULL,
    product_id uuid,
    product_name character varying(255) NOT NULL,
    product_sku character varying(100),
    quantity integer NOT NULL,
    price_at_purchase numeric(12,2) NOT NULL,
    image_url_at_purchase text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL
);


--
-- Name: order_number_seq; Type: SEQUENCE; Schema: catalog; Owner: -
--

CREATE SEQUENCE catalog.order_number_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: orders; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.orders (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_number character varying(30) NOT NULL,
    user_id character varying(255),
    total_amount numeric(12,2) NOT NULL,
    payment_method character varying(30) DEFAULT 'BANK_TRANSFER'::character varying,
    order_status character varying(30) DEFAULT 'PENDING_PAYMENT'::character varying NOT NULL,
    billing_address text,
    delivery_address text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    customer_name character varying(255) DEFAULT ''::character varying NOT NULL,
    customer_company character varying(255) DEFAULT ''::character varying NOT NULL,
    customer_phone character varying(60) DEFAULT ''::character varying NOT NULL,
    customer_email character varying(255) DEFAULT ''::character varying NOT NULL,
    notes text,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL,
    customer_currency character varying(10) DEFAULT ''::character varying NOT NULL,
    customer_total_amount numeric(14,2) DEFAULT 0.00 NOT NULL,
    total_amount_try numeric(14,2) DEFAULT 0.00 NOT NULL,
    currency_totals jsonb DEFAULT '{}'::jsonb NOT NULL
);


--
-- Name: page_translations; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.page_translations (
    page_id uuid NOT NULL,
    language_code character varying(10) NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    meta_title character varying(255),
    meta_description text
);


--
-- Name: pages; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.pages (
    id uuid DEFAULT uuidv7() NOT NULL,
    slug character varying(150) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: payment_notifications; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.payment_notifications (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    bank_name character varying(100) NOT NULL,
    sender_name character varying(150) NOT NULL,
    amount numeric(12,2) NOT NULL,
    notification_status character varying(20) DEFAULT 'PENDING'::character varying,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL
);


--
-- Name: product_ai_content; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.product_ai_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid,
    ai_engine character varying(50) NOT NULL,
    content_hash character varying(64) NOT NULL,
    original_title character varying(255),
    original_description text,
    original_fabric character varying(255),
    original_gender character varying(50),
    seo_title character varying(255),
    seo_description text,
    meta_title character varying(255),
    meta_description text,
    tags jsonb,
    highlights jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: product_attributes_map; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.product_attributes_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    product_id uuid NOT NULL,
    attribute_value_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: product_deletion_logs; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.product_deletion_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    product_id uuid,
    brand_id uuid,
    sku character varying(120) DEFAULT ''::character varying NOT NULL,
    title character varying(300) DEFAULT ''::character varying NOT NULL,
    deletion_mode character varying(20) DEFAULT 'hard'::character varying NOT NULL,
    actor_type character varying(30) DEFAULT 'supplier'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: product_variants; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.product_variants (
    id uuid DEFAULT uuidv7() NOT NULL,
    product_id uuid NOT NULL,
    variant_size character varying(50) CONSTRAINT product_variants_size_not_null NOT NULL,
    barcode character varying(100),
    stock integer DEFAULT 0 NOT NULL,
    is_single boolean DEFAULT false NOT NULL,
    source_variant_id character varying(100) NOT NULL,
    custom_sku character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_sync_run_id uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: refund_items; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.refund_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    refund_id uuid NOT NULL,
    order_item_id uuid NOT NULL,
    quantity integer NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: refunds; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.refunds (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_id uuid NOT NULL,
    user_id character varying(255) NOT NULL,
    refund_type character varying(20) NOT NULL,
    refund_status character varying(20) DEFAULT 'REQUESTED'::character varying,
    reason text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: series_templates; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.series_templates (
    id uuid DEFAULT uuidv7() NOT NULL,
    template_key character varying(64) NOT NULL,
    name character varying(120) NOT NULL,
    category_hint character varying(80) DEFAULT 'Genel'::character varying NOT NULL,
    sizes text[] NOT NULL,
    series_ratio character varying(50) DEFAULT '1-1-1-1'::character varying NOT NULL,
    units_per_series integer DEFAULT 4 NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: service_providers; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.service_providers (
    id uuid DEFAULT uuidv7() NOT NULL,
    slug character varying(180) NOT NULL,
    company_name character varying(200) NOT NULL,
    service_category character varying(64) DEFAULT 'kargo_lojistik'::character varying NOT NULL,
    short_description character varying(300) DEFAULT ''::character varying NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    services_offered text DEFAULT ''::text NOT NULL,
    target_countries character varying(255) DEFAULT ''::character varying NOT NULL,
    city character varying(100) DEFAULT 'İstanbul'::character varying NOT NULL,
    district character varying(100) DEFAULT 'Merter'::character varying NOT NULL,
    address text DEFAULT ''::text NOT NULL,
    phone character varying(64) DEFAULT ''::character varying NOT NULL,
    whatsapp_phone character varying(64) DEFAULT ''::character varying NOT NULL,
    email character varying(180) DEFAULT ''::character varying NOT NULL,
    website character varying(255) DEFAULT ''::character varying NOT NULL,
    logo_url text DEFAULT ''::text NOT NULL,
    is_verified boolean DEFAULT true NOT NULL,
    is_sponsored boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    priority integer DEFAULT 10 NOT NULL,
    view_count bigint DEFAULT 0 NOT NULL,
    whatsapp_click_count bigint DEFAULT 0 NOT NULL,
    translations jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    contact_name character varying(150) DEFAULT ''::character varying NOT NULL,
    status character varying(32) DEFAULT 'pending'::character varying NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    verification_token character varying(128),
    verification_expires_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: settings; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.settings (
    id uuid DEFAULT uuidv7() NOT NULL,
    address text NOT NULL,
    phone character varying(50) NOT NULL,
    whatsapp character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    singleton_guard boolean DEFAULT true,
    show_single_price boolean DEFAULT true NOT NULL,
    show_prices_to_guests boolean DEFAULT false NOT NULL,
    recaptcha_enabled boolean DEFAULT true NOT NULL,
    recaptcha_site_key text DEFAULT ''::text NOT NULL,
    recaptcha_secret_key text DEFAULT ''::text NOT NULL,
    CONSTRAINT settings_singleton_guard_check CHECK ((singleton_guard = true))
);


--
-- Name: size_definitions; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.size_definitions (
    id uuid DEFAULT uuidv7() NOT NULL,
    code character varying(32) NOT NULL,
    label character varying(64) NOT NULL,
    size_group character varying(32) DEFAULT 'letter'::character varying NOT NULL,
    sort_order integer DEFAULT 100 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: sponsored_slots; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.sponsored_slots (
    id uuid DEFAULT uuidv7() NOT NULL,
    placement character varying(64) DEFAULT 'home_featured_suppliers'::character varying NOT NULL,
    brand_id uuid,
    category_slug character varying(150) DEFAULT ''::character varying NOT NULL,
    title character varying(255) NOT NULL,
    subtitle character varying(255) DEFAULT ''::character varying NOT NULL,
    badge_text character varying(80) DEFAULT 'SPONSORLU ÜRETİCİ'::character varying NOT NULL,
    image_url text DEFAULT ''::text NOT NULL,
    cta_text character varying(100) DEFAULT 'Koleksiyonu İncele'::character varying NOT NULL,
    target_url text DEFAULT ''::text NOT NULL,
    translations jsonb DEFAULT '{}'::jsonb NOT NULL,
    priority integer DEFAULT 10 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    starts_at timestamp with time zone,
    ends_at timestamp with time zone,
    impression_count bigint DEFAULT 0 NOT NULL,
    click_count bigint DEFAULT 0 NOT NULL,
    fee_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: store_inquiries; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.store_inquiries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    full_name character varying(100) NOT NULL,
    company character varying(100),
    phone character varying(50) NOT NULL,
    email character varying(100) NOT NULL,
    message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: store_inquiry_items; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.store_inquiry_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    inquiry_id uuid NOT NULL,
    product_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    custom_sku character varying(100) NOT NULL,
    quantity integer NOT NULL,
    price numeric(12,2) NOT NULL
);


--
-- Name: story_settings; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.story_settings (
    singleton_guard boolean DEFAULT true NOT NULL,
    is_paid_mode boolean DEFAULT false NOT NULL,
    paid_daily_limit integer DEFAULT 8 NOT NULL,
    free_daily_limit integer DEFAULT 8 NOT NULL,
    story_ttl_hours integer DEFAULT 24 NOT NULL,
    monthly_addon_price_try numeric(12,2) DEFAULT 990.00 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT story_settings_free_daily_limit_check CHECK (((free_daily_limit >= 0) AND (free_daily_limit <= 50))),
    CONSTRAINT story_settings_monthly_addon_price_try_check CHECK ((monthly_addon_price_try >= (0)::numeric)),
    CONSTRAINT story_settings_paid_daily_limit_check CHECK (((paid_daily_limit >= 1) AND (paid_daily_limit <= 50))),
    CONSTRAINT story_settings_singleton_guard_check CHECK ((singleton_guard = true)),
    CONSTRAINT story_settings_story_ttl_hours_check CHECK (((story_ttl_hours >= 1) AND (story_ttl_hours <= 168)))
);


--
-- Name: subscription_plans; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.subscription_plans (
    id uuid DEFAULT uuidv7() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(150) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    monthly_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    yearly_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL,
    tax_rate numeric(5,2) DEFAULT 20.00 NOT NULL,
    max_products integer DEFAULT '-1'::integer NOT NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    display_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supplier_accounting_ledger; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_accounting_ledger (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid NOT NULL,
    invoice_id uuid,
    payment_id uuid,
    entry_type character varying(40) NOT NULL,
    debit_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    credit_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    running_balance numeric(14,2) DEFAULT 0.00 NOT NULL,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supplier_applications; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_applications (
    id uuid DEFAULT uuidv7() NOT NULL,
    company_name character varying(150) NOT NULL,
    contact_name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(50) NOT NULL,
    city character varying(100),
    category character varying(100),
    instagram character varying(150),
    website character varying(200),
    notes text,
    status character varying(30) DEFAULT 'pending'::character varying NOT NULL,
    admin_notes text,
    ip_address character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    verification_token character varying(100),
    verification_expires_at timestamp with time zone,
    email_verified boolean DEFAULT false NOT NULL,
    verified_at timestamp with time zone,
    district character varying(100),
    legal_terms_accepted boolean DEFAULT false NOT NULL,
    legal_terms_accepted_at timestamp with time zone,
    legal_terms_version integer
);


--
-- Name: TABLE supplier_applications; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.supplier_applications IS 'Toptancı tedarikçi adaylarının vitrinden yaptığı başvurular';


--
-- Name: supplier_invoices; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_invoices (
    id uuid DEFAULT uuidv7() NOT NULL,
    invoice_number character varying(50) NOT NULL,
    brand_id uuid NOT NULL,
    subscription_id uuid,
    invoice_type character varying(40) DEFAULT 'SUBSCRIPTION'::character varying NOT NULL,
    plan_code character varying(50) DEFAULT 'PRO'::character varying NOT NULL,
    period_label character varying(120) DEFAULT ''::character varying NOT NULL,
    subtotal_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    tax_rate numeric(5,2) DEFAULT 20.00 NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    discount_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    total_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    paid_amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL,
    status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    billing_company_title character varying(255) DEFAULT ''::character varying NOT NULL,
    tax_office character varying(150) DEFAULT ''::character varying NOT NULL,
    tax_number character varying(50) DEFAULT ''::character varying NOT NULL,
    billing_address text DEFAULT ''::text NOT NULL,
    issue_date timestamp with time zone DEFAULT now() NOT NULL,
    due_date timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    paid_at timestamp with time zone,
    pdf_url text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supplier_ledger; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_ledger (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid NOT NULL,
    sub_order_id uuid,
    payout_request_id uuid,
    transaction_type character varying(32) NOT NULL,
    amount numeric(15,2) NOT NULL,
    balance_after numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'TRY'::character varying NOT NULL,
    description text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: supplier_payout_requests; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_payout_requests (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'TRY'::character varying NOT NULL,
    status character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    iban character varying(50) NOT NULL,
    bank_name character varying(100),
    account_holder character varying(255) NOT NULL,
    admin_notes text,
    processed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: supplier_stories; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_stories (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid NOT NULL,
    created_by_role character varying(20) DEFAULT 'supplier'::character varying NOT NULL,
    created_by_user_id character varying(255),
    media_url text NOT NULL,
    media_type character varying(20) DEFAULT 'image'::character varying NOT NULL,
    caption text DEFAULT ''::text NOT NULL,
    cta_label character varying(80) DEFAULT ''::character varying NOT NULL,
    cta_url text DEFAULT ''::text NOT NULL,
    linked_product_id uuid,
    bg_color character varying(32) DEFAULT '#111111'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    click_count integer DEFAULT 0 NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    CONSTRAINT supplier_stories_created_by_role_check CHECK (((created_by_role)::text = ANY ((ARRAY['supplier'::character varying, 'admin'::character varying])::text[]))),
    CONSTRAINT supplier_stories_media_type_check CHECK (((media_type)::text = 'image'::text))
);


--
-- Name: supplier_sub_order_items; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_sub_order_items (
    id uuid DEFAULT uuidv7() NOT NULL,
    sub_order_id uuid NOT NULL,
    product_id uuid NOT NULL,
    product_name character varying(255) NOT NULL,
    product_sku character varying(100) NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price_at_purchase numeric(15,2) NOT NULL,
    total_price numeric(15,2) NOT NULL,
    image_url character varying(500),
    series_ratio character varying(50),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL
);


--
-- Name: supplier_sub_orders; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_sub_orders (
    id uuid DEFAULT uuidv7() NOT NULL,
    order_id uuid,
    brand_id uuid NOT NULL,
    sub_order_number character varying(64) NOT NULL,
    gross_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    commission_rate numeric(5,2) DEFAULT 0.00 NOT NULL,
    commission_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    net_payout_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    currency character varying(3) DEFAULT 'TRY'::character varying NOT NULL,
    status character varying(32) DEFAULT 'PENDING'::character varying NOT NULL,
    tracking_company character varying(100),
    tracking_number character varying(128),
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    customer_name character varying(255) DEFAULT ''::character varying NOT NULL,
    customer_company character varying(255) DEFAULT ''::character varying NOT NULL,
    customer_phone character varying(60) DEFAULT ''::character varying NOT NULL,
    customer_email character varying(255) DEFAULT ''::character varying NOT NULL,
    delivery_address text DEFAULT ''::text NOT NULL,
    billing_address text DEFAULT ''::text NOT NULL
);


--
-- Name: supplier_subscription_payments; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_subscription_payments (
    id uuid DEFAULT uuidv7() NOT NULL,
    payment_number character varying(50) NOT NULL,
    brand_id uuid NOT NULL,
    invoice_id uuid,
    plan_code character varying(50) DEFAULT 'PRO'::character varying NOT NULL,
    period_months integer DEFAULT 1 NOT NULL,
    amount numeric(12,2) DEFAULT 0.00 NOT NULL,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL,
    payment_method character varying(40) DEFAULT 'BANK_TRANSFER'::character varying NOT NULL,
    status character varying(30) DEFAULT 'COMPLETED'::character varying NOT NULL,
    sender_name character varying(255) DEFAULT ''::character varying NOT NULL,
    bank_reference character varying(150) DEFAULT ''::character varying NOT NULL,
    receipt_url text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    approved_by character varying(150) DEFAULT ''::character varying NOT NULL,
    paid_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: supplier_subscriptions; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_subscriptions (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid NOT NULL,
    plan_id uuid,
    plan_code character varying(50) DEFAULT 'FREE'::character varying NOT NULL,
    billing_cycle character varying(20) DEFAULT 'MONTHLY'::character varying NOT NULL,
    status character varying(30) DEFAULT 'ACTIVE'::character varying NOT NULL,
    is_complimentary boolean DEFAULT true NOT NULL,
    agreed_price numeric(12,2) DEFAULT 0.00 NOT NULL,
    currency character varying(10) DEFAULT 'TRY'::character varying NOT NULL,
    current_period_start timestamp with time zone DEFAULT now() NOT NULL,
    current_period_end timestamp with time zone DEFAULT (now() + '1 year'::interval) NOT NULL,
    next_billing_date timestamp with time zone,
    auto_renew boolean DEFAULT true NOT NULL,
    total_paid_amount numeric(14,2) DEFAULT 0.00 NOT NULL,
    total_invoiced_amount numeric(14,2) DEFAULT 0.00 NOT NULL,
    outstanding_balance numeric(14,2) DEFAULT 0.00 NOT NULL,
    billing_company_title character varying(255) DEFAULT ''::character varying NOT NULL,
    tax_office character varying(150) DEFAULT ''::character varying NOT NULL,
    tax_number character varying(50) DEFAULT ''::character varying NOT NULL,
    billing_address text DEFAULT ''::text NOT NULL,
    billing_email character varying(255) DEFAULT ''::character varying NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    story_entitlement_override boolean,
    story_daily_limit_override integer,
    CONSTRAINT chk_supplier_subscriptions_story_daily_limit CHECK (((story_daily_limit_override IS NULL) OR ((story_daily_limit_override >= 1) AND (story_daily_limit_override <= 50))))
);


--
-- Name: supplier_users; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_users (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid NOT NULL,
    email character varying(150) NOT NULL,
    password_hash character varying(255),
    contact_name character varying(100) NOT NULL,
    phone character varying(50),
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    keycloak_id character varying(100),
    job_title character varying(100) DEFAULT 'Satış Temsilcisi'::character varying NOT NULL,
    spoken_languages character varying(100) DEFAULT 'TR'::character varying NOT NULL,
    is_owner boolean DEFAULT false NOT NULL,
    setup_token character varying(100),
    setup_token_expires_at timestamp with time zone
);


--
-- Name: TABLE supplier_users; Type: COMMENT; Schema: catalog; Owner: -
--

COMMENT ON TABLE catalog.supplier_users IS 'Tedarikçilerin kendi ürünlerini yönetmek için kullandığı yetkili kullanıcı hesapları';


--
-- Name: supplier_wallets; Type: TABLE; Schema: catalog; Owner: -
--

CREATE TABLE catalog.supplier_wallets (
    id uuid DEFAULT uuidv7() NOT NULL,
    brand_id uuid NOT NULL,
    currency character varying(3) DEFAULT 'TRY'::character varying NOT NULL,
    pending_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    available_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    withdrawn_balance numeric(15,2) DEFAULT 0.00 NOT NULL,
    commission_rate numeric(5,2) DEFAULT 0.00 NOT NULL,
    iban character varying(50),
    bank_name character varying(100),
    bank_account_holder character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: consent_ledger; Type: TABLE; Schema: compliance; Owner: -
--

CREATE TABLE compliance.consent_ledger (
    seq_no bigint NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL,
    consent_ref_id character varying(32) NOT NULL,
    subject_id character varying(128) NOT NULL,
    visitor_id character varying(128),
    user_id character varying(128),
    user_email_hash character(64),
    supersedes_consent_id uuid,
    action character varying(32) NOT NULL,
    model character varying(24) DEFAULT 'opt-in'::character varying NOT NULL,
    ui_source character varying(32) DEFAULT 'banner'::character varying NOT NULL,
    given_consents jsonb NOT NULL,
    google_consent_mode jsonb DEFAULT '{}'::jsonb NOT NULL,
    tcf_tc_string text,
    addtl_consent text,
    gpc_signal boolean DEFAULT false NOT NULL,
    policy_snapshot_id uuid NOT NULL,
    policy_snapshot_hash character(64) NOT NULL,
    language character varying(10) NOT NULL,
    country_code character varying(8),
    ip_masked character varying(64),
    ip_hash_sha256 character(64),
    user_agent_hash character(64),
    page_url text,
    canonical_payload text NOT NULL,
    payload_sha256 character(64) NOT NULL,
    prev_hash character(64) NOT NULL,
    entry_hash character(64) NOT NULL,
    server_hmac_sha256 character(64) NOT NULL,
    recorded_at_utc timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT consent_ledger_action_check CHECK (((action)::text = ANY ((ARRAY['accept_all'::character varying, 'reject_all'::character varying, 'custom'::character varying, 'withdraw'::character varying])::text[])))
);


--
-- Name: consent_ledger_seq_no_seq; Type: SEQUENCE; Schema: compliance; Owner: -
--

CREATE SEQUENCE compliance.consent_ledger_seq_no_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consent_ledger_seq_no_seq; Type: SEQUENCE OWNED BY; Schema: compliance; Owner: -
--

ALTER SEQUENCE compliance.consent_ledger_seq_no_seq OWNED BY compliance.consent_ledger.seq_no;


--
-- Name: consent_merkle_anchors; Type: TABLE; Schema: compliance; Owner: -
--

CREATE TABLE compliance.consent_merkle_anchors (
    anchor_seq bigint NOT NULL,
    id uuid DEFAULT uuidv7() NOT NULL,
    seq_from bigint NOT NULL,
    seq_to bigint NOT NULL,
    record_count integer NOT NULL,
    merkle_root character(64) NOT NULL,
    prev_anchor_hash character(64) NOT NULL,
    anchor_chain_hash character(64) NOT NULL,
    tsa_provider character varying(120) NOT NULL,
    tsa_url character varying(255) NOT NULL,
    tsa_status character varying(32) NOT NULL,
    tsa_gen_time_utc timestamp with time zone,
    tsa_serial_hex character varying(128),
    tsa_policy_oid character varying(128),
    tsa_token_base64 text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: consent_merkle_anchors_anchor_seq_seq; Type: SEQUENCE; Schema: compliance; Owner: -
--

CREATE SEQUENCE compliance.consent_merkle_anchors_anchor_seq_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: consent_merkle_anchors_anchor_seq_seq; Type: SEQUENCE OWNED BY; Schema: compliance; Owner: -
--

ALTER SEQUENCE compliance.consent_merkle_anchors_anchor_seq_seq OWNED BY compliance.consent_merkle_anchors.anchor_seq;


--
-- Name: consent_policy_snapshots; Type: TABLE; Schema: compliance; Owner: -
--

CREATE TABLE compliance.consent_policy_snapshots (
    id uuid DEFAULT uuidv7() NOT NULL,
    content_sha256 character(64) NOT NULL,
    policy_version integer DEFAULT 1 NOT NULL,
    language character varying(10) NOT NULL,
    banner_copy jsonb DEFAULT '{}'::jsonb NOT NULL,
    cookie_inventory_snapshot jsonb DEFAULT '[]'::jsonb NOT NULL,
    legal_policy_text text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: consent_settings; Type: TABLE; Schema: compliance; Owner: -
--

CREATE TABLE compliance.consent_settings (
    id integer NOT NULL,
    banner_enabled boolean DEFAULT true NOT NULL,
    banner_layout character varying(24) DEFAULT 'floating'::character varying NOT NULL,
    floating_trigger_enabled boolean DEFAULT true NOT NULL,
    ga_measurement_id character varying(64) DEFAULT 'G-CNMNCL62Q2'::character varying NOT NULL,
    google_consent_mode character varying(24) DEFAULT 'always'::character varying NOT NULL,
    reconsent_days integer DEFAULT 365 NOT NULL,
    iab_enabled boolean DEFAULT false NOT NULL,
    iab_cmp_id integer DEFAULT 0 NOT NULL,
    tsa_primary_url character varying(255) DEFAULT 'http://timestamp.digicert.com'::character varying NOT NULL,
    tsa_fallback_urls jsonb DEFAULT '["http://timestamp.sectigo.com", "https://freetsa.org/tsr"]'::jsonb NOT NULL,
    auto_anchor_interval_min integer DEFAULT 15 NOT NULL,
    strict_opt_in_countries jsonb DEFAULT '["TR", "EU", "EEA", "GB", "CH"]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT consent_settings_id_check CHECK ((id = 1))
);


--
-- Name: cookie_inventory; Type: TABLE; Schema: compliance; Owner: -
--

CREATE TABLE compliance.cookie_inventory (
    id uuid DEFAULT uuidv7() NOT NULL,
    cookie_name character varying(128) NOT NULL,
    category character varying(32) NOT NULL,
    provider character varying(128) NOT NULL,
    domain character varying(180) DEFAULT 'mertervitrini.com.tr'::character varying NOT NULL,
    storage_type character varying(32) DEFAULT 'cookie'::character varying NOT NULL,
    duration character varying(120) DEFAULT 'Oturum / Session'::character varying NOT NULL,
    is_third_party boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    source character varying(32) DEFAULT 'manual'::character varying NOT NULL,
    purpose_translations jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_seen_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cookie_inventory_category_check CHECK (((category)::text = ANY ((ARRAY['necessary'::character varying, 'functionality'::character varying, 'experience'::character varying, 'measurement'::character varying, 'marketing'::character varying])::text[]))),
    CONSTRAINT cookie_inventory_source_check CHECK (((source)::text = ANY ((ARRAY['manual'::character varying, 'auto_scan'::character varying])::text[]))),
    CONSTRAINT cookie_inventory_storage_type_check CHECK (((storage_type)::text = ANY ((ARRAY['cookie'::character varying, 'localStorage'::character varying, 'sessionStorage'::character varying, 'script'::character varying])::text[])))
);


--
-- Name: cookie_scan_runs; Type: TABLE; Schema: compliance; Owner: -
--

CREATE TABLE compliance.cookie_scan_runs (
    id uuid DEFAULT uuidv7() NOT NULL,
    triggered_by character varying(128),
    scanned_urls jsonb DEFAULT '[]'::jsonb NOT NULL,
    detected_count integer DEFAULT 0 NOT NULL,
    new_cookies_count integer DEFAULT 0 NOT NULL,
    findings jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: account_deletion_requests; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.account_deletion_requests (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id character varying(255) NOT NULL,
    user_role character varying(30) NOT NULL,
    email character varying(150) NOT NULL,
    reason text,
    status character varying(30) DEFAULT 'COMPLETED'::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL,
    processed_at timestamp with time zone
);


--
-- Name: exception_alert_config; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.exception_alert_config (
    id integer NOT NULL,
    alert_on_panic boolean DEFAULT true NOT NULL,
    alert_on_http_5xx boolean DEFAULT true NOT NULL,
    alert_on_error_logs boolean DEFAULT true NOT NULL,
    burst_threshold integer DEFAULT 5 NOT NULL,
    window_minutes integer DEFAULT 5 NOT NULL,
    cooldown_minutes integer DEFAULT 15 NOT NULL,
    max_emails_per_hour integer DEFAULT 6 NOT NULL,
    ignored_patterns jsonb DEFAULT '["Failed to find Server Action", "context canceled", "broken pipe", "connection reset by peer"]'::jsonb NOT NULL,
    updated_by character varying(150),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT exception_alert_config_id_check CHECK ((id = 1))
);


--
-- Name: impersonation_logs; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.impersonation_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    admin_user_id character varying(255) DEFAULT ''::character varying NOT NULL,
    admin_email character varying(150) DEFAULT ''::character varying NOT NULL,
    admin_role character varying(50) DEFAULT ''::character varying NOT NULL,
    customer_id character varying(255) NOT NULL,
    customer_email character varying(150) DEFAULT ''::character varying NOT NULL,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL,
    user_agent character varying(512) DEFAULT ''::character varying NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: mobile_devices; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.mobile_devices (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id character varying(255) NOT NULL,
    user_role character varying(30) NOT NULL,
    fcm_token text DEFAULT ''::text NOT NULL,
    platform character varying(20) DEFAULT 'android'::character varying NOT NULL,
    device_model character varying(120),
    app_version character varying(30),
    language_code character varying(10) DEFAULT 'tr'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    brand_id uuid,
    device_token text DEFAULT ''::text NOT NULL,
    locale character varying(10) DEFAULT 'tr'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT mobile_devices_user_role_check CHECK (((user_role)::text = ANY ((ARRAY['customer'::character varying, 'supplier'::character varying])::text[])))
);


--
-- Name: notification_logs; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.notification_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    event_key character varying(50) NOT NULL,
    subject character varying(300) NOT NULL,
    to_emails text[] DEFAULT ARRAY[]::text[] NOT NULL,
    cc_emails text[] DEFAULT ARRAY[]::text[] NOT NULL,
    status character varying(20) NOT NULL,
    error_message text DEFAULT ''::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: notification_settings; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.notification_settings (
    event_key character varying(50) NOT NULL,
    title character varying(150) NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    to_emails text[] DEFAULT ARRAY['kankayaibrahim@gmail.com'::text, 'carnavaltedarik@gmail.com'::text] NOT NULL,
    cc_emails text[] DEFAULT ARRAY[]::text[] NOT NULL,
    schedule_hour smallint DEFAULT 21 NOT NULL,
    schedule_minute smallint DEFAULT 0 NOT NULL,
    last_sent_date character varying(10),
    updated_by character varying(150),
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: system_exception_logs; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.system_exception_logs (
    id uuid DEFAULT uuidv7() NOT NULL,
    severity character varying(20) DEFAULT 'error'::character varying NOT NULL,
    source character varying(120) DEFAULT 'backend'::character varying NOT NULL,
    message text NOT NULL,
    stack_trace text DEFAULT ''::text NOT NULL,
    fingerprint character varying(64) NOT NULL,
    occurrence_count integer DEFAULT 1 NOT NULL,
    is_resolved boolean DEFAULT false NOT NULL,
    first_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: system_log_watermarks; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.system_log_watermarks (
    source character varying(64) NOT NULL,
    cleared_after timestamp with time zone DEFAULT now() NOT NULL,
    cleared_by character varying(150) DEFAULT ''::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_addresses; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.user_addresses (
    id uuid DEFAULT uuidv7() NOT NULL,
    user_id character varying(100) NOT NULL,
    title character varying(100) NOT NULL,
    address_type character varying(20) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    company_name character varying(150),
    phone character varying(50) NOT NULL,
    country_id uuid NOT NULL,
    state_id uuid,
    address_line character varying(500) NOT NULL,
    tax_no_tckn character varying(50),
    tax_office character varying(100),
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    postal_code character varying(30) DEFAULT ''::character varying NOT NULL,
    city_id uuid,
    CONSTRAINT user_addresses_address_type_check CHECK (((address_type)::text = ANY ((ARRAY['billing'::character varying, 'shipping'::character varying])::text[])))
);


--
-- Name: user_login_history; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.user_login_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying(255) NOT NULL,
    login_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    ip_address character varying(50) NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: identity; Owner: -
--

CREATE TABLE identity.users (
    id character varying(100) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    email character varying(150) NOT NULL,
    phone character varying(50),
    user_role character varying(50) DEFAULT 'customer'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_blocked boolean DEFAULT false NOT NULL,
    block_reason character varying(255),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    preferred_lang character varying(10) DEFAULT 'tr'::character varying,
    preferred_currency character varying(3) DEFAULT 'TRY'::character varying,
    billing_address text,
    delivery_address text,
    tax_no_tckn character varying(50),
    instagram_username character varying(100),
    registration_ip character varying(50),
    email_verified boolean DEFAULT false,
    email_verification_token character varying(128),
    email_verification_expires_at timestamp with time zone,
    email_verified_at timestamp with time zone,
    country_code character varying(8),
    country_name character varying(120),
    city character varying(120),
    region_name character varying(120),
    latitude double precision,
    longitude double precision,
    geo_source character varying(40),
    geo_resolved_at timestamp with time zone,
    terms_accepted boolean DEFAULT false NOT NULL,
    terms_accepted_at timestamp with time zone,
    terms_accepted_version integer
);


--
-- Name: cron_logs; Type: TABLE; Schema: integration; Owner: -
--

CREATE TABLE integration.cron_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    status character varying(50) NOT NULL,
    summary jsonb
);


--
-- Name: cron_settings; Type: TABLE; Schema: integration; Owner: -
--

CREATE TABLE integration.cron_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    run_hour integer DEFAULT 23 NOT NULL,
    run_minute integer DEFAULT 0 NOT NULL,
    last_run_at timestamp with time zone,
    next_run_at timestamp with time zone,
    current_status character varying(50) DEFAULT 'idle'::character varying NOT NULL,
    last_run_status character varying(50) DEFAULT 'never_run'::character varying NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    singleton_guard boolean DEFAULT true,
    CONSTRAINT cron_settings_singleton_guard_check CHECK ((singleton_guard = true))
);


--
-- Name: sync_runs; Type: TABLE; Schema: integration; Owner: -
--

CREATE TABLE integration.sync_runs (
    id uuid DEFAULT uuidv7() NOT NULL,
    feed_id character varying(50) NOT NULL,
    started_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at timestamp with time zone,
    status character varying(20) DEFAULT 'running'::character varying NOT NULL,
    summary jsonb
);


--
-- Name: TABLE sync_runs; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON TABLE integration.sync_runs IS 'XML veri beslemelerinin periyodik çalışma geçmişi ve özet istatistik kayıtları';


--
-- Name: COLUMN sync_runs.id; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.sync_runs.id IS 'Senkronizasyon oturumunun benzersiz kimliği (UUIDv7 formatında)';


--
-- Name: COLUMN sync_runs.feed_id; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.sync_runs.feed_id IS 'Hangi toptancı XML kaynağının çalıştırıldığı bilgisi (Foreign Key)';


--
-- Name: COLUMN sync_runs.started_at; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.sync_runs.started_at IS 'Senkronizasyonun başlama zaman damgası';


--
-- Name: COLUMN sync_runs.completed_at; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.sync_runs.completed_at IS 'Senkronizasyonun bittiği zaman damgası';


--
-- Name: COLUMN sync_runs.status; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.sync_runs.status IS 'Senkronizasyonun durumu (running: devam ediyor, success: başarılı, failed: hata oluştu)';


--
-- Name: COLUMN sync_runs.summary; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.sync_runs.summary IS 'Eklenen, güncellenen ve devredışı bırakılan ürün/varyant sayılarını tutan JSON özeti';


--
-- Name: xml_feeds; Type: TABLE; Schema: integration; Owner: -
--

CREATE TABLE integration.xml_feeds (
    id character varying(50) NOT NULL,
    feed_name character varying(100) CONSTRAINT xml_feeds_name_not_null NOT NULL,
    alias_code character varying(50) NOT NULL,
    feed_url character varying(255),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    brand_id uuid,
    mapping_config jsonb,
    category_mapping jsonb
);


--
-- Name: TABLE xml_feeds; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON TABLE integration.xml_feeds IS 'Toptancı entegrasyonu için tanımlanmış aktif/pasif XML veri beslemeleri';


--
-- Name: COLUMN xml_feeds.id; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.xml_feeds.id IS 'Entegrasyon kaynağı benzersiz kısa kodu (örn: lustrin, etika, blackfashion, janes)';


--
-- Name: COLUMN xml_feeds.feed_name; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.xml_feeds.feed_name IS 'Toptancı tedarikçi firma gerçek adı';


--
-- Name: COLUMN xml_feeds.alias_code; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.xml_feeds.alias_code IS 'Ön yüzde gösterilecek şifrelenmiş/maskelenmiş toptancı rumuzu (örn: Janes yerine EDUSA)';


--
-- Name: COLUMN xml_feeds.feed_url; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.xml_feeds.feed_url IS 'XML beslemesinin uzak bağlantı URL adresi';


--
-- Name: COLUMN xml_feeds.is_active; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.xml_feeds.is_active IS 'Entegrasyon beslemesinin aktiflik durumu';


--
-- Name: COLUMN xml_feeds.mapping_config; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.xml_feeds.mapping_config IS 'XML etiketlerini (Alanları) dahili ürün alanlarıyla eşleştiren JSONB konfigürasyonu';


--
-- Name: COLUMN xml_feeds.category_mapping; Type: COMMENT; Schema: integration; Owner: -
--

COMMENT ON COLUMN integration.xml_feeds.category_mapping IS 'XML içindeki kategori isimlerini dahili kategori UUIDlerine eşleyen JSONB tablosu';


--
-- Name: bot_crawl_logs id; Type: DEFAULT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.bot_crawl_logs ALTER COLUMN id SET DEFAULT nextval('analytics.bot_crawl_logs_id_seq'::regclass);


--
-- Name: page_views id; Type: DEFAULT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.page_views ALTER COLUMN id SET DEFAULT nextval('analytics.page_views_id_seq'::regclass);


--
-- Name: search_logs id; Type: DEFAULT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.search_logs ALTER COLUMN id SET DEFAULT nextval('analytics.search_logs_id_seq'::regclass);


--
-- Name: consent_ledger seq_no; Type: DEFAULT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_ledger ALTER COLUMN seq_no SET DEFAULT nextval('compliance.consent_ledger_seq_no_seq'::regclass);


--
-- Name: consent_merkle_anchors anchor_seq; Type: DEFAULT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_merkle_anchors ALTER COLUMN anchor_seq SET DEFAULT nextval('compliance.consent_merkle_anchors_anchor_seq_seq'::regclass);


--
-- Name: bot_crawl_hourly bot_crawl_hourly_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.bot_crawl_hourly
    ADD CONSTRAINT bot_crawl_hourly_pkey PRIMARY KEY (bucket_hour, bot_name, path, status_class);


--
-- Name: bot_crawl_logs bot_crawl_logs_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.bot_crawl_logs
    ADD CONSTRAINT bot_crawl_logs_pkey PRIMARY KEY (id);


--
-- Name: brand_events brand_events_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.brand_events
    ADD CONSTRAINT brand_events_pkey PRIMARY KEY (id);


--
-- Name: log_ingest_cursors log_ingest_cursors_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.log_ingest_cursors
    ADD CONSTRAINT log_ingest_cursors_pkey PRIMARY KEY (source_key);


--
-- Name: member_events member_events_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.member_events
    ADD CONSTRAINT member_events_pkey PRIMARY KEY (id);


--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);


--
-- Name: search_logs search_logs_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.search_logs
    ADD CONSTRAINT search_logs_pkey PRIMARY KEY (id);


--
-- Name: user_visitor_links user_visitor_links_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.user_visitor_links
    ADD CONSTRAINT user_visitor_links_pkey PRIMARY KEY (user_id, visitor_id);


--
-- Name: whatsapp_clicks whatsapp_clicks_pkey; Type: CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.whatsapp_clicks
    ADD CONSTRAINT whatsapp_clicks_pkey PRIMARY KEY (id);


--
-- Name: attribute_translations attribute_translations_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.attribute_translations
    ADD CONSTRAINT attribute_translations_pkey PRIMARY KEY (attribute_id, language_code);


--
-- Name: attribute_value_translations attribute_value_translations_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.attribute_value_translations
    ADD CONSTRAINT attribute_value_translations_pkey PRIMARY KEY (attribute_value_id, language_code);


--
-- Name: attribute_values attribute_values_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.attribute_values
    ADD CONSTRAINT attribute_values_pkey PRIMARY KEY (id);


--
-- Name: attributes attributes_name_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.attributes
    ADD CONSTRAINT attributes_name_key UNIQUE (attribute_name);


--
-- Name: attributes attributes_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.attributes
    ADD CONSTRAINT attributes_pkey PRIMARY KEY (id);


--
-- Name: blog_post_translations blog_post_translations_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.blog_post_translations
    ADD CONSTRAINT blog_post_translations_pkey PRIMARY KEY (post_id, language_code);


--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);


--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);


--
-- Name: brands brands_alias_code_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.brands
    ADD CONSTRAINT brands_alias_code_key UNIQUE (alias_code);


--
-- Name: brands brands_name_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.brands
    ADD CONSTRAINT brands_name_key UNIQUE (brand_name);


--
-- Name: brands brands_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.brands
    ADD CONSTRAINT brands_pkey PRIMARY KEY (id);


--
-- Name: brands brands_slug_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.brands
    ADD CONSTRAINT brands_slug_key UNIQUE (slug);


--
-- Name: buyer_rfq_offers buyer_rfq_offers_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.buyer_rfq_offers
    ADD CONSTRAINT buyer_rfq_offers_pkey PRIMARY KEY (id);


--
-- Name: buyer_rfqs buyer_rfqs_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.buyer_rfqs
    ADD CONSTRAINT buyer_rfqs_pkey PRIMARY KEY (id);


--
-- Name: buyer_rfqs buyer_rfqs_rfq_number_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.buyer_rfqs
    ADD CONSTRAINT buyer_rfqs_rfq_number_key UNIQUE (rfq_number);


--
-- Name: cart_items cart_items_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.cart_items
    ADD CONSTRAINT cart_items_pkey PRIMARY KEY (id);


--
-- Name: carts carts_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.carts
    ADD CONSTRAINT carts_pkey PRIMARY KEY (id);


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);


--
-- Name: category_translations category_translations_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.category_translations
    ADD CONSTRAINT category_translations_pkey PRIMARY KEY (category_id, language_code);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: chat_rooms chat_rooms_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.chat_rooms
    ADD CONSTRAINT chat_rooms_pkey PRIMARY KEY (id);


--
-- Name: color_translations color_translations_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.color_translations
    ADD CONSTRAINT color_translations_pkey PRIMARY KEY (color_id, language_code);


--
-- Name: colors colors_name_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.colors
    ADD CONSTRAINT colors_name_key UNIQUE (color_name);


--
-- Name: colors colors_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.colors
    ADD CONSTRAINT colors_pkey PRIMARY KEY (id);


--
-- Name: countries countries_code_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.countries
    ADD CONSTRAINT countries_code_key UNIQUE (code);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: country_cities country_cities_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.country_cities
    ADD CONSTRAINT country_cities_pkey PRIMARY KEY (id);


--
-- Name: country_group_memberships country_group_memberships_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.country_group_memberships
    ADD CONSTRAINT country_group_memberships_pkey PRIMARY KEY (country_id, group_id);


--
-- Name: country_groups country_groups_code_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.country_groups
    ADD CONSTRAINT country_groups_code_key UNIQUE (code);


--
-- Name: country_groups country_groups_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.country_groups
    ADD CONSTRAINT country_groups_pkey PRIMARY KEY (id);


--
-- Name: country_states country_states_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.country_states
    ADD CONSTRAINT country_states_pkey PRIMARY KEY (id);


--
-- Name: currencies currencies_name_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.currencies
    ADD CONSTRAINT currencies_name_key UNIQUE (currency_code);


--
-- Name: currencies currencies_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.currencies
    ADD CONSTRAINT currencies_pkey PRIMARY KEY (id);


--
-- Name: customer_favorite_suppliers customer_favorite_suppliers_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.customer_favorite_suppliers
    ADD CONSTRAINT customer_favorite_suppliers_pkey PRIMARY KEY (id);


--
-- Name: exchange_rates exchange_rates_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.exchange_rates
    ADD CONSTRAINT exchange_rates_pkey PRIMARY KEY (id);


--
-- Name: fabric_translations fabric_translations_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.fabric_translations
    ADD CONSTRAINT fabric_translations_pkey PRIMARY KEY (fabric_id, language_code);


--
-- Name: fabrics fabrics_name_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.fabrics
    ADD CONSTRAINT fabrics_name_key UNIQUE (fabric_name);


--
-- Name: fabrics fabrics_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.fabrics
    ADD CONSTRAINT fabrics_pkey PRIMARY KEY (id);


--
-- Name: indexnow_automation_state indexnow_automation_state_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.indexnow_automation_state
    ADD CONSTRAINT indexnow_automation_state_pkey PRIMARY KEY (singleton_guard);


--
-- Name: indexnow_logs indexnow_logs_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.indexnow_logs
    ADD CONSTRAINT indexnow_logs_pkey PRIMARY KEY (id);


--
-- Name: languages languages_code_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.languages
    ADD CONSTRAINT languages_code_key UNIQUE (code);


--
-- Name: languages languages_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.languages
    ADD CONSTRAINT languages_pkey PRIMARY KEY (id);


--
-- Name: legal_consent_logs legal_consent_logs_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.legal_consent_logs
    ADD CONSTRAINT legal_consent_logs_pkey PRIMARY KEY (id);


--
-- Name: legal_policies legal_policies_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.legal_policies
    ADD CONSTRAINT legal_policies_pkey PRIMARY KEY (id);


--
-- Name: mobile_notifications mobile_notifications_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.mobile_notifications
    ADD CONSTRAINT mobile_notifications_pkey PRIMARY KEY (id);


--
-- Name: mobile_wishlist mobile_wishlist_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.mobile_wishlist
    ADD CONSTRAINT mobile_wishlist_pkey PRIMARY KEY (id);


--
-- Name: newsletter_campaigns newsletter_campaigns_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.newsletter_campaigns
    ADD CONSTRAINT newsletter_campaigns_pkey PRIMARY KEY (id);


--
-- Name: newsletter_subscribers newsletter_subscribers_email_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_email_key UNIQUE (email);


--
-- Name: newsletter_subscribers newsletter_subscribers_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.newsletter_subscribers
    ADD CONSTRAINT newsletter_subscribers_pkey PRIMARY KEY (id);


--
-- Name: order_items order_items_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.order_items
    ADD CONSTRAINT order_items_pkey PRIMARY KEY (id);


--
-- Name: orders orders_order_number_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.orders
    ADD CONSTRAINT orders_order_number_key UNIQUE (order_number);


--
-- Name: orders orders_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.orders
    ADD CONSTRAINT orders_pkey PRIMARY KEY (id);


--
-- Name: page_translations page_translations_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.page_translations
    ADD CONSTRAINT page_translations_pkey PRIMARY KEY (page_id, language_code);


--
-- Name: pages pages_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.pages
    ADD CONSTRAINT pages_pkey PRIMARY KEY (id);


--
-- Name: pages pages_slug_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.pages
    ADD CONSTRAINT pages_slug_key UNIQUE (slug);


--
-- Name: payment_notifications payment_notifications_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.payment_notifications
    ADD CONSTRAINT payment_notifications_pkey PRIMARY KEY (id);


--
-- Name: product_ai_content product_ai_content_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_ai_content
    ADD CONSTRAINT product_ai_content_pkey PRIMARY KEY (id);


--
-- Name: product_attributes_map product_attributes_map_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_attributes_map
    ADD CONSTRAINT product_attributes_map_pkey PRIMARY KEY (id);


--
-- Name: product_deletion_logs product_deletion_logs_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_deletion_logs
    ADD CONSTRAINT product_deletion_logs_pkey PRIMARY KEY (id);


--
-- Name: product_images product_images_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_images
    ADD CONSTRAINT product_images_pkey PRIMARY KEY (id);


--
-- Name: product_translations product_translations_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_translations
    ADD CONSTRAINT product_translations_pkey PRIMARY KEY (product_id, language_code);


--
-- Name: product_variants product_variants_custom_sku_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_variants
    ADD CONSTRAINT product_variants_custom_sku_key UNIQUE (custom_sku);


--
-- Name: product_variants product_variants_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_variants
    ADD CONSTRAINT product_variants_pkey PRIMARY KEY (id);


--
-- Name: products products_custom_sku_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_custom_sku_key UNIQUE (custom_sku);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: products products_slug_id_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_slug_id_key UNIQUE (slug_id);


--
-- Name: refund_items refund_items_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.refund_items
    ADD CONSTRAINT refund_items_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: series_templates series_templates_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.series_templates
    ADD CONSTRAINT series_templates_pkey PRIMARY KEY (id);


--
-- Name: series_templates series_templates_template_key_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.series_templates
    ADD CONSTRAINT series_templates_template_key_key UNIQUE (template_key);


--
-- Name: service_providers service_providers_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.service_providers
    ADD CONSTRAINT service_providers_pkey PRIMARY KEY (id);


--
-- Name: service_providers service_providers_slug_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.service_providers
    ADD CONSTRAINT service_providers_slug_key UNIQUE (slug);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (id);


--
-- Name: settings settings_singleton_guard_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.settings
    ADD CONSTRAINT settings_singleton_guard_key UNIQUE (singleton_guard);


--
-- Name: size_definitions size_definitions_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.size_definitions
    ADD CONSTRAINT size_definitions_pkey PRIMARY KEY (id);


--
-- Name: sponsored_slots sponsored_slots_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.sponsored_slots
    ADD CONSTRAINT sponsored_slots_pkey PRIMARY KEY (id);


--
-- Name: store_inquiries store_inquiries_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.store_inquiries
    ADD CONSTRAINT store_inquiries_pkey PRIMARY KEY (id);


--
-- Name: store_inquiry_items store_inquiry_items_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.store_inquiry_items
    ADD CONSTRAINT store_inquiry_items_pkey PRIMARY KEY (id);


--
-- Name: story_settings story_settings_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.story_settings
    ADD CONSTRAINT story_settings_pkey PRIMARY KEY (singleton_guard);


--
-- Name: subscription_plans subscription_plans_code_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.subscription_plans
    ADD CONSTRAINT subscription_plans_code_key UNIQUE (code);


--
-- Name: subscription_plans subscription_plans_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.subscription_plans
    ADD CONSTRAINT subscription_plans_pkey PRIMARY KEY (id);


--
-- Name: supplier_accounting_ledger supplier_accounting_ledger_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_accounting_ledger
    ADD CONSTRAINT supplier_accounting_ledger_pkey PRIMARY KEY (id);


--
-- Name: supplier_applications supplier_applications_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_applications
    ADD CONSTRAINT supplier_applications_pkey PRIMARY KEY (id);


--
-- Name: supplier_invoices supplier_invoices_invoice_number_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_invoices
    ADD CONSTRAINT supplier_invoices_invoice_number_key UNIQUE (invoice_number);


--
-- Name: supplier_invoices supplier_invoices_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_invoices
    ADD CONSTRAINT supplier_invoices_pkey PRIMARY KEY (id);


--
-- Name: supplier_ledger supplier_ledger_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_ledger
    ADD CONSTRAINT supplier_ledger_pkey PRIMARY KEY (id);


--
-- Name: supplier_payout_requests supplier_payout_requests_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_payout_requests
    ADD CONSTRAINT supplier_payout_requests_pkey PRIMARY KEY (id);


--
-- Name: supplier_stories supplier_stories_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_stories
    ADD CONSTRAINT supplier_stories_pkey PRIMARY KEY (id);


--
-- Name: supplier_sub_order_items supplier_sub_order_items_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_sub_order_items
    ADD CONSTRAINT supplier_sub_order_items_pkey PRIMARY KEY (id);


--
-- Name: supplier_sub_orders supplier_sub_orders_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_sub_orders
    ADD CONSTRAINT supplier_sub_orders_pkey PRIMARY KEY (id);


--
-- Name: supplier_sub_orders supplier_sub_orders_sub_order_number_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_sub_orders
    ADD CONSTRAINT supplier_sub_orders_sub_order_number_key UNIQUE (sub_order_number);


--
-- Name: supplier_subscription_payments supplier_subscription_payments_payment_number_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_subscription_payments
    ADD CONSTRAINT supplier_subscription_payments_payment_number_key UNIQUE (payment_number);


--
-- Name: supplier_subscription_payments supplier_subscription_payments_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_subscription_payments
    ADD CONSTRAINT supplier_subscription_payments_pkey PRIMARY KEY (id);


--
-- Name: supplier_subscriptions supplier_subscriptions_brand_id_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_subscriptions
    ADD CONSTRAINT supplier_subscriptions_brand_id_key UNIQUE (brand_id);


--
-- Name: supplier_subscriptions supplier_subscriptions_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_subscriptions
    ADD CONSTRAINT supplier_subscriptions_pkey PRIMARY KEY (id);


--
-- Name: supplier_users supplier_users_email_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_users
    ADD CONSTRAINT supplier_users_email_key UNIQUE (email);


--
-- Name: supplier_users supplier_users_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_users
    ADD CONSTRAINT supplier_users_pkey PRIMARY KEY (id);


--
-- Name: supplier_wallets supplier_wallets_brand_id_key; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_wallets
    ADD CONSTRAINT supplier_wallets_brand_id_key UNIQUE (brand_id);


--
-- Name: supplier_wallets supplier_wallets_pkey; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_wallets
    ADD CONSTRAINT supplier_wallets_pkey PRIMARY KEY (id);


--
-- Name: product_ai_content unique_content_ai; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_ai_content
    ADD CONSTRAINT unique_content_ai UNIQUE (content_hash, ai_engine);


--
-- Name: exchange_rates unique_currency_date; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.exchange_rates
    ADD CONSTRAINT unique_currency_date UNIQUE (currency_code, publication_date);


--
-- Name: attribute_values uq_attribute_id_value; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.attribute_values
    ADD CONSTRAINT uq_attribute_id_value UNIQUE (attribute_id, attribute_value);


--
-- Name: customer_favorite_suppliers uq_customer_favorite_suppliers_user_brand; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.customer_favorite_suppliers
    ADD CONSTRAINT uq_customer_favorite_suppliers_user_brand UNIQUE (user_id, brand_id);


--
-- Name: mobile_wishlist uq_mobile_wishlist_user_product; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.mobile_wishlist
    ADD CONSTRAINT uq_mobile_wishlist_user_product UNIQUE (user_id, product_id);


--
-- Name: legal_policies uq_policy_type_version; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.legal_policies
    ADD CONSTRAINT uq_policy_type_version UNIQUE (policy_type, policy_version);


--
-- Name: product_attributes_map uq_product_attribute_value; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_attributes_map
    ADD CONSTRAINT uq_product_attribute_value UNIQUE (product_id, attribute_value_id);


--
-- Name: products uq_product_source; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT uq_product_source UNIQUE (feed_id, source_product_id);


--
-- Name: buyer_rfq_offers uq_rfq_brand_offer; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.buyer_rfq_offers
    ADD CONSTRAINT uq_rfq_brand_offer UNIQUE (rfq_id, brand_id);


--
-- Name: size_definitions uq_size_definitions_group_code; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.size_definitions
    ADD CONSTRAINT uq_size_definitions_group_code UNIQUE (size_group, code);


--
-- Name: product_variants uq_variant_source; Type: CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_variants
    ADD CONSTRAINT uq_variant_source UNIQUE (product_id, source_variant_id);


--
-- Name: consent_ledger consent_ledger_consent_ref_id_key; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_ledger
    ADD CONSTRAINT consent_ledger_consent_ref_id_key UNIQUE (consent_ref_id);


--
-- Name: consent_ledger consent_ledger_entry_hash_key; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_ledger
    ADD CONSTRAINT consent_ledger_entry_hash_key UNIQUE (entry_hash);


--
-- Name: consent_ledger consent_ledger_pkey; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_ledger
    ADD CONSTRAINT consent_ledger_pkey PRIMARY KEY (id);


--
-- Name: consent_ledger consent_ledger_seq_no_key; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_ledger
    ADD CONSTRAINT consent_ledger_seq_no_key UNIQUE (seq_no);


--
-- Name: consent_merkle_anchors consent_merkle_anchors_anchor_chain_hash_key; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_merkle_anchors
    ADD CONSTRAINT consent_merkle_anchors_anchor_chain_hash_key UNIQUE (anchor_chain_hash);


--
-- Name: consent_merkle_anchors consent_merkle_anchors_anchor_seq_key; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_merkle_anchors
    ADD CONSTRAINT consent_merkle_anchors_anchor_seq_key UNIQUE (anchor_seq);


--
-- Name: consent_merkle_anchors consent_merkle_anchors_pkey; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_merkle_anchors
    ADD CONSTRAINT consent_merkle_anchors_pkey PRIMARY KEY (id);


--
-- Name: consent_policy_snapshots consent_policy_snapshots_content_sha256_key; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_policy_snapshots
    ADD CONSTRAINT consent_policy_snapshots_content_sha256_key UNIQUE (content_sha256);


--
-- Name: consent_policy_snapshots consent_policy_snapshots_pkey; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_policy_snapshots
    ADD CONSTRAINT consent_policy_snapshots_pkey PRIMARY KEY (id);


--
-- Name: consent_settings consent_settings_pkey; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_settings
    ADD CONSTRAINT consent_settings_pkey PRIMARY KEY (id);


--
-- Name: cookie_inventory cookie_inventory_cookie_name_key; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.cookie_inventory
    ADD CONSTRAINT cookie_inventory_cookie_name_key UNIQUE (cookie_name);


--
-- Name: cookie_inventory cookie_inventory_pkey; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.cookie_inventory
    ADD CONSTRAINT cookie_inventory_pkey PRIMARY KEY (id);


--
-- Name: cookie_scan_runs cookie_scan_runs_pkey; Type: CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.cookie_scan_runs
    ADD CONSTRAINT cookie_scan_runs_pkey PRIMARY KEY (id);


--
-- Name: account_deletion_requests account_deletion_requests_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id);


--
-- Name: exception_alert_config exception_alert_config_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.exception_alert_config
    ADD CONSTRAINT exception_alert_config_pkey PRIMARY KEY (id);


--
-- Name: impersonation_logs impersonation_logs_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.impersonation_logs
    ADD CONSTRAINT impersonation_logs_pkey PRIMARY KEY (id);


--
-- Name: mobile_devices mobile_devices_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.mobile_devices
    ADD CONSTRAINT mobile_devices_pkey PRIMARY KEY (id);


--
-- Name: notification_logs notification_logs_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.notification_logs
    ADD CONSTRAINT notification_logs_pkey PRIMARY KEY (id);


--
-- Name: notification_settings notification_settings_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.notification_settings
    ADD CONSTRAINT notification_settings_pkey PRIMARY KEY (event_key);


--
-- Name: system_exception_logs system_exception_logs_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.system_exception_logs
    ADD CONSTRAINT system_exception_logs_pkey PRIMARY KEY (id);


--
-- Name: system_log_watermarks system_log_watermarks_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.system_log_watermarks
    ADD CONSTRAINT system_log_watermarks_pkey PRIMARY KEY (source);


--
-- Name: mobile_devices uq_mobile_devices_user_role_token; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.mobile_devices
    ADD CONSTRAINT uq_mobile_devices_user_role_token UNIQUE (user_id, user_role, fcm_token);


--
-- Name: user_addresses user_addresses_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.user_addresses
    ADD CONSTRAINT user_addresses_pkey PRIMARY KEY (id);


--
-- Name: user_login_history user_login_history_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.user_login_history
    ADD CONSTRAINT user_login_history_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: cron_logs cron_logs_pkey; Type: CONSTRAINT; Schema: integration; Owner: -
--

ALTER TABLE ONLY integration.cron_logs
    ADD CONSTRAINT cron_logs_pkey PRIMARY KEY (id);


--
-- Name: cron_settings cron_settings_pkey; Type: CONSTRAINT; Schema: integration; Owner: -
--

ALTER TABLE ONLY integration.cron_settings
    ADD CONSTRAINT cron_settings_pkey PRIMARY KEY (id);


--
-- Name: cron_settings cron_settings_singleton_guard_key; Type: CONSTRAINT; Schema: integration; Owner: -
--

ALTER TABLE ONLY integration.cron_settings
    ADD CONSTRAINT cron_settings_singleton_guard_key UNIQUE (singleton_guard);


--
-- Name: sync_runs sync_runs_pkey; Type: CONSTRAINT; Schema: integration; Owner: -
--

ALTER TABLE ONLY integration.sync_runs
    ADD CONSTRAINT sync_runs_pkey PRIMARY KEY (id);


--
-- Name: xml_feeds xml_feeds_alias_code_key; Type: CONSTRAINT; Schema: integration; Owner: -
--

ALTER TABLE ONLY integration.xml_feeds
    ADD CONSTRAINT xml_feeds_alias_code_key UNIQUE (alias_code);


--
-- Name: xml_feeds xml_feeds_pkey; Type: CONSTRAINT; Schema: integration; Owner: -
--

ALTER TABLE ONLY integration.xml_feeds
    ADD CONSTRAINT xml_feeds_pkey PRIMARY KEY (id);


--
-- Name: idx_analytics_pv_bot_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_bot_created ON analytics.page_views USING btree (is_bot, created_at DESC);


--
-- Name: idx_analytics_pv_country_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_country_created ON analytics.page_views USING btree (country_code, created_at DESC);


--
-- Name: idx_analytics_pv_created_at; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_created_at ON analytics.page_views USING btree (created_at DESC);


--
-- Name: idx_analytics_pv_keywords_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_keywords_created ON analytics.page_views USING btree (created_at DESC) WHERE (((COALESCE(utm_term, ''::character varying))::text <> ''::text) OR ((COALESCE(referrer_keyword, ''::character varying))::text <> ''::text));


--
-- Name: idx_analytics_pv_lang; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_lang ON analytics.page_views USING btree (language);


--
-- Name: idx_analytics_pv_path; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_path ON analytics.page_views USING btree (path);


--
-- Name: idx_analytics_pv_referrer_host; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_referrer_host ON analytics.page_views USING btree (referrer_host);


--
-- Name: idx_analytics_pv_session_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_session_created ON analytics.page_views USING btree (session_id, created_at);


--
-- Name: idx_analytics_pv_user_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_user_created ON analytics.page_views USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);


--
-- Name: idx_analytics_pv_utm_src_camp; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_utm_src_camp ON analytics.page_views USING btree (utm_source, utm_campaign);


--
-- Name: idx_analytics_pv_visitor_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_pv_visitor_created ON analytics.page_views USING btree (visitor_id, created_at);


--
-- Name: idx_analytics_uvl_visitor; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_analytics_uvl_visitor ON analytics.user_visitor_links USING btree (visitor_id);


--
-- Name: idx_bot_crawl_hourly_bucket; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_bot_crawl_hourly_bucket ON analytics.bot_crawl_hourly USING btree (bucket_hour DESC);


--
-- Name: idx_bot_crawl_hourly_cat_bucket; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_bot_crawl_hourly_cat_bucket ON analytics.bot_crawl_hourly USING btree (bot_category, bucket_hour DESC);


--
-- Name: idx_bot_crawl_logs_bot_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_bot_crawl_logs_bot_created ON analytics.bot_crawl_logs USING btree (bot_name, created_at DESC);


--
-- Name: idx_bot_crawl_logs_created_at; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_bot_crawl_logs_created_at ON analytics.bot_crawl_logs USING btree (created_at DESC);


--
-- Name: idx_brand_events_brand_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_brand_events_brand_created ON analytics.brand_events USING btree (brand_id, created_at DESC);


--
-- Name: idx_brand_events_brand_type; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_brand_events_brand_type ON analytics.brand_events USING btree (brand_id, event_type);


--
-- Name: idx_brand_events_product; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_brand_events_product ON analytics.brand_events USING btree (brand_id, product_id) WHERE (product_id IS NOT NULL);


--
-- Name: idx_member_events_category_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_member_events_category_created ON analytics.member_events USING btree (event_category, created_at DESC);


--
-- Name: idx_member_events_created_at; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_member_events_created_at ON analytics.member_events USING btree (created_at DESC);


--
-- Name: idx_member_events_user_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_member_events_user_created ON analytics.member_events USING btree (user_id, created_at DESC) WHERE (user_id IS NOT NULL);


--
-- Name: idx_member_events_visitor_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_member_events_visitor_created ON analytics.member_events USING btree (visitor_id, created_at DESC) WHERE (visitor_id IS NOT NULL);


--
-- Name: idx_search_logs_created_at; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_search_logs_created_at ON analytics.search_logs USING btree (created_at DESC);


--
-- Name: idx_search_logs_norm_query; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_search_logs_norm_query ON analytics.search_logs USING btree (normalized_query);


--
-- Name: idx_search_logs_results_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_search_logs_results_created ON analytics.search_logs USING btree (results_count, created_at DESC);


--
-- Name: idx_whatsapp_clicks_brand_created; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_whatsapp_clicks_brand_created ON analytics.whatsapp_clicks USING btree (brand_id, created_at DESC);


--
-- Name: idx_whatsapp_clicks_created_at; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_whatsapp_clicks_created_at ON analytics.whatsapp_clicks USING btree (created_at DESC);


--
-- Name: idx_whatsapp_clicks_user_id; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_whatsapp_clicks_user_id ON analytics.whatsapp_clicks USING btree (user_id) WHERE ((user_id)::text <> ''::text);


--
-- Name: idx_whatsapp_clicks_visitor_id; Type: INDEX; Schema: analytics; Owner: -
--

CREATE INDEX idx_whatsapp_clicks_visitor_id ON analytics.whatsapp_clicks USING btree (visitor_id) WHERE ((visitor_id)::text <> ''::text);


--
-- Name: idx_blog_post_translations_lang; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_blog_post_translations_lang ON catalog.blog_post_translations USING btree (language_code);


--
-- Name: idx_blog_post_translations_lang_slug; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_blog_post_translations_lang_slug ON catalog.blog_post_translations USING btree (language_code, slug);


--
-- Name: idx_blog_posts_is_active; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_blog_posts_is_active ON catalog.blog_posts USING btree (is_active);


--
-- Name: idx_buyer_rfq_offers_rfq_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_buyer_rfq_offers_rfq_id ON catalog.buyer_rfq_offers USING btree (rfq_id, created_at DESC);


--
-- Name: idx_buyer_rfqs_status_created; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_buyer_rfqs_status_created ON catalog.buyer_rfqs USING btree (status, created_at DESC);


--
-- Name: idx_cart_items_cart_product_uq; Type: INDEX; Schema: catalog; Owner: -
--

CREATE UNIQUE INDEX idx_cart_items_cart_product_uq ON catalog.cart_items USING btree (cart_id, product_id);


--
-- Name: idx_carts_user_id_uq; Type: INDEX; Schema: catalog; Owner: -
--

CREATE UNIQUE INDEX idx_carts_user_id_uq ON catalog.carts USING btree (user_id);


--
-- Name: idx_categories_node_path_gist; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_categories_node_path_gist ON catalog.categories USING gist (node_path);


--
-- Name: idx_categories_parent_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_categories_parent_id ON catalog.categories USING btree (parent_id);


--
-- Name: idx_category_translations_lang; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_category_translations_lang ON catalog.category_translations USING btree (language_code);


--
-- Name: idx_chat_messages_room_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_chat_messages_room_id ON catalog.chat_messages USING btree (room_id, created_at);


--
-- Name: idx_chat_rooms_brand_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_chat_rooms_brand_id ON catalog.chat_rooms USING btree (brand_id, last_message_at DESC);


--
-- Name: idx_chat_rooms_customer_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_chat_rooms_customer_id ON catalog.chat_rooms USING btree (customer_id, last_message_at DESC);


--
-- Name: idx_chat_rooms_supplier_user_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_chat_rooms_supplier_user_id ON catalog.chat_rooms USING btree (supplier_user_id, last_message_at DESC);


--
-- Name: idx_color_translations_lang; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_color_translations_lang ON catalog.color_translations USING btree (language_code);


--
-- Name: idx_country_cities_state_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_country_cities_state_id ON catalog.country_cities USING btree (state_id);


--
-- Name: idx_customer_fav_suppliers_brand_notify; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_customer_fav_suppliers_brand_notify ON catalog.customer_favorite_suppliers USING btree (brand_id) WHERE (notify_new_products = true);


--
-- Name: idx_customer_fav_suppliers_user; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_customer_fav_suppliers_user ON catalog.customer_favorite_suppliers USING btree (user_id, created_at DESC);


--
-- Name: idx_exchange_rates_currency_date; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_exchange_rates_currency_date ON catalog.exchange_rates USING btree (currency_code, publication_date DESC);


--
-- Name: idx_fabric_translations_lang; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_fabric_translations_lang ON catalog.fabric_translations USING btree (language_code);


--
-- Name: idx_indexnow_logs_created_at; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_indexnow_logs_created_at ON catalog.indexnow_logs USING btree (created_at DESC);


--
-- Name: idx_indexnow_logs_source_created; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_indexnow_logs_source_created ON catalog.indexnow_logs USING btree (trigger_source, created_at DESC);


--
-- Name: idx_indexnow_logs_status_created; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_indexnow_logs_status_created ON catalog.indexnow_logs USING btree (status, created_at DESC);


--
-- Name: idx_legal_consent_logs_actor_user; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_legal_consent_logs_actor_user ON catalog.legal_consent_logs USING btree (actor_user_id) WHERE (actor_user_id IS NOT NULL);


--
-- Name: idx_legal_consent_logs_brand; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_legal_consent_logs_brand ON catalog.legal_consent_logs USING btree (brand_id) WHERE (brand_id IS NOT NULL);


--
-- Name: idx_legal_consent_logs_entity; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_legal_consent_logs_entity ON catalog.legal_consent_logs USING btree (entity_type, entity_id) WHERE (entity_id IS NOT NULL);


--
-- Name: idx_legal_consent_logs_type_date; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_legal_consent_logs_type_date ON catalog.legal_consent_logs USING btree (consent_type, accepted_at DESC);


--
-- Name: idx_legal_policies_lookup; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_legal_policies_lookup ON catalog.legal_policies USING btree (policy_type, is_active);


--
-- Name: idx_mobile_notifications_recipient; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_mobile_notifications_recipient ON catalog.mobile_notifications USING btree (recipient_type, recipient_id, created_at DESC);


--
-- Name: idx_mobile_notifications_user_role; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_mobile_notifications_user_role ON catalog.mobile_notifications USING btree (user_role, user_id, created_at DESC);


--
-- Name: idx_mobile_wishlist_user_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_mobile_wishlist_user_id ON catalog.mobile_wishlist USING btree (user_id, created_at DESC);


--
-- Name: idx_mv_products_brand_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_mv_products_brand_id ON catalog.mv_products USING btree (brand_id);


--
-- Name: idx_mv_products_category_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_mv_products_category_id ON catalog.mv_products USING btree (category_id);


--
-- Name: idx_mv_products_created_at; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_mv_products_created_at ON catalog.mv_products USING btree (created_at DESC);


--
-- Name: idx_mv_products_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE UNIQUE INDEX idx_mv_products_id ON catalog.mv_products USING btree (id);


--
-- Name: idx_mv_products_node_path_gist; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_mv_products_node_path_gist ON catalog.mv_products USING gist (node_path);


--
-- Name: idx_mv_products_slug; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_mv_products_slug ON catalog.mv_products USING btree (slug);


--
-- Name: idx_mv_products_slug_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_mv_products_slug_id ON catalog.mv_products USING btree (slug_id);


--
-- Name: idx_newsletter_subscribers_active; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_newsletter_subscribers_active ON catalog.newsletter_subscribers USING btree (is_active, preferred_lang);


--
-- Name: idx_pages_is_active; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_pages_is_active ON catalog.pages USING btree (is_active);


--
-- Name: idx_pam_attribute_value_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_pam_attribute_value_id ON catalog.product_attributes_map USING btree (attribute_value_id);


--
-- Name: idx_pam_product_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_pam_product_id ON catalog.product_attributes_map USING btree (product_id);


--
-- Name: idx_product_deletion_logs_created_at; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_product_deletion_logs_created_at ON catalog.product_deletion_logs USING btree (created_at DESC);


--
-- Name: idx_product_images_product_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_product_images_product_id ON catalog.product_images USING btree (product_id);


--
-- Name: idx_product_translations_lang; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_product_translations_lang ON catalog.product_translations USING btree (language_code);


--
-- Name: idx_products_active_created_at; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_active_created_at ON catalog.products USING btree (created_at DESC) WHERE (is_active = true);


--
-- Name: idx_products_brand_archived_active; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_brand_archived_active ON catalog.products USING btree (brand_id, is_archived, is_active);


--
-- Name: idx_products_brand_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_brand_id ON catalog.products USING btree (brand_id);


--
-- Name: idx_products_brand_supplier_sku_lookup; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_brand_supplier_sku_lookup ON catalog.products USING btree (brand_id, upper(btrim((sku)::text))) WHERE ((brand_id IS NOT NULL) AND (sku IS NOT NULL) AND (btrim((sku)::text) <> ''::text));


--
-- Name: idx_products_category_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_category_id ON catalog.products USING btree (category_id);


--
-- Name: idx_products_color_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_color_id ON catalog.products USING btree (color_id);


--
-- Name: idx_products_created_at; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_created_at ON catalog.products USING btree (created_at);


--
-- Name: idx_products_custom_sku; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_custom_sku ON catalog.products USING btree (custom_sku);


--
-- Name: idx_products_deactivated_at; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_deactivated_at ON catalog.products USING btree (deactivated_at) WHERE (deactivated_at IS NOT NULL);


--
-- Name: idx_products_deleted_at; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_deleted_at ON catalog.products USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_products_fabric_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_fabric_id ON catalog.products USING btree (fabric_id);


--
-- Name: idx_products_id_text; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_id_text ON catalog.products USING btree (((id)::text));


--
-- Name: idx_products_indexnow_pending; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_indexnow_pending ON catalog.products USING btree (created_at DESC) WHERE ((is_active = true) AND (COALESCE(is_archived, false) = false) AND (indexnow_notified_at IS NULL));


--
-- Name: idx_products_lookup; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_lookup ON catalog.products USING btree (feed_id, source_product_id);


--
-- Name: idx_products_meta_gin; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_meta_gin ON catalog.products USING gin (meta_attributes);


--
-- Name: idx_products_slug; Type: INDEX; Schema: catalog; Owner: -
--

CREATE UNIQUE INDEX idx_products_slug ON catalog.products USING btree (slug);


--
-- Name: idx_products_slug_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_products_slug_id ON catalog.products USING btree (slug_id);


--
-- Name: idx_series_templates_active_order; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_series_templates_active_order ON catalog.series_templates USING btree (is_active, sort_order);


--
-- Name: idx_service_providers_category_active; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_service_providers_category_active ON catalog.service_providers USING btree (service_category, is_active, is_sponsored DESC, priority);


--
-- Name: idx_size_definitions_active_order; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_size_definitions_active_order ON catalog.size_definitions USING btree (is_active, size_group, sort_order);


--
-- Name: idx_sponsored_slots_placement_active; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_sponsored_slots_placement_active ON catalog.sponsored_slots USING btree (placement, is_active, priority);


--
-- Name: idx_supplier_acc_ledger_brand_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_acc_ledger_brand_id ON catalog.supplier_accounting_ledger USING btree (brand_id, created_at DESC);


--
-- Name: idx_supplier_applications_created_at; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_applications_created_at ON catalog.supplier_applications USING btree (created_at DESC);


--
-- Name: idx_supplier_applications_email; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_applications_email ON catalog.supplier_applications USING btree (email);


--
-- Name: idx_supplier_applications_status; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_applications_status ON catalog.supplier_applications USING btree (status);


--
-- Name: idx_supplier_applications_verification_expires; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_applications_verification_expires ON catalog.supplier_applications USING btree (verification_expires_at);


--
-- Name: idx_supplier_applications_verification_token; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_applications_verification_token ON catalog.supplier_applications USING btree (verification_token);


--
-- Name: idx_supplier_invoices_brand_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_invoices_brand_id ON catalog.supplier_invoices USING btree (brand_id, issue_date DESC);


--
-- Name: idx_supplier_stories_active_expires; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_stories_active_expires ON catalog.supplier_stories USING btree (expires_at DESC, created_at DESC) WHERE ((is_active = true) AND (deleted_at IS NULL));


--
-- Name: idx_supplier_stories_brand_window; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_stories_brand_window ON catalog.supplier_stories USING btree (brand_id, created_at DESC);


--
-- Name: idx_supplier_sub_payments_brand_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_sub_payments_brand_id ON catalog.supplier_subscription_payments USING btree (brand_id, paid_at DESC);


--
-- Name: idx_supplier_users_brand_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_users_brand_id ON catalog.supplier_users USING btree (brand_id);


--
-- Name: idx_supplier_users_email; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_users_email ON catalog.supplier_users USING btree (email);


--
-- Name: idx_supplier_users_keycloak_id; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_users_keycloak_id ON catalog.supplier_users USING btree (keycloak_id);


--
-- Name: idx_supplier_users_setup_token; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_supplier_users_setup_token ON catalog.supplier_users USING btree (setup_token);


--
-- Name: idx_variants_barcode; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_variants_barcode ON catalog.product_variants USING btree (barcode);


--
-- Name: idx_variants_custom_sku; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_variants_custom_sku ON catalog.product_variants USING btree (custom_sku);


--
-- Name: idx_variants_lookup; Type: INDEX; Schema: catalog; Owner: -
--

CREATE INDEX idx_variants_lookup ON catalog.product_variants USING btree (product_id, source_variant_id);


--
-- Name: uq_brands_subdomain_lower; Type: INDEX; Schema: catalog; Owner: -
--

CREATE UNIQUE INDEX uq_brands_subdomain_lower ON catalog.brands USING btree (lower((subdomain)::text)) WHERE ((subdomain IS NOT NULL) AND (btrim((subdomain)::text) <> ''::text));


--
-- Name: uq_chat_rooms_brand_agent_customer; Type: INDEX; Schema: catalog; Owner: -
--

CREATE UNIQUE INDEX uq_chat_rooms_brand_agent_customer ON catalog.chat_rooms USING btree (brand_id, COALESCE(supplier_user_id, '00000000-0000-0000-0000-000000000000'::uuid), customer_id);


--
-- Name: uq_products_brand_manual_supplier_sku; Type: INDEX; Schema: catalog; Owner: -
--

CREATE UNIQUE INDEX uq_products_brand_manual_supplier_sku ON catalog.products USING btree (brand_id, upper(btrim((sku)::text))) WHERE ((feed_id IS NULL) AND (brand_id IS NOT NULL) AND (sku IS NOT NULL) AND (btrim((sku)::text) <> ''::text) AND (COALESCE(is_archived, false) = false));


--
-- Name: idx_consent_ledger_action; Type: INDEX; Schema: compliance; Owner: -
--

CREATE INDEX idx_consent_ledger_action ON compliance.consent_ledger USING btree (action);


--
-- Name: idx_consent_ledger_date; Type: INDEX; Schema: compliance; Owner: -
--

CREATE INDEX idx_consent_ledger_date ON compliance.consent_ledger USING btree (recorded_at_utc DESC);


--
-- Name: idx_consent_ledger_subject; Type: INDEX; Schema: compliance; Owner: -
--

CREATE INDEX idx_consent_ledger_subject ON compliance.consent_ledger USING btree (subject_id, seq_no DESC);


--
-- Name: idx_consent_ledger_user; Type: INDEX; Schema: compliance; Owner: -
--

CREATE INDEX idx_consent_ledger_user ON compliance.consent_ledger USING btree (user_id, seq_no DESC) WHERE (user_id IS NOT NULL);


--
-- Name: idx_consent_ledger_visitor; Type: INDEX; Schema: compliance; Owner: -
--

CREATE INDEX idx_consent_ledger_visitor ON compliance.consent_ledger USING btree (visitor_id, seq_no DESC) WHERE (visitor_id IS NOT NULL);


--
-- Name: idx_identity_users_email_verified; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_identity_users_email_verified ON identity.users USING btree (email_verified);


--
-- Name: idx_identity_users_verification_token; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_identity_users_verification_token ON identity.users USING btree (email_verification_token) WHERE (email_verification_token IS NOT NULL);


--
-- Name: idx_impersonation_logs_admin_created; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_impersonation_logs_admin_created ON identity.impersonation_logs USING btree (admin_email, created_at DESC);


--
-- Name: idx_impersonation_logs_customer_created; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_impersonation_logs_customer_created ON identity.impersonation_logs USING btree (customer_id, created_at DESC);


--
-- Name: idx_mobile_devices_user_lookup; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_mobile_devices_user_lookup ON identity.mobile_devices USING btree (user_id, user_role) WHERE (is_active = true);


--
-- Name: idx_notification_logs_created_at; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_notification_logs_created_at ON identity.notification_logs USING btree (created_at DESC);


--
-- Name: idx_notification_logs_event_key; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_notification_logs_event_key ON identity.notification_logs USING btree (event_key, created_at DESC);


--
-- Name: idx_system_exception_logs_last_seen; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_system_exception_logs_last_seen ON identity.system_exception_logs USING btree (last_seen_at DESC);


--
-- Name: idx_system_exception_logs_open_fp; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_system_exception_logs_open_fp ON identity.system_exception_logs USING btree (fingerprint) WHERE (is_resolved = false);


--
-- Name: idx_system_exception_logs_severity; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_system_exception_logs_severity ON identity.system_exception_logs USING btree (severity, is_resolved, last_seen_at DESC);


--
-- Name: idx_user_login_history_user_id; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_user_login_history_user_id ON identity.user_login_history USING btree (user_id);


--
-- Name: idx_users_customer_country; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_users_customer_country ON identity.users USING btree (country_code) WHERE ((user_role)::text = 'customer'::text);


--
-- Name: idx_users_customer_created_at; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_users_customer_created_at ON identity.users USING btree (created_at DESC) WHERE ((user_role)::text = 'customer'::text);


--
-- Name: idx_users_customer_geo_unresolved; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_users_customer_geo_unresolved ON identity.users USING btree (created_at DESC) WHERE (((user_role)::text = 'customer'::text) AND (country_code IS NULL));


--
-- Name: idx_users_email; Type: INDEX; Schema: identity; Owner: -
--

CREATE INDEX idx_users_email ON identity.users USING btree (email);


--
-- Name: uq_mobile_devices_user_role_device_token; Type: INDEX; Schema: identity; Owner: -
--

CREATE UNIQUE INDEX uq_mobile_devices_user_role_device_token ON identity.mobile_devices USING btree (user_id, user_role, device_token);


--
-- Name: categories trig01_calculate_path; Type: TRIGGER; Schema: catalog; Owner: -
--

CREATE TRIGGER trig01_calculate_path BEFORE INSERT OR UPDATE OF parent_id, id ON catalog.categories FOR EACH ROW EXECUTE FUNCTION catalog.trig_calculate_category_path();


--
-- Name: categories trig02_update_children_path; Type: TRIGGER; Schema: catalog; Owner: -
--

CREATE TRIGGER trig02_update_children_path AFTER UPDATE OF node_path ON catalog.categories FOR EACH ROW EXECUTE FUNCTION catalog.trig_update_category_children_path();


--
-- Name: brands trig_brand_slug_before; Type: TRIGGER; Schema: catalog; Owner: -
--

CREATE TRIGGER trig_brand_slug_before BEFORE INSERT OR UPDATE OF brand_name ON catalog.brands FOR EACH ROW EXECUTE FUNCTION catalog.trig_brand_slug();


--
-- Name: products trig_product_custom_sku_before; Type: TRIGGER; Schema: catalog; Owner: -
--

CREATE TRIGGER trig_product_custom_sku_before BEFORE INSERT OR UPDATE OF brand_id, feed_id, source_product_id, custom_sku ON catalog.products FOR EACH ROW EXECUTE FUNCTION catalog.trig_product_custom_sku();


--
-- Name: products trig_product_slug_before; Type: TRIGGER; Schema: catalog; Owner: -
--

CREATE TRIGGER trig_product_slug_before BEFORE INSERT OR UPDATE OF title ON catalog.products FOR EACH ROW EXECUTE FUNCTION catalog.trig_product_slug();


--
-- Name: product_variants trig_variant_custom_sku_before; Type: TRIGGER; Schema: catalog; Owner: -
--

CREATE TRIGGER trig_variant_custom_sku_before BEFORE INSERT OR UPDATE OF product_id, variant_size, custom_sku ON catalog.product_variants FOR EACH ROW EXECUTE FUNCTION catalog.trig_variant_custom_sku();


--
-- Name: consent_ledger trg_consent_ledger_worm; Type: TRIGGER; Schema: compliance; Owner: -
--

CREATE TRIGGER trg_consent_ledger_worm BEFORE DELETE OR UPDATE ON compliance.consent_ledger FOR EACH ROW EXECUTE FUNCTION compliance.prevent_immutable_mutation();


--
-- Name: consent_merkle_anchors trg_consent_merkle_anchors_worm; Type: TRIGGER; Schema: compliance; Owner: -
--

CREATE TRIGGER trg_consent_merkle_anchors_worm BEFORE DELETE OR UPDATE ON compliance.consent_merkle_anchors FOR EACH ROW EXECUTE FUNCTION compliance.prevent_immutable_mutation();


--
-- Name: consent_policy_snapshots trg_consent_policy_snapshots_worm; Type: TRIGGER; Schema: compliance; Owner: -
--

CREATE TRIGGER trg_consent_policy_snapshots_worm BEFORE DELETE OR UPDATE ON compliance.consent_policy_snapshots FOR EACH ROW EXECUTE FUNCTION compliance.prevent_immutable_mutation();


--
-- Name: brand_events brand_events_brand_id_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.brand_events
    ADD CONSTRAINT brand_events_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: brand_events brand_events_product_id_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.brand_events
    ADD CONSTRAINT brand_events_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE SET NULL;


--
-- Name: whatsapp_clicks whatsapp_clicks_brand_id_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.whatsapp_clicks
    ADD CONSTRAINT whatsapp_clicks_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE SET NULL;


--
-- Name: whatsapp_clicks whatsapp_clicks_product_id_fkey; Type: FK CONSTRAINT; Schema: analytics; Owner: -
--

ALTER TABLE ONLY analytics.whatsapp_clicks
    ADD CONSTRAINT whatsapp_clicks_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE SET NULL;


--
-- Name: attribute_translations attribute_translations_attribute_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.attribute_translations
    ADD CONSTRAINT attribute_translations_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES catalog.attributes(id) ON DELETE CASCADE;


--
-- Name: attribute_value_translations attribute_value_translations_attribute_value_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.attribute_value_translations
    ADD CONSTRAINT attribute_value_translations_attribute_value_id_fkey FOREIGN KEY (attribute_value_id) REFERENCES catalog.attribute_values(id) ON DELETE CASCADE;


--
-- Name: attribute_values attribute_values_attribute_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.attribute_values
    ADD CONSTRAINT attribute_values_attribute_id_fkey FOREIGN KEY (attribute_id) REFERENCES catalog.attributes(id) ON DELETE CASCADE;


--
-- Name: blog_post_translations blog_post_translations_post_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.blog_post_translations
    ADD CONSTRAINT blog_post_translations_post_id_fkey FOREIGN KEY (post_id) REFERENCES catalog.blog_posts(id) ON DELETE CASCADE;


--
-- Name: buyer_rfq_offers buyer_rfq_offers_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.buyer_rfq_offers
    ADD CONSTRAINT buyer_rfq_offers_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: buyer_rfq_offers buyer_rfq_offers_rfq_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.buyer_rfq_offers
    ADD CONSTRAINT buyer_rfq_offers_rfq_id_fkey FOREIGN KEY (rfq_id) REFERENCES catalog.buyer_rfqs(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_cart_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.cart_items
    ADD CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES catalog.carts(id) ON DELETE CASCADE;


--
-- Name: cart_items cart_items_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.cart_items
    ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE CASCADE;


--
-- Name: carts carts_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.carts
    ADD CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: categories categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.categories
    ADD CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES catalog.categories(id) ON DELETE SET NULL;


--
-- Name: category_translations category_translations_category_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.category_translations
    ADD CONSTRAINT category_translations_category_id_fkey FOREIGN KEY (category_id) REFERENCES catalog.categories(id) ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_room_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.chat_messages
    ADD CONSTRAINT chat_messages_room_id_fkey FOREIGN KEY (room_id) REFERENCES catalog.chat_rooms(id) ON DELETE CASCADE;


--
-- Name: chat_rooms chat_rooms_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.chat_rooms
    ADD CONSTRAINT chat_rooms_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: chat_rooms chat_rooms_initial_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.chat_rooms
    ADD CONSTRAINT chat_rooms_initial_product_id_fkey FOREIGN KEY (initial_product_id) REFERENCES catalog.products(id) ON DELETE SET NULL;


--
-- Name: chat_rooms chat_rooms_supplier_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.chat_rooms
    ADD CONSTRAINT chat_rooms_supplier_user_id_fkey FOREIGN KEY (supplier_user_id) REFERENCES catalog.supplier_users(id) ON DELETE SET NULL;


--
-- Name: color_translations color_translations_color_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.color_translations
    ADD CONSTRAINT color_translations_color_id_fkey FOREIGN KEY (color_id) REFERENCES catalog.colors(id) ON DELETE CASCADE;


--
-- Name: country_cities country_cities_state_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.country_cities
    ADD CONSTRAINT country_cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES catalog.country_states(id) ON DELETE CASCADE;


--
-- Name: country_group_memberships country_group_memberships_country_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.country_group_memberships
    ADD CONSTRAINT country_group_memberships_country_id_fkey FOREIGN KEY (country_id) REFERENCES catalog.countries(id) ON DELETE CASCADE;


--
-- Name: country_group_memberships country_group_memberships_group_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.country_group_memberships
    ADD CONSTRAINT country_group_memberships_group_id_fkey FOREIGN KEY (group_id) REFERENCES catalog.country_groups(id) ON DELETE CASCADE;


--
-- Name: country_states country_states_country_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.country_states
    ADD CONSTRAINT country_states_country_id_fkey FOREIGN KEY (country_id) REFERENCES catalog.countries(id) ON DELETE CASCADE;


--
-- Name: customer_favorite_suppliers customer_favorite_suppliers_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.customer_favorite_suppliers
    ADD CONSTRAINT customer_favorite_suppliers_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: customer_favorite_suppliers customer_favorite_suppliers_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.customer_favorite_suppliers
    ADD CONSTRAINT customer_favorite_suppliers_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: fabric_translations fabric_translations_fabric_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.fabric_translations
    ADD CONSTRAINT fabric_translations_fabric_id_fkey FOREIGN KEY (fabric_id) REFERENCES catalog.fabrics(id) ON DELETE CASCADE;


--
-- Name: mobile_wishlist mobile_wishlist_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.mobile_wishlist
    ADD CONSTRAINT mobile_wishlist_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE CASCADE;


--
-- Name: newsletter_campaigns newsletter_campaigns_sponsor_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.newsletter_campaigns
    ADD CONSTRAINT newsletter_campaigns_sponsor_brand_id_fkey FOREIGN KEY (sponsor_brand_id) REFERENCES catalog.brands(id) ON DELETE SET NULL;


--
-- Name: order_items order_items_order_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.order_items
    ADD CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES catalog.orders(id) ON DELETE CASCADE;


--
-- Name: orders orders_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.orders
    ADD CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: page_translations page_translations_page_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.page_translations
    ADD CONSTRAINT page_translations_page_id_fkey FOREIGN KEY (page_id) REFERENCES catalog.pages(id) ON DELETE CASCADE;


--
-- Name: payment_notifications payment_notifications_order_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.payment_notifications
    ADD CONSTRAINT payment_notifications_order_id_fkey FOREIGN KEY (order_id) REFERENCES catalog.orders(id) ON DELETE CASCADE;


--
-- Name: payment_notifications payment_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.payment_notifications
    ADD CONSTRAINT payment_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: product_attributes_map product_attributes_map_attribute_value_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_attributes_map
    ADD CONSTRAINT product_attributes_map_attribute_value_id_fkey FOREIGN KEY (attribute_value_id) REFERENCES catalog.attribute_values(id) ON DELETE CASCADE;


--
-- Name: product_attributes_map product_attributes_map_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_attributes_map
    ADD CONSTRAINT product_attributes_map_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE CASCADE;


--
-- Name: product_images product_images_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_images
    ADD CONSTRAINT product_images_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE CASCADE;


--
-- Name: product_translations product_translations_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_translations
    ADD CONSTRAINT product_translations_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE CASCADE;


--
-- Name: product_variants product_variants_last_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_variants
    ADD CONSTRAINT product_variants_last_sync_run_id_fkey FOREIGN KEY (last_sync_run_id) REFERENCES integration.sync_runs(id) ON DELETE SET NULL;


--
-- Name: product_variants product_variants_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.product_variants
    ADD CONSTRAINT product_variants_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE CASCADE;


--
-- Name: products products_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE SET NULL;


--
-- Name: products products_category_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES catalog.categories(id) ON DELETE SET NULL;


--
-- Name: products products_color_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_color_id_fkey FOREIGN KEY (color_id) REFERENCES catalog.colors(id) ON DELETE SET NULL;


--
-- Name: products products_fabric_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_fabric_id_fkey FOREIGN KEY (fabric_id) REFERENCES catalog.fabrics(id) ON DELETE SET NULL;


--
-- Name: products products_feed_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES integration.xml_feeds(id) ON DELETE SET NULL;


--
-- Name: products products_last_sync_run_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.products
    ADD CONSTRAINT products_last_sync_run_id_fkey FOREIGN KEY (last_sync_run_id) REFERENCES integration.sync_runs(id) ON DELETE SET NULL;


--
-- Name: refund_items refund_items_order_item_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.refund_items
    ADD CONSTRAINT refund_items_order_item_id_fkey FOREIGN KEY (order_item_id) REFERENCES catalog.order_items(id) ON DELETE CASCADE;


--
-- Name: refund_items refund_items_refund_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.refund_items
    ADD CONSTRAINT refund_items_refund_id_fkey FOREIGN KEY (refund_id) REFERENCES catalog.refunds(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_order_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.refunds
    ADD CONSTRAINT refunds_order_id_fkey FOREIGN KEY (order_id) REFERENCES catalog.orders(id) ON DELETE CASCADE;


--
-- Name: refunds refunds_user_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.refunds
    ADD CONSTRAINT refunds_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: sponsored_slots sponsored_slots_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.sponsored_slots
    ADD CONSTRAINT sponsored_slots_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE SET NULL;


--
-- Name: store_inquiry_items store_inquiry_items_inquiry_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.store_inquiry_items
    ADD CONSTRAINT store_inquiry_items_inquiry_id_fkey FOREIGN KEY (inquiry_id) REFERENCES catalog.store_inquiries(id) ON DELETE CASCADE;


--
-- Name: store_inquiry_items store_inquiry_items_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.store_inquiry_items
    ADD CONSTRAINT store_inquiry_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE CASCADE;


--
-- Name: supplier_accounting_ledger supplier_accounting_ledger_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_accounting_ledger
    ADD CONSTRAINT supplier_accounting_ledger_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: supplier_accounting_ledger supplier_accounting_ledger_invoice_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_accounting_ledger
    ADD CONSTRAINT supplier_accounting_ledger_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES catalog.supplier_invoices(id) ON DELETE SET NULL;


--
-- Name: supplier_accounting_ledger supplier_accounting_ledger_payment_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_accounting_ledger
    ADD CONSTRAINT supplier_accounting_ledger_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES catalog.supplier_subscription_payments(id) ON DELETE SET NULL;


--
-- Name: supplier_invoices supplier_invoices_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_invoices
    ADD CONSTRAINT supplier_invoices_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: supplier_invoices supplier_invoices_subscription_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_invoices
    ADD CONSTRAINT supplier_invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES catalog.supplier_subscriptions(id) ON DELETE SET NULL;


--
-- Name: supplier_ledger supplier_ledger_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_ledger
    ADD CONSTRAINT supplier_ledger_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: supplier_ledger supplier_ledger_sub_order_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_ledger
    ADD CONSTRAINT supplier_ledger_sub_order_id_fkey FOREIGN KEY (sub_order_id) REFERENCES catalog.supplier_sub_orders(id) ON DELETE SET NULL;


--
-- Name: supplier_payout_requests supplier_payout_requests_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_payout_requests
    ADD CONSTRAINT supplier_payout_requests_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: supplier_stories supplier_stories_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_stories
    ADD CONSTRAINT supplier_stories_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: supplier_stories supplier_stories_linked_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_stories
    ADD CONSTRAINT supplier_stories_linked_product_id_fkey FOREIGN KEY (linked_product_id) REFERENCES catalog.products(id) ON DELETE SET NULL;


--
-- Name: supplier_sub_order_items supplier_sub_order_items_product_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_sub_order_items
    ADD CONSTRAINT supplier_sub_order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES catalog.products(id) ON DELETE RESTRICT;


--
-- Name: supplier_sub_order_items supplier_sub_order_items_sub_order_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_sub_order_items
    ADD CONSTRAINT supplier_sub_order_items_sub_order_id_fkey FOREIGN KEY (sub_order_id) REFERENCES catalog.supplier_sub_orders(id) ON DELETE CASCADE;


--
-- Name: supplier_sub_orders supplier_sub_orders_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_sub_orders
    ADD CONSTRAINT supplier_sub_orders_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE RESTRICT;


--
-- Name: supplier_sub_orders supplier_sub_orders_order_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_sub_orders
    ADD CONSTRAINT supplier_sub_orders_order_id_fkey FOREIGN KEY (order_id) REFERENCES catalog.orders(id) ON DELETE CASCADE;


--
-- Name: supplier_subscription_payments supplier_subscription_payments_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_subscription_payments
    ADD CONSTRAINT supplier_subscription_payments_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: supplier_subscription_payments supplier_subscription_payments_invoice_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_subscription_payments
    ADD CONSTRAINT supplier_subscription_payments_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES catalog.supplier_invoices(id) ON DELETE SET NULL;


--
-- Name: supplier_subscriptions supplier_subscriptions_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_subscriptions
    ADD CONSTRAINT supplier_subscriptions_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: supplier_subscriptions supplier_subscriptions_plan_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_subscriptions
    ADD CONSTRAINT supplier_subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES catalog.subscription_plans(id) ON DELETE SET NULL;


--
-- Name: supplier_users supplier_users_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_users
    ADD CONSTRAINT supplier_users_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: supplier_wallets supplier_wallets_brand_id_fkey; Type: FK CONSTRAINT; Schema: catalog; Owner: -
--

ALTER TABLE ONLY catalog.supplier_wallets
    ADD CONSTRAINT supplier_wallets_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- Name: consent_ledger consent_ledger_policy_snapshot_id_fkey; Type: FK CONSTRAINT; Schema: compliance; Owner: -
--

ALTER TABLE ONLY compliance.consent_ledger
    ADD CONSTRAINT consent_ledger_policy_snapshot_id_fkey FOREIGN KEY (policy_snapshot_id) REFERENCES compliance.consent_policy_snapshots(id);


--
-- Name: user_addresses user_addresses_city_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.user_addresses
    ADD CONSTRAINT user_addresses_city_id_fkey FOREIGN KEY (city_id) REFERENCES catalog.country_cities(id);


--
-- Name: user_addresses user_addresses_country_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.user_addresses
    ADD CONSTRAINT user_addresses_country_id_fkey FOREIGN KEY (country_id) REFERENCES catalog.countries(id);


--
-- Name: user_addresses user_addresses_state_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.user_addresses
    ADD CONSTRAINT user_addresses_state_id_fkey FOREIGN KEY (state_id) REFERENCES catalog.country_states(id);


--
-- Name: user_addresses user_addresses_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.user_addresses
    ADD CONSTRAINT user_addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: user_login_history user_login_history_user_id_fkey; Type: FK CONSTRAINT; Schema: identity; Owner: -
--

ALTER TABLE ONLY identity.user_login_history
    ADD CONSTRAINT user_login_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES identity.users(id) ON DELETE CASCADE;


--
-- Name: sync_runs sync_runs_feed_id_fkey; Type: FK CONSTRAINT; Schema: integration; Owner: -
--

ALTER TABLE ONLY integration.sync_runs
    ADD CONSTRAINT sync_runs_feed_id_fkey FOREIGN KEY (feed_id) REFERENCES integration.xml_feeds(id) ON DELETE CASCADE;


--
-- Name: xml_feeds xml_feeds_brand_id_fkey; Type: FK CONSTRAINT; Schema: integration; Owner: -
--

ALTER TABLE ONLY integration.xml_feeds
    ADD CONSTRAINT xml_feeds_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES catalog.brands(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--


