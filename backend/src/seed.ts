import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SeedService } from './common/seed.service';

async function bootstrap() {
  if (process.env.NODE_ENV === 'production' && process.env.FORCE_SEED !== 'true') {
    console.error('❌ [SEED BLOCKED] Seeding CLI runner is blocked in NODE_ENV=production!');
    process.exit(1);
  }

  process.env.ENABLE_SEED = 'true';
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(SeedService);
  console.log('Explicit seed runner initiated...');
  await seedService.onApplicationBootstrap();
  console.log('Seed runner completed. Closing context.');
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Seed execution error:', err);
  process.exit(1);
});
