/* ============================================================
   BILLING — Rs 69/mo (XamCode Pro) via Razorpay checkout.js
   ------------------------------------------------------------
   Flow: XC.billing.status() -> order -> Razorpay checkout (live) or
   one-tap confirm (dev) -> verify -> server marks .billing.json active
   -> renewTrial() keeps the library + quota jumps to 50/day.
   Live needs checkout.js + BILLING_MODE=live + keys; dev needs nothing.
   ============================================================ */
(function(){
  'use strict';
  window.XC = window.XC || {};
  const CACHE_MS = 30000;
  let cache = null, cacheAt = 0;
  async function status(force){
    if (!force && cache && Date.now() - cacheAt < CACHE_MS) return cache;
    const res = await fetch('/api/billing/status', { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    cache = await res.json();
    cacheAt = Date.now();
    return cache;
  }
  function checkoutJsReady(){ return typeof window.Razorpay === 'function'; }
  function ensureCheckoutJs(){
    return new Promise((resolve, reject) => {
      if (checkoutJsReady()){ resolve(); return; }
      const s = document.createElement('script');
      s.src = 'https://checkout.razorpay.com/v1/checkout.js';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Razorpay checkout.js failed to load. Check connection and try again.'));
      document.head.appendChild(s);
    });
  }
  async function subscribe(opts){
    opts = opts || {};
    const st = await status(true);
    if (st.active) return st;
    const email = (window.XC && window.XC.auth && typeof window.XC.auth.session === 'function' && window.XC.auth.session() || {}).email || opts.email || '';
    const ores = await fetch('/api/billing/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email })
    });
    const order = await ores.json();
    if (!ores.ok) throw new Error((order && order.error) || ('HTTP ' + ores.status));
    if (order.mode !== 'live' || !order.keyId){
      /* DEV MODE: no gateway — the order screen itself is the confirm. */
      if (typeof opts.onDevConfirm === 'function'){ await opts.onDevConfirm(order); }
      else if (!opts.autoConfirm){ throw new Error('DEV_ORDER_REQUIRES_CONFIRM'); }
      const vres = await fetch('/api/billing/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.orderId, paymentId: 'pay_dev_' + Date.now(), signature: 'dev' })
      });
      const done = await vres.json();
      if (!vres.ok) throw new Error((done && done.error) || ('HTTP ' + vres.status));
      cache = done; cacheAt = Date.now();
      if (window.XC && window.XC.library) window.XC.library.renewTrial();
      return done;
    }
    await ensureCheckoutJs();
    return new Promise((resolve, reject) => {
      const rz = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency,
        name: 'XamCode AI', description: 'XamCode Pro — Rs 69 / 30 days',
        order_id: order.orderId, prefill: email ? { email } : undefined,
        theme: { color: '#6d5cff' },
        handler: async function (resp){
          try{
            const vres = await fetch('/api/billing/verify', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature })
            });
            const done = await vres.json();
            if (!vres.ok) throw new Error((done && done.error) || ('HTTP ' + vres.status));
            cache = done; cacheAt = Date.now();
            if (window.XC && window.XC.library) window.XC.library.renewTrial();
            resolve(done);
          }catch(e){ reject(e); }
        },
        modal: { ondismiss: function(){ reject(new Error('PAYMENT_CANCELLED')); } }
      });
      rz.on('payment.failed', function (resp){
        reject(new Error((resp && resp.error && resp.error.description) || 'Payment failed.'));
      });
      rz.open();
    });
  }
  window.XC.billing = { status, subscribe, ensureCheckoutJs };
})();
