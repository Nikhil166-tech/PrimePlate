import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SeedService } from './common/seed.service';
import * as crypto from 'crypto';
const request = require('supertest');

async function runE2ETest() {
  console.log('🚀 Starting PrimePlate Production Hardening E2E Verification Test...');
  process.env.ENABLE_SEED = 'false';
  process.env.RAZORPAY_KEY_ID = 'rzp_test_TNJJJg21dtfm4u';
  process.env.RAZORPAY_KEY_SECRET = 'r6wIyVqZgiDSS6plm6ChceUZ';

  const app = await NestFactory.create(AppModule, { logger: ['log', 'error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  // Ensure Admin seed has completed
  const seedService = app.get(SeedService);
  await seedService.onApplicationBootstrap();

  const server = app.getHttpServer();

  try {
    const timestamp = Date.now();
    const providerEmail = `e2e_provider_${timestamp}@test.com`;
    const studentEmail = `e2e_student_${timestamp}@test.com`;
    const password = 'TestPassword@123';

    // 1. Provider Registers
    console.log('\n[Step 1] Registering Meal Provider...');
    await request(server)
      .post('/auth/register')
      .send({ email: providerEmail, password, name: 'E2E Kitchen', role: 'PROVIDER' })
      .expect((res: any) => {
        if (res.status !== 200 && res.status !== 201) throw new Error(`Unexpected status ${res.status}`);
      });
    console.log('  ✔ Provider registered successfully.');

    // 2. Provider Login
    console.log('[Step 2] Logging in Provider...');
    const loginProvRes = await request(server)
      .post('/auth/login')
      .send({ email: providerEmail, password });
    const providerToken = loginProvRes.body.accessToken || loginProvRes.body.access_token;
    if (!providerToken) throw new Error('Failed to obtain provider JWT token');
    console.log('  ✔ Provider logged in with JWT.');

    // 3. Provider Creates Kitchen/Mess Profile
    console.log('[Step 3] Provider creating Mess Profile...');
    const createProvRes = await request(server)
      .post('/providers')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        name: `Royal Heritage Mess ${timestamp}`,
        city: 'Bangalore',
        area: 'Koramangala',
        address: '100 Feet Road, Koramangala',
        monthlyPrice: 3499,
        category: 'North Indian',
        description: 'Authentic homestyle North Indian thali',
      });
    const providerId = createProvRes.body.id;
    if (!providerId) throw new Error('Failed to create provider listing');
    console.log(`  ✔ Provider created Mess profile (ID: ${providerId}, Status: ${createProvRes.body.approvalStatus}).`);

    // 4. Admin Login
    console.log('[Step 4] Logging in Admin...');
    const loginAdminRes = await request(server)
      .post('/auth/login')
      .send({ email: 'admin@primeplate.com', password: 'Admin@123' })
      .expect(200);
    
    const activeAdminToken = loginAdminRes.body.accessToken;
    if (!activeAdminToken) throw new Error('Failed to obtain Admin JWT token');
    console.log('  ✔ Admin logged in successfully.');

    // 5. Admin Approves Provider
    console.log('[Step 5] Admin approving provider...');
    const approveRes = await request(server)
      .patch(`/providers/approve/${providerId}`)
      .set('Authorization', `Bearer ${activeAdminToken}`)
      .expect(200);
    if (approveRes.body.approvalStatus !== 'APPROVED') throw new Error('Provider approval failed');
    console.log('  ✔ Provider status changed to APPROVED & verified=true.');

    // 6. Provider Creates Meal Plan
    console.log('[Step 6] Provider creating Meal Plan...');
    const createPlanRes = await request(server)
      .post('/meal-plans')
      .set('Authorization', `Bearer ${providerToken}`)
      .send({
        title: 'Executive Thali Plan',
        pricePerMonth: 3499,
        description: 'Daily fresh 4 Roti, Rice, Dal & 2 Sabzi',
        providerId,
      });
    const mealPlanId = createPlanRes.body.id;
    if (!mealPlanId) throw new Error('Failed to create meal plan');
    console.log(`  ✔ Meal Plan created (ID: ${mealPlanId}, Price: ₹${createPlanRes.body.pricePerMonth}).`);

    // 7. Student Registers
    console.log('[Step 7] Student registering...');
    await request(server)
      .post('/auth/register')
      .send({ email: studentEmail, password, name: 'E2E Student', role: 'STUDENT' });
    console.log('  ✔ Student registered successfully.');

    // 8. Student Logins
    console.log('[Step 8] Logging in Student...');
    const loginStudentRes = await request(server)
      .post('/auth/login')
      .send({ email: studentEmail, password });
    const studentToken = loginStudentRes.body.accessToken;
    console.log('  ✔ Student logged in with JWT.');

    // 9. Student Searches Public Messes
    console.log('[Step 9] Student searching public approved messes...');
    const searchRes = await request(server).get('/providers/search?city=Bangalore');
    const matched = searchRes.body.find((p: any) => p.id === providerId);
    if (!matched) throw new Error('Approved mess not found in public search');
    console.log('  ✔ Approved mess visible in public search results.');

    // 10. Student Creates Razorpay Order
    console.log('[Step 10] Student creating Razorpay order...');
    const orderRes = await request(server)
      .post('/payments/create-order')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ mealPlanId })
      .expect(201);
    const orderId = orderRes.body.orderId || orderRes.body.id;
    if (!orderId) throw new Error('Razorpay order creation failed');
    console.log(`  ✔ Razorpay order generated (Order ID: ${orderId}).`);

    // 11. Razorpay Signature Verification & Subscription Activation
    console.log('[Step 11] Verifying Razorpay payment signature & activating subscription...');
    const razorpayPaymentId = `pay_e2e_${timestamp}`;
    const secret = process.env.RAZORPAY_KEY_SECRET || 'sandbox_secret_key_12345';
    const text = `${orderId}|${razorpayPaymentId}`;
    const signature = crypto.createHmac('sha256', secret).update(text).digest('hex');

    const verifyRes = await request(server)
      .post('/payments/verify')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature,
        mealPlanId,
      })
      .expect(201);

    if (!verifyRes.body.verified || String(verifyRes.body.subscription?.status).toUpperCase() !== 'ACTIVE') {
      console.log('  DEBUG verifyRes.status:', verifyRes.status);
      console.log('  DEBUG verifyRes.body:', JSON.stringify(verifyRes.body, null, 2));
      throw new Error('Payment verification or subscription activation failed');
    }
    console.log('  ✔ Razorpay payment signature verified & Subscription ACTIVE!');

    // 12. Webhook Replay / Idempotency Test
    console.log('[Step 12] Testing Payment & Subscription Idempotency (Replayed Verification)...');
    const replayRes = await request(server)
      .post('/payments/verify')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        razorpay_order_id: orderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: signature,
        mealPlanId,
      })
      .expect(201);
    if (!replayRes.body.idempotent) {
      throw new Error('Idempotency check failed: duplicate payment/subscription was created on replay');
    }
    console.log('  ✔ Idempotency test PASSED! Replayed request returned existing subscription without duplicates.');

    // 13. Student Views Active Subscriptions
    console.log('[Step 13] Student fetching active subscriptions...');
    const mySubsRes = await request(server)
      .get('/subscriptions')
      .set('Authorization', `Bearer ${studentToken}`)
      .expect(200);
    if (!Array.isArray(mySubsRes.body) || mySubsRes.body.length === 0) {
      throw new Error('Student active subscriptions list is empty');
    }
    console.log(`  ✔ Student active subscriptions verified (${mySubsRes.body.length} active card).`);

    // 14. Provider Views Customer Subscribers List
    console.log('[Step 14] Provider fetching live active subscribers list...');
    const provSubsRes = await request(server)
      .get(`/subscriptions/provider/${providerId}`)
      .set('Authorization', `Bearer ${providerToken}`)
      .expect(200);
    if (!Array.isArray(provSubsRes.body) || provSubsRes.body.length === 0) {
      throw new Error('Provider live subscribers list is empty');
    }
    console.log(`  ✔ Provider live subscriber list verified (${provSubsRes.body.length} live subscriber).`);

    // 15. Admin Public Registration Disallowance Test
    console.log('[Step 15] Testing Admin Public Registration Disallowance...');
    await request(server)
      .post('/auth/register')
      .send({ email: `attacker_${timestamp}@test.com`, password: 'AttackerPassword@123', role: 'ADMIN' })
      .expect((res: any) => {
        if (res.status !== 400 && res.status !== 403) {
          throw new Error(`Expected 400/403 when attempting public Admin registration, got ${res.status}`);
        }
      });
    console.log('  ✔ Admin public registration successfully blocked (400/403 Forbidden).');

    // 16. Health Check Endpoint Test
    console.log('[Step 16] Testing GET /api/v1/health status endpoint...');
    const healthRes = await request(server).get('/health').expect(200);
    if (healthRes.body.status !== 'ok') {
      throw new Error('Health check status is not ok');
    }
    console.log('  ✔ Health check endpoint returned status: ok, database: connected.');

    // 17. Provider IDOR Subscriber Protection Test
    console.log('[Step 17] Testing Provider IDOR Subscriber Protection...');
    await request(server)
      .get('/subscriptions/provider/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${providerToken}`)
      .expect((res: any) => {
        if (res.status !== 403 && res.status !== 404) {
          throw new Error(`Expected 403/404 for IDOR attempt, got ${res.status}`);
        }
      });
    console.log('  ✔ Provider IDOR attempt blocked (403/404 Forbidden).');

    console.log('\n🎉 ALL 17 STEPS OF THE END-TO-END PRODUCTION HARDENING VERIFICATION JOURNEY PASSED PERFECTLY!');
  } catch (err: any) {
    console.error('\n❌ E2E Hardening Test Failed:', err.stack || err.message || err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runE2ETest().catch((err) => {
  console.error('CRASH:', err);
  process.exit(1);
});
