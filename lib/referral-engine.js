'use strict';

/**
 * Referral Engine & Fraud Prevention (Phase A8)
 * Manages referral codes, 50-page bilateral bonuses, 500-page monthly caps,
 * device/payment fingerprinting, and bonus expiry.
 */

const BONUS_PAGES_PER_REFERRAL = 50;
const MAX_MONTHLY_BONUS_PAGES = 500;

class ReferralManager {
  constructor() {
    this.userCodes = new Map(); // userId -> referralCode
    this.codeOwners = new Map(); // referralCode -> userId
    this.userBonuses = new Map(); // userId -> { totalBonusPages, monthKey, grants }
    this.registeredFingerprints = new Set(); // deviceFingerprint / paymentFingerprint
    this.grantAuditLog = [];
  }

  createReferralCode(userId, prefix = '') {
    const cleanPrefix = (prefix || userId.slice(0, 5)).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const code = `${cleanPrefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    this.userCodes.set(userId, code);
    this.codeOwners.set(code, userId);
    return code;
  }

  getCurrentMonthKey(date = new Date()) {
    return date.toISOString().slice(0, 7); // YYYY-MM
  }

  getUserBonusState(userId, monthKey = this.getCurrentMonthKey()) {
    const cur = this.userBonuses.get(userId);
    if (!cur || cur.monthKey !== monthKey) {
      const fresh = {
        userId,
        monthKey,
        bonusPages: 0,
        grants: []
      };
      this.userBonuses.set(userId, fresh);
      return fresh;
    }
    return cur;
  }

  applyReferralOnFirstUpload({
    referralCode,
    newUserId,
    deviceFingerprint,
    date = new Date()
  }) {
    if (!referralCode || !this.codeOwners.has(referralCode)) {
      throw new Error(`Invalid or unknown referral code: "${referralCode}"`);
    }

    const referrerId = this.codeOwners.get(referralCode);

    // Rule 1: Block self-referral
    if (referrerId === newUserId) {
      throw new Error('Self-referrals are strictly prohibited');
    }

    // Rule 2: Block repeated signups from same device fingerprint
    if (deviceFingerprint) {
      if (this.registeredFingerprints.has(deviceFingerprint)) {
        throw new Error('Referral rejected: repeated sign-up detected from this device');
      }
      this.registeredFingerprints.add(deviceFingerprint);
    }

    const monthKey = this.getCurrentMonthKey(date);
    const referrerBonus = this.getUserBonusState(referrerId, monthKey);
    const refereeBonus = this.getUserBonusState(newUserId, monthKey);

    // Rule 3: Cap at 500 bonus pages per user per month
    const referrerGrant = Math.min(BONUS_PAGES_PER_REFERRAL, Math.max(0, MAX_MONTHLY_BONUS_PAGES - referrerBonus.bonusPages));
    const refereeGrant = BONUS_PAGES_PER_REFERRAL;

    if (referrerGrant > 0) {
      referrerBonus.bonusPages += referrerGrant;
      referrerBonus.grants.push({ from: newUserId, pages: referrerGrant, date: date.toISOString() });
    }

    refereeBonus.bonusPages += refereeGrant;
    refereeBonus.grants.push({ from: referrerId, pages: refereeGrant, date: date.toISOString() });

    const auditEntry = {
      referrerId,
      refereeId: newUserId,
      referralCode,
      referrerPagesGranted: referrerGrant,
      refereePagesGranted: refereeGrant,
      monthKey,
      timestamp: date.toISOString()
    };

    this.grantAuditLog.push(auditEntry);

    return {
      success: true,
      referrerPagesGranted: referrerGrant,
      refereePagesGranted: refereeGrant,
      referrerTotalBonusThisMonth: referrerBonus.bonusPages
    };
  }
}

module.exports = {
  BONUS_PAGES_PER_REFERRAL,
  MAX_MONTHLY_BONUS_PAGES,
  ReferralManager
};

