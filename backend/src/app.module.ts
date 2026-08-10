import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProvidersModule } from './providers/providers.module';
import { MealPlansModule } from './meal-plans/meal-plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { PaymentsModule } from './payments/payments.module';
import { UploadsModule } from './uploads/uploads.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { SeedService } from './common/seed.service';
import { User } from './users/user.entity';
import { MealProvider } from './providers/meal-provider.entity';
import { MealPlan } from './meal-plans/meal-plan.entity';
import { Subscription } from './subscriptions/subscription.entity';
import { Payment } from './payments/payment.entity';
import { Review } from './reviews/review.entity';
import { WeeklyMenu } from './weekly-menus/weekly-menu.entity';
import { WeeklyMenusModule } from './weekly-menus/weekly-menus.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): any => {
        const isProd = config.get<string>('NODE_ENV') === 'production';
        const dbUrl = config.get<string>('DATABASE_URL');

        if (isProd && !dbUrl) {
          throw new Error(
            'FATAL: DATABASE_URL must be provided for PostgreSQL in production environment!',
          );
        }

        if (dbUrl) {
          const useSsl = config.get<string>('DATABASE_SSL') === 'true';
          return {
            type: 'postgres',
            url: dbUrl,
            synchronize: false, // Strictly disabled in production
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            migrations: [__dirname + '/migrations/*{.ts,.js}'],
            ssl: useSsl ? { rejectUnauthorized: false } : false,
          };
        }

        // Local Development SQLite
        return {
          type: 'better-sqlite3',
          database: 'dev.sqlite',
          synchronize: !isProd,
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          migrations: [__dirname + '/migrations/*{.ts,.js}'],
        };
      },
    }),
    TypeOrmModule.forFeature([
      User,
      MealProvider,
      MealPlan,
      Subscription,
      Payment,
      Review,
      WeeklyMenu,
    ]),
    AuthModule,
    UsersModule,
    ProvidersModule,
    MealPlansModule,
    SubscriptionsModule,
    PaymentsModule,
    UploadsModule,
    ReviewsModule,
    AnalyticsModule,
    WeeklyMenusModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
