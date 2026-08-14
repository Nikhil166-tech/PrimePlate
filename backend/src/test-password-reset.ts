import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SeedService } from './common/seed.service';
import { DataSource } from 'typeorm';
import { PasswordResetToken } from './auth/password-reset-token.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
const request = require('supertest');

async function runPasswordResetTests() {
  console.log('🚀 Starting PrimePlate Password Reset Verification Tests...\n');
  process.env.ENABLE_SEED = 'false';

  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  const seedService = app.get(SeedService);
  await seedService.onApplicationBootstrap();

  const server = app.getHttpServer();
  const dataSource = app.get(DataSource);

  try {
    const timestamp = Date.now();
    const studentEmail = `reset_student_${timestamp}@test.com`;
    const providerEmail = `reset_provider_${timestamp}@test.com`;
    const origPassword = 'OriginalPass@123';
    const newPassword = 'BrandNewPass@456';

    // Register Student
    console.log('[Test 1] Registering test student...');
    await request(server)
      .post('/auth/register')
      .send({ email: studentEmail, password: origPassword, name: 'Reset Student', phone: '+919999888877', role: 'STUDENT' })
      .expect(201);
    console.log('  ✔ Student registered.');

    // Register Provider
    console.log('[Test 2] Registering test provider...');
    await request(server)
      .post('/auth/register')
      .send({ email: providerEmail, password: origPassword, name: 'Reset Provider', phone: '+919999888866', role: 'PROVIDER' })
      .expect(201);
    console.log('  ✔ Provider registered.');

    // Log in student & obtain refresh token session
    console.log('[Test 3] Logging in student to create active session...');
    const loginRes = await request(server)
      .post('/auth/login')
      .send({ email: studentEmail, password: origPassword })
      .expect(200);
    const refreshToken = loginRes.body.refreshToken;
    if (!refreshToken) throw new Error('Failed to get refresh token');
    console.log('  ✔ Student logged in & refresh token session created.');

    // Test Nonexistent email request (Account Enumeration Protection)
    console.log('[Test 4] Testing forgot-password with NON-EXISTENT email...');
    const nonExistentRes = await request(server)
      .post('/auth/forgot-password')
      .send({ email: `nonexistent_${timestamp}@test.com` })
      .expect(200);
    if (!nonExistentRes.body.message.includes('If an account exists')) {
      throw new Error('Nonexistent email response did not match generic success template');
    }
    console.log('  ✔ Non-existent email returned identical generic success response.');

    // Test Existing student request
    console.log('[Test 5] Requesting password reset for existing student...');
    const forgotRes = await request(server)
      .post('/auth/forgot-password')
      .send({ email: studentEmail })
      .expect(200);
    if (forgotRes.body.message !== nonExistentRes.body.message) {
      throw new Error('Account enumeration flaw: existing email response differs from nonexistent email response!');
    }
    console.log('  ✔ Generic success response matched exactly (enumeration protected).');

    // Inspect Database: raw token must NOT be stored, only SHA-256 tokenHash
    console.log('[Test 6] Verifying token storage security in database...');
    const tokenRepo = dataSource.getRepository(PasswordResetToken);
    const resetRecords = await tokenRepo.find({ relations: { user: true } });
    const studentRecord = resetRecords.find((r) => r.user.email === studentEmail && !r.usedAt);
    if (!studentRecord) throw new Error('Password reset token record not found in database');
    if (studentRecord.tokenHash.length !== 64) {
      throw new Error('tokenHash is not a valid 64-character SHA-256 hex string!');
    }
    console.log('  ✔ Reset token is stored ONLY as SHA-256 hash in database.');

    // Test Reset Password with Invalid Token
    console.log('[Test 7] Testing reset-password with invalid token...');
    await request(server)
      .post('/auth/reset-password')
      .send({ token: 'invalid_token_12345', newPassword })
      .expect(400);
    console.log('  ✔ Invalid reset token rejected with 400.');

    // Test Reset Password with Expired Token
    console.log('[Test 8] Testing reset-password with expired token...');
    const expiredRawToken = 'expired_raw_token_abcdef123456';
    const expiredHash = crypto.createHash('sha256').update(expiredRawToken).digest('hex');
    const expiredRecord = tokenRepo.create({
      user: studentRecord.user,
      userId: studentRecord.user.id,
      tokenHash: expiredHash,
      expiresAt: new Date(Date.now() - 1000 * 60), // Expired 1 min ago
    });
    await tokenRepo.save(expiredRecord);

    await request(server)
      .post('/auth/reset-password')
      .send({ token: expiredRawToken, newPassword })
      .expect(400);
    console.log('  ✔ Expired reset token rejected with 400.');

    // Perform Actual Successful Reset
    console.log('[Test 9] Performing successful password reset...');
    const testRawToken = crypto.randomBytes(32).toString('hex');
    const testHash = crypto.createHash('sha256').update(testRawToken).digest('hex');
    const activeRecord = tokenRepo.create({
      user: studentRecord.user,
      userId: studentRecord.user.id,
      tokenHash: testHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    await tokenRepo.save(activeRecord);

    const resetRes = await request(server)
      .post('/auth/reset-password')
      .send({ token: testRawToken, newPassword })
      .expect(200);
    if (!resetRes.body.message.includes('Password reset successfully')) {
      throw new Error('Password reset response message unexpected');
    }
    console.log('  ✔ Password reset succeeded.');

    // Test Reusing the same reset token (Single-use test)
    console.log('[Test 10] Testing token single-use (reusing token must fail)...');
    await request(server)
      .post('/auth/reset-password')
      .send({ token: testRawToken, newPassword })
      .expect(400);
    console.log('  ✔ Token reuse blocked with 400.');

    // Test Old Password fails
    console.log('[Test 11] Verifying old password NO LONGER works...');
    await request(server)
      .post('/auth/login')
      .send({ email: studentEmail, password: origPassword })
      .expect(400);
    console.log('  ✔ Old password rejected.');

    // Test New Password works
    console.log('[Test 12] Verifying new password WORKS...');
    await request(server)
      .post('/auth/login')
      .send({ email: studentEmail, password: newPassword })
      .expect(200);
    console.log('  ✔ New password login successful.');

    // Test Existing Refresh Session Revocation
    console.log('[Test 13] Verifying old refresh session was revoked...');
    await request(server)
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
    console.log('  ✔ Pre-reset refresh token session successfully revoked!');

    // Test Provider Password Reset Flow
    console.log('[Test 14] Testing provider password reset flow...');
    const provRawToken = crypto.randomBytes(32).toString('hex');
    const provHash = crypto.createHash('sha256').update(provRawToken).digest('hex');
    const providerUser = await dataSource.getRepository('User').findOne({ where: { email: providerEmail } }) as any;
    await tokenRepo.save(tokenRepo.create({
      user: providerUser,
      userId: providerUser.id,
      tokenHash: provHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    }));

    await request(server)
      .post('/auth/reset-password')
      .send({ token: provRawToken, newPassword: 'ProviderNewPass@789' })
      .expect(200);

    await request(server)
      .post('/auth/login')
      .send({ email: providerEmail, password: 'ProviderNewPass@789' })
      .expect(200);
    console.log('  ✔ Provider password reset & login verified.');

    // Test Admin Password Reset Flow
    console.log('[Test 15] Testing Admin password reset flow...');
    const adminUser = await dataSource.getRepository('User').findOne({ where: { email: 'admin@primeplate.com' } }) as any;
    if (adminUser) {
      const adminRawToken = crypto.randomBytes(32).toString('hex');
      const adminHash = crypto.createHash('sha256').update(adminRawToken).digest('hex');
      await tokenRepo.save(tokenRepo.create({
        user: adminUser,
        userId: adminUser.id,
        tokenHash: adminHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      }));

      await request(server)
        .post('/auth/reset-password')
        .send({ token: adminRawToken, newPassword: 'AdminNewPass@999' })
        .expect(200);

      await request(server)
        .post('/auth/login')
        .send({ email: 'admin@primeplate.com', password: 'AdminNewPass@999' })
        .expect(200);

      // Restore Admin password back to default Admin@123 for E2E suite
      const adminPassHash = await bcrypt.hash('Admin@123', 10);
      adminUser.passwordHash = adminPassHash;
      await dataSource.getRepository('User').save(adminUser);
      console.log('  ✔ Admin password reset & login verified (restored to Admin@123).');
    }

    console.log('\n🎉 ALL 15 VERIFICATION CHECKS PASSED PERFECTLY!');
  } catch (err: any) {
    console.error('\n❌ Password Reset Test Failed:', err.stack || err.message || err);
    process.exit(1);
  } finally {
    await app.close();
  }
}

runPasswordResetTests().catch((err) => {
  console.error('CRASH:', err);
  process.exit(1);
});
