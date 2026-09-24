import Stripe from 'stripe';
import type { Request } from 'express';
import { db } from '../db/store.js';

export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
  provider: string;
}

const stripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Billing provider is not configured.');
  return new Stripe(key);
};

export class BillingEngine {
  async createCheckout(userId: string, planId: string): Promise<CheckoutResult> {
    const plan = await db.getPlanById(planId);
    if (!plan || !plan.is_active) throw new Error('Invalid plan.');
    if (!plan.stripe_price_id) throw new Error('This plan is not configured for checkout.');

    const profile = await db.getProfileById(userId);
    if (!profile) throw new Error('Account not found.');

    const client = stripe();
    let sub = await db.getSubscriptionByUserId(userId);
    let customerId = sub?.provider_customer_id;

    if (!customerId) {
      const customer = await client.customers.create({
        email: profile.email,
        name: profile.name || undefined,
        metadata: { jitc_user_id: userId }
      });
      customerId = customer.id;
    }

    const session = await client.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${process.env.APP_BASE_URL}/app/billing?checkout=success`,
      cancel_url: `${process.env.APP_BASE_URL}/app/billing?checkout=cancelled`,
      client_reference_id: userId,
      metadata: { user_id: userId, plan_id: planId },
      subscription_data: { metadata: { user_id: userId, plan_id: planId } }
    });

    if (sub) {
      await db.setSubscription({ ...sub, provider_customer_id: customerId, provider: 'stripe', updated_at: new Date().toISOString() });
    }

    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return { checkoutUrl: session.url, sessionId: session.id, provider: 'stripe' };
  }

  async handleWebhook(req: Request): Promise<{ received: boolean }> {
    const signature = req.header('stripe-signature');
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !secret) throw new Error('Stripe webhook is not configured.');

    const client = stripe();
    const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    const event = client.webhooks.constructEvent(raw, signature, secret);

    const claimed = await db.claimBillingWebhook(event.id, event.type);
    if (!claimed) return { received: true };

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id || session.client_reference_id;
        const planId = session.metadata?.plan_id;
        if (userId && planId) {
          const subId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
          const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
          const current = await db.getSubscriptionByUserId(userId);
          let periodStart = new Date().toISOString();
          let periodEnd = new Date(Date.now()+30*24*3600*1000).toISOString();
          // Stripe webhook payloads can vary by API version; keep a safe local fallback here.
          await db.setSubscription({
            id: current?.id || `sub_${event.id}`,
            user_id:userId, plan_id:planId, status:'active',
            current_period_start:periodStart,current_period_end:periodEnd,
            cancel_at_period_end:false,provider:'stripe',
            provider_customer_id:customerId,provider_subscription_id:subId,
            created_at:current?.created_at||periodStart,updated_at:periodStart
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const metadataUserId = subscription.metadata?.user_id;
        if (metadataUserId) {
          const current = await db.getSubscriptionByUserId(metadataUserId);
          if (current) {
            const active = event.type === 'customer.subscription.updated' && ['active','trialing'].includes(subscription.status);
            await db.setSubscription({
              ...current,
              status: active ? 'active' : 'canceled',
              provider:'stripe',
              provider_subscription_id:subscription.id,
              provider_customer_id:typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id,
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at:new Date().toISOString()
            });
          }
        }
        break;
      }
      case 'invoice.payment_failed':
      case 'invoice.payment_succeeded':
      case 'charge.refunded': {
        break;
      }
    }

    await db.logAudit({
      action:'billing.webhook.processed',resource_type:'billing',resource_id:event.id,
      metadata:{type:event.type},ip_address:'',user_id:undefined
    });
    return { received:true };
  }

  async cancelSubscription(userId: string): Promise<boolean> {
    const sub = await db.getSubscriptionByUserId(userId);
    if (!sub?.provider_subscription_id) return false;
    const client = stripe();
    await client.subscriptions.update(sub.provider_subscription_id, { cancel_at_period_end: true });
    await db.setSubscription({ ...sub, cancel_at_period_end:true, updated_at:new Date().toISOString() });
    return true;
  }

}

export const billingEngine = new BillingEngine();
