-- ============================================================================
-- AGENTPRESS — Postgres schema v2
-- Everything from v1 (businesses, agents, skills, agent_skills, customers,
-- orders, invoices, escrow_events, agent_memory, customer_data_requests,
-- notifications, audit_log) is unchanged and kept below.
--
-- NEW IN V2 — added exactly per the feature table just provided:
--   templates          -> "Template Selection"
--   services            -> "Service Catalog Builder"
--   guardrails          -> "Guardrails & Safety"
--   onboarding_steps    -> "Onchain OS Integration" (guided one-click setup)
--   agent_manifests     -> "Agent Manifest Generation" + "Preview"
--   (agents table gets a `description` column -> "Simple Configuration Forms")
--   (agents table gets deploy/registration fields -> "One-Click Deploy to OKX.AI")
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. BUSINESSES
-- ----------------------------------------------------------------------------
CREATE TABLE businesses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    business_type   TEXT,
    owner_email     TEXT,
    owner_phone     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 2. TEMPLATES — NEW: "Template Selection"
--    Pre-made templates (Customer Support, Finance, Sales, Token Research,
--    Smart Contract Auditor, etc.) that pre-populate skills/services/guardrails
--    so non-technical users can start fast. Defined before `agents` since
--    agents.template_id references it.
-- ----------------------------------------------------------------------------
CREATE TABLE templates (
    id                  TEXT PRIMARY KEY,           -- 'customer-support', 'finance', 'token-research', ...
    name                TEXT NOT NULL,
    category            TEXT NOT NULL,
    description         TEXT NOT NULL,
    default_skill_ids   TEXT[] NOT NULL DEFAULT '{}',   -- skills pre-toggled on when this template is picked
    default_services    JSONB NOT NULL DEFAULT '[]',    -- starter services (see `services` table shape)
    default_guardrails  JSONB NOT NULL DEFAULT '{}',    -- starter guardrail values
    active              BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO templates (id, name, category, description, default_skill_ids, default_services, default_guardrails) VALUES
('customer-support', 'Customer Support Agent', 'Sales',
  '24/7 order tracking, FAQs, refunds, and escalation to you when needed.',
  ARRAY['support'],
  '[{"name":"Answer customer questions","pricing_model":"per_call","price":0.05,"currency":"USDG"}]',
  '{"max_spend_per_transaction": 0}'),
('finance', 'Finance & Invoicing Agent', 'Finance',
  'Invoicing, payment reminders, and basic bookkeeping.',
  ARRAY['invoicing','books'],
  '[{"name":"Create & send invoice","pricing_model":"fixed","price":1.00,"currency":"USDG"}]',
  '{"max_spend_per_transaction": 500, "require_approval_above": 200}'),
('sales', 'Sales & Lead Agent', 'Sales',
  'Qualifies leads, follows up, and books meetings.',
  ARRAY['orders','scheduling'],
  '[{"name":"Qualify & follow up lead","pricing_model":"per_call","price":0.25,"currency":"USDG"}]',
  '{"max_spend_per_transaction": 0}'),
('token-research', 'Token Research Agent', 'Commerce',
  'Pulls on-chain and market data to answer questions about a token.',
  ARRAY['support'],
  '[{"name":"Token research report","pricing_model":"per_call","price":0.50,"currency":"USDG"}]',
  '{"max_spend_per_transaction": 0}'),
('smart-contract-auditor', 'Smart Contract Auditor Agent', 'Commerce',
  'Runs static analysis and flags risk patterns in submitted contract code.',
  ARRAY['support'],
  '[{"name":"Contract risk scan","pricing_model":"fixed","price":5.00,"currency":"USDG"}]',
  '{"max_spend_per_transaction": 0}');

-- ----------------------------------------------------------------------------
-- 3. AGENTS
--    NEW: description (Simple Configuration Forms), template_id link, and
--    registration/listing status split out (One-Click Deploy to OKX.AI)
-- ----------------------------------------------------------------------------
CREATE TABLE agents (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id              UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    template_id              TEXT REFERENCES templates(id),    -- which template it started from, if any
    name                     TEXT NOT NULL,
    description              TEXT,                              -- NEW: "Simple Configuration Forms"
    status                   TEXT NOT NULL DEFAULT 'draft'
                             CHECK (status IN ('draft', 'deploying', 'live', 'paused')),
    network                  TEXT NOT NULL DEFAULT 'x-layer-196',
    identity_ref             TEXT,
    registry_contract         TEXT,                              -- confirmed real field: "Registry contract" on agent's on-chain data panel
    registry_transaction      TEXT,                              -- confirmed real field: "Registry transaction"
    wallet_address           TEXT,
    -- NEW: split deploy pipeline so "One-Click Deploy to OKX.AI" is trackable step by step
    okx_asp_registered       BOOLEAN NOT NULL DEFAULT false,    -- registered as an ASP (not "User" - see onboarding.js note)
    marketplace_listing_url  TEXT,                              -- "...and listing the agent"
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    deployed_at              TIMESTAMPTZ
);

CREATE INDEX idx_agents_business ON agents(business_id);
CREATE INDEX idx_agents_template ON agents(template_id);

-- ----------------------------------------------------------------------------
-- 4. SKILLS (unchanged from v1)
-- ----------------------------------------------------------------------------
CREATE TABLE skills (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    category         TEXT NOT NULL,
    description      TEXT NOT NULL,
    requires_escrow  BOOLEAN NOT NULL DEFAULT false,
    pricing_model    TEXT NOT NULL,
    configurable     BOOLEAN NOT NULL DEFAULT false,
    manifest         JSONB NOT NULL DEFAULT '{}',
    active           BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO skills (id, name, category, description, requires_escrow, pricing_model, configurable, manifest) VALUES
('orders',     'Order Taking',            'Sales',      'Takes orders from customers by chat, then notifies you to pack and ship.', false, 'per order',   true,  '{"version":"1.0.0","tools":["create_order","get_catalog"],"app_capabilities":[]}'),
('invoicing',  'Invoicing & Collection',  'Finance',    'Sends invoices and holds payment in escrow until you mark the order fulfilled.', true, 'per invoice', true,  '{"version":"1.0.0","tools":["create_invoice","check_payment_status"],"app_capabilities":["quote","escrow","settlement"]}'),
('support',    'Customer Support',        'Sales',      'Answers questions about orders, hours, and policies, day or night.', false, 'metered',     false, '{"version":"1.0.0","tools":["answer_faq"],"app_capabilities":[]}'),
('books',      'Bookkeeping',             'Finance',    'Logs every sale and expense, and gives you a weekly summary.', false, 'included',    false, '{"version":"1.0.0","tools":["log_transaction","weekly_summary"],"app_capabilities":[]}'),
('scheduling', 'Scheduling',              'Operations', 'Books appointments and sends reminders so customers show up.', false, 'per booking', false, '{"version":"1.0.0","tools":["book_appointment","send_reminder"],"app_capabilities":[]}'),
('supplier',   'Supplier Ordering',       'Operations', 'Reorders stock and negotiates price directly with supplier agents.', true, 'per order',   false, '{"version":"1.0.0","tools":["reorder_stock","negotiate_price"],"app_capabilities":["quote","escrow","settlement"]}'),
('marketing',  'Marketing',               'Growth',     'Posts product updates and replies to comments on your socials.', false, 'included',    false, '{"version":"1.0.0","tools":["create_post","reply_comment"],"app_capabilities":[]}'),
('reputation', 'Reputation & Reviews',    'Trust',      'Collects reviews after each order and builds your on-chain track record.', false, 'included', false, '{"version":"1.0.0","tools":["request_review"],"app_capabilities":["reputation"]}');

-- ----------------------------------------------------------------------------
-- 5. AGENT_SKILLS (unchanged from v1)
-- ----------------------------------------------------------------------------
CREATE TABLE agent_skills (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    skill_id      TEXT NOT NULL REFERENCES skills(id),
    config        JSONB NOT NULL DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
    installed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agent_id, skill_id)
);

CREATE INDEX idx_agent_skills_agent ON agent_skills(agent_id);

-- ----------------------------------------------------------------------------
-- 6. SERVICES — NEW: "Service Catalog Builder"
--    The external, monetizable offerings a business adds to their agent —
--    name, description, price, pricing model — this is what gets published
--    to OKX.AI's service catalog. Independent of `skills`: a skill is internal
--    plumbing, a service is the priced thing a customer actually sees & buys.
-- ----------------------------------------------------------------------------
-- ----------------------------------------------------------------------------
-- 6. SERVICES — "Service Catalog Builder", extended with the publish-as-
--    service bridge: source_skill_id links a private skill to its public
--    OKX AI listing. service_type defaults to A2MCP (flat price, no
--    negotiation) per the decision to skip negotiation entirely; A2A
--    remains available for skills that genuinely need escrow (Invoicing,
--    Supplier Ordering).
-- ----------------------------------------------------------------------------
CREATE TABLE services (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id         UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    source_skill_id  TEXT REFERENCES skills(id),        -- the private skill this service was published from
    name             TEXT NOT NULL,
    description      TEXT,
    price            NUMERIC(18,6) NOT NULL,
    currency         TEXT NOT NULL DEFAULT 'USDG' CHECK (currency IN ('USDG', 'USDT', 'USDC')),
    pricing_model    TEXT NOT NULL CHECK (pricing_model IN ('fixed', 'per_call', 'milestone', 'streaming')),
    service_type     TEXT NOT NULL DEFAULT 'A2MCP' CHECK (service_type IN ('A2A', 'A2MCP')),
    category_tags    TEXT[] NOT NULL DEFAULT '{}',       -- for OKX.AI search/filter
    sold_count       INTEGER NOT NULL DEFAULT 0,
    listed           BOOLEAN NOT NULL DEFAULT false,     -- true once actually published to OKX AI
    active           BOOLEAN NOT NULL DEFAULT true,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_services_agent ON services(agent_id);
CREATE INDEX idx_services_tags ON services USING GIN (category_tags);

-- ----------------------------------------------------------------------------
-- 6b. REVIEWS — the reputation data confirmed real on agent listing pages
--     (star rating, positive %, review count). Tied to a service, since
--     that's what's actually rated on OKX AI.
-- ----------------------------------------------------------------------------
CREATE TABLE reviews (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id    UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment       TEXT,
    reviewer_ref  TEXT,                                  -- the hiring agent's identity ref, if available
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_service ON reviews(service_id);

-- ----------------------------------------------------------------------------
-- 7. GUARDRAILS — NEW: "Guardrails & Safety"
--    Spending limits, approval rules, allowed/blocked actions per agent.
-- ----------------------------------------------------------------------------
CREATE TABLE guardrails (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id                  UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,
    max_spend_per_transaction NUMERIC(18,6) NOT NULL DEFAULT 0,   -- 0 = no autonomous spend allowed
    max_spend_per_day         NUMERIC(18,6) NOT NULL DEFAULT 0,
    require_approval_above    NUMERIC(18,6),                      -- null = never needs approval
    allowed_actions           TEXT[] NOT NULL DEFAULT '{}',       -- whitelist, e.g. {'create_invoice','create_order'}
    blocked_actions           TEXT[] NOT NULL DEFAULT '{}',       -- explicit denylist, overrides allowed_actions
    updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. ONBOARDING_STEPS — NEW: "Onchain OS Integration"
--    Tracks the guided, one-click setup of Onchain OS + Agentic Wallet so the
--    console can show a checklist instead of the multi-step manual process on
--    OKX.AI today.
-- ----------------------------------------------------------------------------
CREATE TABLE onboarding_steps (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    step          TEXT NOT NULL CHECK (step IN (
                    'install_onchain_os',
                    'create_agentic_wallet',
                    'register_identity',
                    'generate_manifest',
                    'register_as_asp',
                    'list_on_marketplace'
                  )),
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'failed')),
    detail        JSONB NOT NULL DEFAULT '{}',
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (agent_id, step)
);

-- ----------------------------------------------------------------------------
-- 9. AGENT_MANIFESTS — NEW: "Agent Manifest Generation" + "Preview"
--    The generated JSON that gets registered on OKX.AI. Versioned so a new
--    manifest is generated whenever config/services/guardrails change, and
--    the console's Preview screen just renders the latest one.
-- ----------------------------------------------------------------------------
CREATE TABLE agent_manifests (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version       INTEGER NOT NULL,
    manifest      JSONB NOT NULL,     -- { name, description, services[], pricing, guardrails, endpoints }
    published     BOOLEAN NOT NULL DEFAULT false,   -- true once pushed live to OKX.AI
    generated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at  TIMESTAMPTZ,
    UNIQUE (agent_id, version)
);

CREATE INDEX idx_agent_manifests_agent ON agent_manifests(agent_id);

-- ----------------------------------------------------------------------------
-- 10. CUSTOMERS (unchanged from v1)
-- ----------------------------------------------------------------------------
CREATE TABLE customers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    display_name      TEXT,
    contact_channel   TEXT,
    contact_value     TEXT NOT NULL,
    shipping_address  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id, contact_value)
);

CREATE INDEX idx_customers_business ON customers(business_id);

-- ----------------------------------------------------------------------------
-- 11. ORDERS (unchanged from v1)
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    agent_id          UUID NOT NULL REFERENCES agents(id),
    customer_id       UUID NOT NULL REFERENCES customers(id),
    items             JSONB NOT NULL,
    status            TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new', 'notified', 'fulfilled', 'cancelled')),
    fulfillment_mode  TEXT NOT NULL DEFAULT 'manual' CHECK (fulfillment_mode IN ('manual', 'auto')),
    shipping_address  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    fulfilled_at      TIMESTAMPTZ
);

CREATE INDEX idx_orders_business ON orders(business_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_status ON orders(status);

-- ----------------------------------------------------------------------------
-- 12. INVOICES (unchanged from v1)
-- ----------------------------------------------------------------------------
CREATE TABLE invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id          UUID REFERENCES orders(id),
    business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    customer_id       UUID NOT NULL REFERENCES customers(id),
    amount            NUMERIC(18,6) NOT NULL,
    currency          TEXT NOT NULL DEFAULT 'USDG' CHECK (currency IN ('USDG', 'USDT', 'USDC')),
    escrow_enabled    BOOLEAN NOT NULL DEFAULT true,
    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'sent', 'escrowed', 'released', 'disputed', 'refunded')),
    app_reference     TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    paid_at           TIMESTAMPTZ,
    released_at       TIMESTAMPTZ
);

CREATE INDEX idx_invoices_business ON invoices(business_id);
CREATE INDEX idx_invoices_order ON invoices(order_id);

-- ----------------------------------------------------------------------------
-- 13. ESCROW_EVENTS (unchanged from v1)
-- ----------------------------------------------------------------------------
CREATE TABLE escrow_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id      UUID NOT NULL REFERENCES agents(id),
    invoice_id    UUID REFERENCES invoices(id),
    event_type    TEXT NOT NULL
                  CHECK (event_type IN ('quote', 'escrow_funded', 'settlement_released', 'dispute_opened', 'dispute_resolved')),
    payload       JSONB NOT NULL DEFAULT '{}',
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_escrow_events_invoice ON escrow_events(invoice_id);

-- ----------------------------------------------------------------------------
-- 14. AGENT_MEMORY (unchanged from v1 — centralized, encrypted, deletable)
-- ----------------------------------------------------------------------------
CREATE TABLE agent_memory (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id       UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    customer_id    UUID REFERENCES customers(id) ON DELETE CASCADE,
    memory_type    TEXT NOT NULL
                   CHECK (memory_type IN ('preference', 'fact', 'conversation_summary', 'task_history')),
    content        TEXT NOT NULL,     -- encrypt at the application layer before insert
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_memory_customer ON agent_memory(customer_id);

-- ----------------------------------------------------------------------------
-- 15. CUSTOMER_DATA_REQUESTS (unchanged from v1 — customer self-service access)
-- ----------------------------------------------------------------------------
CREATE TABLE customer_data_requests (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    request_type      TEXT NOT NULL CHECK (request_type IN ('view', 'export', 'delete')),
    access_token      TEXT NOT NULL UNIQUE,
    token_expires_at  TIMESTAMPTZ NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'expired')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    fulfilled_at      TIMESTAMPTZ
);

CREATE INDEX idx_data_requests_token ON customer_data_requests(access_token);

-- ----------------------------------------------------------------------------
-- 16. NOTIFICATIONS (unchanged from v1)
-- ----------------------------------------------------------------------------
CREATE TABLE notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    order_id      UUID REFERENCES orders(id),
    channel       TEXT NOT NULL CHECK (channel IN ('whatsapp', 'email', 'dashboard')),
    message       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at       TIMESTAMPTZ
);

CREATE INDEX idx_notifications_business ON notifications(business_id);

-- ----------------------------------------------------------------------------
-- 17. AUDIT_LOG (unchanged from v1)
-- ----------------------------------------------------------------------------
CREATE TABLE audit_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id      UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    actor         TEXT NOT NULL CHECK (actor IN ('agent', 'owner', 'customer')),
    action        TEXT NOT NULL,
    details       JSONB NOT NULL DEFAULT '{}',
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_agent ON audit_log(agent_id);
