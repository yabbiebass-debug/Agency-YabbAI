alter table public.payments drop constraint payments_method_check;
alter table public.payments add constraint payments_method_check check (method in ('stripe','solana','paypal'));

alter table public.clients drop constraint clients_created_via_check;
alter table public.clients add constraint clients_created_via_check
  check (created_via in ('director','stripe_checkout','solana_payment','paypal_payment'));

create or replace function public.create_client_from_payment(p_payment_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare p public.payments; cid uuid;
begin
  select * into p from public.payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found.'; end if;
  if p.status <> 'confirmed' then raise exception 'Payment is not confirmed.'; end if;
  if p.client_id is not null then return p.client_id; end if;

  insert into public.clients(owner, lead_id, biz, package, setup_fee, setup_paid, tier, mrr, created_via)
  values (p.owner, p.lead_id, coalesce(p.biz, 'New client'), p.package, p.amount_aud, true,
          p.tier, p.mrr,
          case p.method
            when 'stripe' then 'stripe_checkout'
            when 'paypal' then 'paypal_payment'
            else 'solana_payment' end)
  returning id into cid;

  update public.payments set client_id = cid where id = p.id;
  if p.lead_id is not null then
    update public.leads set stage = 'Won' where id = p.lead_id;
  end if;

  insert into public.events(owner, agent, message)
  values (p.owner, upper(p.method),
    'payment confirmed — client created: ' || coalesce(p.biz, 'New client') || ' ($' || p.amount_aud || ')');
  return cid;
end $$;

revoke all on function public.create_client_from_payment(uuid) from public, anon, authenticated;
grant execute on function public.create_client_from_payment(uuid) to service_role;