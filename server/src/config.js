// Alle Einstellungen kommen aus Umgebungsvariablen (siehe deploy/.env.example).
const e = process.env;
export const cfg = {
  port: +e.PORT || 3000,
  baseUrl: (e.BASE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  dbFile: e.DB_FILE || './data/app.db',
  secret: e.APP_SECRET || 'nur-fuer-tests-aendern',
  appName: e.APP_NAME || 'BauPilot',
  priceFirstCent: +e.PRICE_FIRST_CENT || 3990,
  priceExtraCent: +e.PRICE_EXTRA_CENT || 990,
  maxUsers: +e.MAX_USERS || 200,
  agbVersion: e.AGB_VERSION || '2026-11-entwurf',
  stripeKey: e.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: e.STRIPE_WEBHOOK_SECRET || '',
  stripeMock: e.STRIPE_MOCK === '1',
  // 'stripe_tax' = Stripe berechnet Umsatzsteuer automatisch, 'fest' = ein Steuersatz (STRIPE_TAX_RATE_ID)
  taxMode: e.TAX_MODE || 'stripe_tax',
  taxRateId: e.STRIPE_TAX_RATE_ID || '',
  smtp: { host: e.SMTP_HOST || '', port: +e.SMTP_PORT || 465, user: e.SMTP_USER || '', pass: e.SMTP_PASS || '', from: e.MAIL_FROM || '' },
  secureCookie: (e.BASE_URL || '').startsWith('https://')
};
if (cfg.secureCookie && cfg.secret === 'nur-fuer-tests-aendern') throw new Error('APP_SECRET muss gesetzt sein.');
