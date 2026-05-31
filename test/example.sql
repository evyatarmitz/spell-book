-- SQL example — Code Scavenge test file
-- Dialect: PostgreSQL (also illustrates portable patterns)

-- ── Types ─────────────────────────────────────────────────────

CREATE TYPE direction AS ENUM ('north', 'south', 'east', 'west');

CREATE TYPE rgb AS (
    r INTEGER,
    g INTEGER,
    b INTEGER
);

-- ── Tables (struct) ───────────────────────────────────────────

CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    username    VARCHAR(64) NOT NULL UNIQUE,
    email       TEXT        NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE posts (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       TEXT        NOT NULL,
    body        TEXT        NOT NULL DEFAULT '',
    published   BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Views (other) ─────────────────────────────────────────────

CREATE OR REPLACE VIEW published_posts AS
    SELECT p.id, p.title, u.username, p.created_at
    FROM   posts p
    JOIN   users u ON u.id = p.user_id
    WHERE  p.published = TRUE;

CREATE OR REPLACE VIEW user_post_counts AS
    SELECT user_id, COUNT(*) AS total
    FROM   posts
    GROUP  BY user_id;

-- ── Functions (function) ──────────────────────────────────────

CREATE OR REPLACE FUNCTION full_name(first TEXT, last TEXT)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE STRICT
AS $$
    SELECT first || ' ' || last;
$$;

CREATE OR REPLACE FUNCTION word_count(body TEXT)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE STRICT
AS $$
    SELECT array_length(string_to_array(trim(body), ' '), 1);
$$;

-- ── Procedures (function) ─────────────────────────────────────

CREATE OR REPLACE PROCEDURE publish_post(post_id INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE posts
    SET    published = TRUE
    WHERE  id = post_id;
END;
$$;

CREATE OR REPLACE PROCEDURE delete_user(target_id INTEGER)
LANGUAGE plpgsql
AS $$
BEGIN
    DELETE FROM posts WHERE user_id = target_id;
    DELETE FROM users WHERE id      = target_id;
END;
$$;

-- ── Triggers (function) ───────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.created_at := now();
    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER posts_updated_at
    BEFORE UPDATE ON posts
    FOR EACH ROW
    EXECUTE FUNCTION set_updated_at();
