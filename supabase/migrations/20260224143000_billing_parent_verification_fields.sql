alter table public.billing_subscriptions
  add column if not exists parent_verification_completed_at timestamptz,
  add column if not exists parent_verification_payment_intent_id text,
  add column if not exists parent_verification_amount_cents integer,
  add column if not exists parent_verification_currency text;
