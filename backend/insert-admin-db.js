const { AppDataSource } = require('./dist/data-source');
const bcrypt = require('bcrypt');

async function seedAdminDirect() {
  console.log('🚀 Connecting to database to create Admin account...');
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository('User');

  const email = process.env.ADMIN_EMAIL || 'admin@primeplate.com';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const name = process.env.ADMIN_NAME || 'Platform Admin';

  const passwordHash = await bcrypt.hash(password, 10);

  let user = await userRepo.findOne({ where: { email } });

  if (user) {
    user.passwordHash = passwordHash;
    user.role = 'ADMIN';
    user.status = 'ACTIVE';
    user.name = name;
    await userRepo.save(user);
    console.log(`✅ SUCCESS: Updated existing user [${email}] to ADMIN role in database.`);
  } else {
    user = userRepo.create({
      email,
      passwordHash,
      name,
      role: 'ADMIN',
      status: 'ACTIVE',
    });
    await userRepo.save(user);
    console.log(`✅ SUCCESS: Inserted new ADMIN user [${email}] directly into database.`);
  }

  console.log('--------------------------------------------------');
  console.log('🔑 Database Admin Credentials:');
  console.log(`   Email:    ${email}`);
  console.log(`   Password: ${password}`);
  console.log(`   Role:     ADMIN`);
  console.log('--------------------------------------------------');

  await AppDataSource.destroy();
}

seedAdminDirect().catch((err) => {
  console.error('❌ Database insertion error:', err.message || err);
  process.exit(1);
});
