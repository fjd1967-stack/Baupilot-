import { cfg } from './config.js';
import { hmac, gleich } from './crypto.js';

// Stripe erwartet "form-encoded" mit verschachtelten Schlüsseln: a[b][0][c]=1
function flach(obj, pre = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const key = pre ? `${pre}[${k}]` : k;
    if (v === undefined || v === null) continue;
    if (Array.isArray(v)) v.forEach((x, i) => typeof x === 'object' ? flach(x, `${key}[${i}]`, out) : out.push([`${key}[${i}]`, x]));
    else if (typeof v === 'object') flach(v, key, out);
    else out.push([key, v]);
  }
  return out;
}
export const formular = o => new URLSearchParams(flach(o)).toString();

export async function api(methode, pfad, daten, idem) {
  if (cfg.stripeMock) return mock(methode, pfad, daten);
  if (!cfg.stripeKey) throw new Error('STRIPE_SECRET_KEY fehlt');
  const r = await fetch('https://api.stripe.com' + pfad, {
    method: methode,
    headers: { Authorization: 'Bearer ' + cfg.stripeKey, 'Content-Type': 'application/x-www-form-urlencoded', ...(idem ? { 'Idempotency-Key': idem } : {}) },
    body: daten ? formular(daten) : undefined
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Stripe: ' + (j.error?.message || r.status));
  return j;
}

// Abo mit zwei Positionen: 1. Nutzer 39,90 € und weitere Nutzer 9,90 € je Stück. Preise netto, Steuer kommt obendrauf.
export function checkoutDaten({ konto, email }) {
  const posten = (name, cent, menge) => ({
    quantity: menge,
    price_data: { currency: 'eur', unit_amount: cent, tax_behavior: 'exclusive', recurring: { interval: 'month' }, product_data: { name } },
    ...(cfg.taxMode === 'fest' && cfg.taxRateId ? { tax_rates: [cfg.taxRateId] } : {})
  });
  const items = [posten(`${cfg.appName}, erster Nutzer`, cfg.priceFirstCent, 1)];
  if (konto.nutzer > 1) items.push(posten(`${cfg.appName}, weiterer Nutzer`, cfg.priceExtraCent, konto.nutzer - 1));
  return {
    mode: 'subscription',
    payment_method_types: ['sepa_debit'],
    customer_email: email,
    client_reference_id: String(konto.id),
    line_items: items,
    billing_address_collection: 'required',
    tax_id_collection: { enabled: true },
    ...(cfg.taxMode === 'stripe_tax' ? { automatic_tax: { enabled: true } } : {}),
    subscription_data: { metadata: { konto: String(konto.id) } },
    locale: 'de',
    success_url: cfg.baseUrl + '/danke.html?k=' + konto.id,
    cancel_url: cfg.baseUrl + '/bestellen.html?abgebrochen=1'
  };
}

// Prüft die Unterschrift eines Stripe-Webhooks (Zeitfenster 5 Minuten).
export function webhookPruefen(roh, kopf, secret = cfg.stripeWebhookSecret, jetztSek = Date.now() / 1000) {
  if (!secret || !kopf) return false;
  const t = /t=(\d+)/.exec(kopf)?.[1]; const sigs = [...kopf.matchAll(/v1=([0-9a-f]+)/g)].map(m => m[1]);
  if (!t || Math.abs(jetztSek - +t) > 300) return false;
  const soll = hmac(secret, `${t}.${roh}`);
  return sigs.some(s => gleich(s, soll));
}

let zaehler = 0;
function mock(methode, pfad, d) {
  zaehler++;
  if (pfad === '/v1/checkout/sessions') return { id: 'cs_mock_' + zaehler, url: 'https://checkout.stripe.test/' + zaehler, _daten: d };
  if (pfad.startsWith('/v1/subscription_items/')) return { id: pfad.split('/').pop(), quantity: d.quantity };
  if (pfad.startsWith('/v1/subscriptions/')) return { id: 'sub_mock', items: { data: [{ id: 'si_erst', price: { unit_amount: 3990 } }, { id: 'si_extra', price: { unit_amount: 990 } }] } };
  return {};
}
