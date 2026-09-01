import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealProvider } from './meal-provider.entity';
import { ProviderImage } from './provider-image.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { ProvidersService } from './providers.service';
import { UsersModule } from '../users/users.module';
import { UploadsModule } from '../uploads/uploads.module';
import { ProvidersController } from './providers.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MealProvider, Subscription, ProviderImage]),
    UsersModule,
    UploadsModule,
  ],
  providers: [ProvidersService],
  controllers: [ProvidersController],
  exports: [ProvidersService],
})
export class ProvidersModule {}
