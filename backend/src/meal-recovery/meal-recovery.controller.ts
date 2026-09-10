import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MealRecoveryService } from './meal-recovery.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meal-recovery')
export class MealRecoveryController {
  constructor(private readonly mealRecoveryService: MealRecoveryService) {}

  /**
   * Provider manually triggers recovery processing for a specific subscriber's subscription.
   * POST — state-changing operation. Idempotent.
   */
  @Post('process/:subscriptionId')
  @Roles(Role.PROVIDER, Role.ADMIN)
  async processRecovery(
    @Req() req: AuthenticatedRequest,
    @Param('subscriptionId') subscriptionId: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.mealRecoveryService.processSubscriptionRecovery(
      subscriptionId,
      req.user.userId,
      providerId,
    );
  }

  /**
   * Student views their own provider-specific recovery balances.
   * Identity is always derived from authenticated JWT — never from query params.
   */
  @Get('my-balance')
  @Roles(Role.STUDENT)
  async getMyBalance(
    @Req() req: AuthenticatedRequest,
    @Query('providerId') providerId?: string,
  ) {
    return this.mealRecoveryService.getStudentRecoveryBalance(
      req.user.userId,
      providerId,
    );
  }

  /**
   * Provider views aggregated recovery statistics for their kitchen.
   */
  @Get('provider/stats')
  @Roles(Role.PROVIDER, Role.ADMIN)
  async getProviderStats(
    @Req() req: AuthenticatedRequest,
    @Query('providerId') providerId?: string,
  ) {
    return this.mealRecoveryService.getProviderRecoveryStats(
      req.user.userId,
      providerId,
    );
  }

  /**
   * Provider views full recovery audit for their subscribers.
   */
  @Get('provider/audit')
  @Roles(Role.PROVIDER, Role.ADMIN)
  async getProviderAudit(
    @Req() req: AuthenticatedRequest,
    @Query('providerId') providerId?: string,
  ) {
    return this.mealRecoveryService.getProviderRecoveryAudit(
      req.user.userId,
      providerId,
    );
  }
}
