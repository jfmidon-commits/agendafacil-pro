import { chromium } from 'playwright';
import { randomUUID } from 'node:crypto';

const APP = process.env.APP_URL;
const SB = process.env.SUPABASE_URL;
const KEY = process.env.SERVICE_KEY;
if (!APP?.includes('staging')) throw new Error('Production target blocked');
if (!SB || !KEY) throw new Error('Missing staging credentials');

const id = randomUUID().slice(0, 8);
const email = `agendafacil.e2e.${id}@gmail.com`;
const password = `UiE2E-${randomUUID()}-Aa1!`;
const slug = `barbearia-ui-${id}`;
const business = `Barbearia UI ${id}`;
const clientEmail = `cliente-${id}@example.com`;
let userId = '';
let browser;

const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const admin = (path, options = {}) => fetch(`${SB}${path}`, { ...options, headers: { ...headers, ...(options.headers || {}) } });

async function findUser(page) {
  for (let i = 0; i < 12; i++) {
    const response = await admin('/auth/v1/admin/users?page=1&per_page=1000');
    const body = await response.json();
    const found = (body.users || []).find((user) => user.email === email);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  const uiError = await page.locator('.error').textContent().catch(() => null);
  throw new Error(`Signup UI did not create Auth user. UI error=${uiError || 'none'}`);
}

function nextMonday() {
  const date = new Date();
  let delta = (1 - date.getUTCDay() + 7) % 7;
  if (delta === 0) delta = 7;
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  await page.goto(`${APP}/signup`, { waitUntil: 'networkidle' });
  await page.locator('[name=name]').fill('Barbeiro UI E2E');
  await page.locator('[name=phone]').fill('51999990000');
  await page.locator('[name=email]').fill(email);
  await page.locator('[name=password]').fill(password);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await page.waitForTimeout(1200);
  const user = await findUser(page);
  userId = user.id;
  console.log('✓ Signup UI created Auth user');

  if (!user.email_confirmed_at) {
    const confirm = await admin(`/auth/v1/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify({ email_confirm: true }) });
    if (!confirm.ok) throw new Error(`Could not confirm test email: ${confirm.status}`);
  }

  await context.clearCookies();
  await page.goto(`${APP}/login?next=/onboarding`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('[name=email]').fill(email);
  await page.locator('[name=password]').fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/onboarding(?:\?|$)/, { timeout: 15000 });
  console.log('✓ Login UI works');

  const schedule = JSON.parse(await page.locator('[name=scheduleJson]').inputValue());
  if (schedule.length !== 2 || JSON.stringify(schedule[0].days) !== '[1,2,3,4,5]' || schedule[0].startTime !== '09:00' || schedule[0].endTime !== '18:00' || JSON.stringify(schedule[1].days) !== '[6]' || schedule[1].startTime !== '09:00' || schedule[1].endTime !== '14:00') {
    throw new Error(`Unexpected onboarding defaults: ${JSON.stringify(schedule)}`);
  }
  console.log('✓ Seg–Sex 09–18 + Sáb 09–14 rendered as separate groups');

  await page.locator('[name=businessName]').fill(business);
  await page.locator('[name=slug]').fill(slug);
  await page.locator('[name=serviceName]').fill('Corte');
  await page.locator('[name=duration]').fill('30');
  await page.locator('[name=price]').fill('35.00');
  await page.locator('[name=slotInterval]').selectOption('30');
  await page.getByRole('button', { name: 'Salvar e abrir meu painel' }).click();
  await page.waitForURL(/\/dashboard(?:\?|$)/, { timeout: 15000 });
  await page.getByRole('heading', { name: business }).waitFor();
  console.log('✓ Onboarding UI saved and redirected to dashboard');

  const [profiles, services, rules, subscriptions] = await Promise.all([
    admin(`/rest/v1/public_profiles?user_id=eq.${userId}&select=business_name,slug`).then(r => r.json()),
    admin(`/rest/v1/services?user_id=eq.${userId}&active=eq.true&select=id,name,duration_minutes,price_cents`).then(r => r.json()),
    admin(`/rest/v1/availability_rules?user_id=eq.${userId}&active=eq.true&select=day_of_week,start_time,end_time,slot_interval_minutes`).then(r => r.json()),
    admin(`/rest/v1/subscriptions?user_id=eq.${userId}&select=id`).then(r => r.json()),
  ]);
  if (profiles.length !== 1 || profiles[0].slug !== slug) throw new Error('Profile persistence failed');
  if (services.length !== 1 || services[0].name !== 'Corte' || services[0].price_cents !== 3500 || services[0].duration_minutes !== 30) throw new Error('Service persistence failed');
  if (rules.length !== 6) throw new Error(`Expected 6 rules, got ${rules.length}`);
  if (subscriptions.length !== 0) throw new Error('Onboarding created a paid subscription');
  console.log('✓ DB: 1 public profile, 1 service, 6 rules, 0 subscriptions');

  await page.goto(`${APP}/${slug}`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: business }).waitFor();
  await page.locator('input[type=date]').fill(nextMonday());
  const slot = page.locator('.slot-grid button').first();
  await slot.waitFor({ state: 'visible', timeout: 15000 });
  await slot.click();
  await page.locator('[name=name]').fill('Cliente UI E2E');
  await page.locator('[name=phone]').fill('51988887777');
  await page.locator('[name=email]').fill(clientEmail);
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click();
  await page.getByRole('heading', { name: /Agendamento confirmado/ }).waitFor({ timeout: 15000 });
  console.log('✓ Public booking UI confirmed appointment');

  const appointmentsBeforeDashboard = await admin(`/rest/v1/appointments?user_id=eq.${userId}&select=id,status,client_name,client_email,starts_at`).then(r => r.json());
  if (appointmentsBeforeDashboard.length !== 1 || appointmentsBeforeDashboard[0].status !== 'confirmed' || appointmentsBeforeDashboard[0].client_name !== 'Cliente UI E2E') {
    throw new Error(`Appointment persistence failed: ${JSON.stringify(appointmentsBeforeDashboard)}`);
  }
  console.log('✓ DB has exactly one confirmed appointment before dashboard refresh');

  await page.goto(`${APP}/dashboard`, { waitUntil: 'networkidle' });
  await page.locator('table').getByText('Cliente UI E2E', { exact: false }).waitFor({ timeout: 15000 });
  console.log('✓ Dashboard renders the booked client');
} finally {
  if (browser) await browser.close();
  if (userId) {
    const deletion = await admin(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
    if (!deletion.ok && deletion.status !== 404) throw new Error(`Auth cleanup failed: ${deletion.status}`);
    const [profiles, appointments] = await Promise.all([
      admin(`/rest/v1/profiles?id=eq.${userId}&select=id`).then(r => r.json()),
      admin(`/rest/v1/appointments?user_id=eq.${userId}&select=id`).then(r => r.json()),
    ]);
    if (profiles.length || appointments.length) throw new Error('Cascade cleanup incomplete');
    console.log('✓ Test user and cascaded data cleaned');
  }
}
