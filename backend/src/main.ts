import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { TransformResponseInterceptor } from './common/transform-response.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

async function bootstrap() {
  const isProduction = process.env.NODE_ENV === 'production';
  const frontendUrl = process.env.FRONTEND_URL;

  // Validate FRONTEND_URL in production
  if (isProduction && !frontendUrl) {
    console.error(
      '❌ [CRITICAL PRODUCTION ERROR] FRONTEND_URL environment variable is required for CORS configuration in production mode!',
    );
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule);

  // Configure Express Trust Proxy for Render reverse proxy (1 hop) in production
  if (isProduction) {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  // Global prefix for versioned API
  app.setGlobalPrefix('api/v1');

  // Security Headers
  app.use(helmet());

  // Production CORS Configuration
  if (isProduction) {
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        const cleanOrigin = origin.replace(/\/$/, '');
        const targetFrontend = frontendUrl ? frontendUrl.replace(/\/$/, '') : '';
        if (
          !targetFrontend ||
          cleanOrigin === targetFrontend ||
          cleanOrigin.endsWith('.vercel.app')
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    });
  } else {
    app.enableCors({
      origin: true,
      credentials: true,
    });
  }

  // Global Rate Limiter (300 requests / 15 minutes)
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 300,
    }),
  );

  // Tighter Rate Limiter for Authentication & Sensitive Endpoints
  const authRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 attempts per 15 minutes
    message: {
      success: false,
      message: 'Too many authentication attempts. Please try again after 15 minutes.',
    },
  });

  app.use('/api/v1/auth/login', authRateLimiter);
  app.use('/api/v1/auth/register', authRateLimiter);
  app.use('/api/v1/auth/refresh', authRateLimiter);
  app.use('/api/v1/auth/forgot-password', authRateLimiter);
  app.use('/api/v1/auth/reset-password', authRateLimiter);

  // Payment creation rate limiter (anti-abuse)
  const paymentRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: {
      success: false,
      message: 'Too many payment requests. Please try again shortly.',
    },
  });

  app.use('/api/v1/payments/create-order', paymentRateLimiter);
  app.use('/api/v1/payments/verify', paymentRateLimiter);

  // Global validation and response interceptor
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new TransformResponseInterceptor());

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('PrimePlate API')
    .setDescription('PrimePlate backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/v1/docs', app, document);

  const port = process.env.PORT ?? 5000;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 PrimePlate NestJS Backend running at http://localhost:${port}/api/v1`);
  console.log(`📚 OpenAPI Swagger Documentation: http://localhost:${port}/api/v1/docs`);
}
bootstrap();
