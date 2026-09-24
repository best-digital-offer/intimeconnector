create unique index if not exists subscriptions_one_current_per_user
on public.subscriptions(user_id)
where status in ('active','trialing','past_due','incomplete');