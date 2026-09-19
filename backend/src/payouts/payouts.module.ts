import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProviderEarning } from './provider-earning.entity';
import { ProviderSettlementAudit } from './provider-settlement-audit.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Payment } from '../payments/payment.entity';
import { PayoutsService } from './payouts.service';
import { PayoutsController } from './payouts.controller';
import { AdminProviderEarningsController } from './admin-provider-earnings.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProviderEarning,
      ProviderSettlementAudit,
      MealProvider,
      Payment,
    ]),
  ],
  controllers: [PayoutsController, AdminProviderEarningsController],
  providers: [PayoutsService],
  exports: [PayoutsService],
})
export class PayoutsModule {}
