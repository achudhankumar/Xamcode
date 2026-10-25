'use strict';

/**
 * Account Quotas, Razorpay Billing & Library Security Engine (Phase 10)
 * Implements monthly page allowances, global spend caps, Razorpay UPI AutoPay subscriptions,
 * library lock on lapse, multi-tenant RLS isolation, and data watermark protection.
 */

const crypto = require('crypto');

const QUOTA_CONFIG = {
  free: {
    monthlyPages: 300,
    monthlyPdfs: 5,
    costINR: 0,
    hasLibraryAccess: true
  },
  plus: {
    monthlyPages: 1000,
    monthlyPdfs: Infinity,
    costINR: 69,
    hasLibraryAccess: true
  }
};

const GLOBAL_SPEND_CAP_INR = 500; // Daily circuit breaker limit

class AccountBillingSecurity {
  constructor() {
    this.users = new Map(); // userId -> { plan, pagesUsed, status, email, sessions }
    this.documents = new Map(); // docId -> { userId, pages, r2Key, createdAt }
    this.dailySpendINR = 0;
    this.jobCostLog = [];
  }

  registerUser(userId, email, plan = 'free') {
    const u = {
      id: userId,
      email,
      plan,
      pagesUsed: 0,
      libraryLocked: false,
      subscriptionStatus: plan === 'plus' ? 'active' : 'free',
      subscriptionLapsedAt: null,
      sessions: new Set()
    };
    this.users.set(userId, u);
    return u;
  }

  getUser(userId) {
    return this.users.get(userId) || null;
  }

  /**
   * Evaluates if an upload is permissible under page quotas.
   * Free plan strictly blocks overage upon reaching 301 pages.
   */
  canUploadPages(userId, pageCount) {
    const user = this.getUser(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    if (pageCount > 300) {
      return { allowed: false, reason: 'EXCEEDS_FILE_PAGE_LIMIT', max: 300 };
    }

    const quota = QUOTA_CONFIG[user.plan] || QUOTA_CONFIG.free;
    const remaining = quota.monthlyPages - user.pagesUsed;

    if (remaining < pageCount) {
      return {
        allowed: false,
        reason: 'QUOTA_EXCEEDED',
        pagesUsed: user.pagesUsed,
        requested: pageCount,
        allowance: quota.monthlyPages
      };
    }

    if (this.dailySpendINR >= GLOBAL_SPEND_CAP_INR) {
      return { allowed: false, reason: 'GLOBAL_DAILY_SPEND_CAP_REACHED' };
    }

    return { allowed: true, remaining: remaining - pageCount };
  }

  recordUsage(userId, pageCount, promptTokens = 0, candidateTokens = 0) {
    const user = this.getUser(userId);
    if (!user) return;

    user.pagesUsed += pageCount;

    // Approximate Gemini Flash-Lite class rate (Rs 0.000006 prompt, Rs 0.000025 candidate)
    const costRupees = (promptTokens * 0.000006) + (candidateTokens * 0.000025);
    this.dailySpendINR += costRupees;

    this.jobCostLog.push({
      userId,
      pageCount,
      promptTokens,
      candidateTokens,
      costRupees: Number(costRupees.toFixed(4)),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Razorpay Webhook Signature Verification
   */
  verifyRazorpayWebhookSignature(payloadString, signature, secret) {
    const expected = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8'));
  }

  /**
   * Handles payment / subscription webhook events
   */
  handleSubscriptionEvent(userId, eventType) {
    const user = this.getUser(userId);
    if (!user) throw new Error(`User ${userId} not found`);

    switch (eventType) {
      case 'subscription.charged':
      case 'payment.captured':
        user.plan = 'plus';
        user.subscriptionStatus = 'active';
        user.libraryLocked = false;
        user.subscriptionLapsedAt = null;
        break;

      case 'subscription.halted':
      case 'subscription.cancelled':
        user.subscriptionStatus = 'lapsed';
        user.libraryLocked = true; // Lock library, retain for 60 days
        user.subscriptionLapsedAt = new Date().toISOString();
        break;

      default:
        break;
    }
    return user;
  }

  /**
   * Multi-Tenant Isolation Gate (simulates Supabase Row-Level Security)
   */
  canAccessDocument(requestingUserId, documentOwnerId) {
    return requestingUserId === documentOwnerId;
  }

  /**
   * Generates workspace email watermark payload
   */
  getWatermarkPayload(userId) {
    const user = this.getUser(userId);
    return {
      watermarkText: user ? user.email : 'XamCode Student',
      opacity: 0.04,
      cssProperty: 'user-select: none; pointer-events: none;'
    };
  }
}

module.exports = {
  QUOTA_CONFIG,
  GLOBAL_SPEND_CAP_INR,
  AccountBillingSecurity
};
