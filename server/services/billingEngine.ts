import crypto from 'node:crypto';
import { db } from '../db/store';
import { Subscription } from '../db/schema';

export interface CheckoutResult {
  checkoutUrl: string;
  sessionId: string;
  provider: string;
}

export interface BillingWebhookEvent {
  id: string;
  type:
    | 'invoice.payment_succeeded'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted'
    | 'charge.refunded';
  data: {
    userId?: string;
    planId?: string;
    subscriptionId?: string;
    amount?: number;
  };
}

const processedWebhookEvents = new Set<string>();

export class BillingEngine {
  /**
   * Create checkout session URL for the external website
   */
  public async createCheckout(
    userId: string,
    planId: string,
    returnUrl?: string
  ): Promise<CheckoutResult> {
    const plan = db.getPlanById(planId);
    if (!plan) {
      throw new Error(`Invalid plan ID: ${planId}`);
    }

    const sessionId = `cs_${crypto.randomBytes(16).toString('hex')}`;
    const base = process.env.APP_BASE_URL || 'https://justintimeconnector.io';
    const checkoutUrl = `${base}/app/billing/confirm?session_id=${sessionId}&plan_id=${planId}`;

    return {
      checkoutUrl,
      sessionId,
      provider: process.env.BILLING_PROVIDER || 'stripe',
    };
  }

  /**
   * Handle simulated or real webhook events idempotently
   */
  public async handleWebhook(event: BillingWebhookEvent): Promise<{ handled: boolean; reason?: string }> {
    // Idempotency: prevent processing duplicate webhooks
    if (processedWebhookEvents.has(event.id)) {
      return { handled: true, reason: 'Duplicate event ignored' };
    }
    processedWebhookEvents.add(event.id);

    const { userId, planId, subscriptionId } = event.data;
    if (!userId) {
      return { handled: false, reason: 'Missing userId in event payload' };
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    switch (event.type) {
      case 'invoice.payment_succeeded':
      case 'customer.subscription.updated': {
        const targetPlanId = planId || 'plan_pro';
        const plan = db.getPlanById(targetPlanId);
        if (!plan) break;

        const updatedSub: Subscription = {
          id: `sub_${crypto.randomBytes(6).toString('hex')}`,
          user_id: userId,
          plan_id: targetPlanId,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd,
          cancel_at_period_end: false,
          provider: 'stripe',
          provider_subscription_id: subscriptionId || `sub_ext_${sessionId()}`,
          created_at: now.toISOString(),
          updated_at: now.toISOString(),
        };

        db.setSubscription(updatedSub);
        db.logAudit({
          user_id: userId,
          action: 'subscription.activated',
          resource_type: 'subscription',
          resource_id: updatedSub.id,
          metadata: { plan_id: targetPlanId, plan_name: plan.name },
          ip_address: '127.0.0.1',
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const currentSub = db.getSubscriptionByUserId(userId);
        if (currentSub) {
          currentSub.status = 'canceled';
          currentSub.cancel_at_period_end = true;
          // Downgrade to free plan
          db.setSubscription({
            ...currentSub,
            plan_id: 'plan_free',
            updated_at: now.toISOString(),
          });
        }
        break;
      }

      case 'charge.refunded': {
        db.logAudit({
          user_id: userId,
          action: 'subscription.refunded',
          resource_type: 'billing',
          metadata: { amount: event.data.amount },
          ip_address: '127.0.0.1',
        });
        break;
      }
    }

    return { handled: true };
  }

  /**
   * Cancel subscription at period end
   */
  public async cancelSubscription(userId: string): Promise<boolean> {
    const sub = db.getSubscriptionByUserId(userId);
    if (!sub) return false;
    sub.cancel_at_period_end = true;
    sub.updated_at = new Date().toISOString();
    db.setSubscription(sub);

    db.logAudit({
      user_id: userId,
      action: 'subscription.cancel_requested',
      resource_type: 'subscription',
      resource_id: sub.id,
      metadata: { cancel_at: sub.current_period_end },
      ip_address: '127.0.0.1',
    });
    return true;
  }
}

function sessionId(): string {
  return crypto.randomBytes(4).toString('hex');
}

export const billingEngine = new BillingEngine();
