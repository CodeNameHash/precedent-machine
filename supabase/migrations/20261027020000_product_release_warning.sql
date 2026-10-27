-- A release the owner acknowledges as degraded.
--
-- Ben's decision of 2026-10-27: release immediately, with a health warning,
-- rather than hold the product for a full lawyer attestation. The release row
-- itself is immutable by trigger, so the acknowledgement lives on the release
-- head — the mutable pointer the published read already selects — and every
-- surface that shows the facts shows the warning.
--
-- The columns are read by lib/product/phase-3-store.js
-- (listPublishedLayeredFacts) and surface on /deals/v2/<id>, /compare and
-- /query/provisions. They were applied by hand to the staging project before
-- this migration existed; this file makes a database built from
-- supabase/migrations match it.

alter table public.product_agreement_release_heads
  add column if not exists released_with_warning boolean not null default false;

alter table public.product_agreement_release_heads
  add column if not exists release_warning jsonb;

comment on column public.product_agreement_release_heads.released_with_warning is
  'True when the owner released without the supervised release evaluation (work package 53, finding (292)).';
comment on column public.product_agreement_release_heads.release_warning is
  'The acknowledgement: reason, detail, who, when. Never a silent pass.';

-- The one operation that sets it. Direct SQL is not the product path, so the
-- move lives in a function that does all three writes together: the pointer,
-- the warning, and the review state's active release.
create or replace function public.product_activate_release_with_warning(
  p_run_id uuid,
  p_release_id text,
  p_warning jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
begin
  if p_warning is null or coalesce(p_warning->>'reason', '') = '' then
    raise exception 'a release warning needs a reason' using errcode = '22023';
  end if;
  select source_document_id into v_source
    from public.product_agreement_releases
   where release_id = p_release_id and run_id = p_run_id;
  if v_source is null then
    raise exception 'no release % for run %', p_release_id, p_run_id using errcode = 'P0002';
  end if;

  insert into public.product_agreement_release_heads (source_document_id, release_id, released_with_warning, release_warning, updated_at)
  values (v_source, p_release_id, true, p_warning, now())
  on conflict (source_document_id) do update
    set release_id = excluded.release_id,
        released_with_warning = true,
        release_warning = excluded.release_warning,
        updated_at = now();

  update public.product_review_sessions
     set state = jsonb_set(jsonb_set(state, '{active_release_id}', to_jsonb(p_release_id), true),
                           '{release_warning}', p_warning, true),
         updated_at = now()
   where run_id = p_run_id;
end;
$$;

revoke all on function public.product_activate_release_with_warning(uuid, text, jsonb) from public;
grant execute on function public.product_activate_release_with_warning(uuid, text, jsonb) to service_role;
