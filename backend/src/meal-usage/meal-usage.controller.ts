import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MealUsageService } from './meal-usage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('meal-usage')
export class MealUsageController {
  constructor(private readonly mealUsageService: MealUsageService) {}

  /**
   * Provider fetches their permanent, unique printable QR code.
   */
  @Get('provider/qr')
  @Roles(Role.PROVIDER, Role.ADMIN)
  async getProviderQr(
    @Req() req: AuthenticatedRequest,
    @Query('providerId') providerId?: string,
  ) {
    return this.mealUsageService.getOrCreateProviderQr(
      req.user.userId,
      providerId,
    );
  }

  /**
   * Student scans provider QR to record their daily meal check-in.
   */
  @Post('check-in')
  @Roles(Role.STUDENT)
  async checkIn(
    @Req() req: AuthenticatedRequest,
    @Body() body: { qrToken: string },
  ) {
    return this.mealUsageService.checkIn(req.user.userId, body.qrToken);
  }

  /**
   * Student views their meal attendance checklist and history.
   */
  @Get('my-history')
  @Roles(Role.STUDENT)
  async getMyHistory(@Req() req: AuthenticatedRequest) {
    return this.mealUsageService.getStudentHistory(req.user.userId);
  }

  /**
   * Provider views today's check-in metrics and subscriber attendance list.
   */
  @Get('provider/today')
  @Roles(Role.PROVIDER, Role.ADMIN)
  async getProviderToday(
    @Req() req: AuthenticatedRequest,
    @Query('providerId') providerId?: string,
  ) {
    return this.mealUsageService.getProviderTodayCheckIns(
      req.user.userId,
      providerId,
    );
  }

  /**
   * Provider views whole month/cycle attendance history for a specific subscriber.
   */
  @Get('provider/subscriber/:subscriptionId/history')
  @Roles(Role.PROVIDER, Role.ADMIN)
  async getSubscriberAttendanceHistory(
    @Req() req: AuthenticatedRequest,
    @Param('subscriptionId') subscriptionId: string,
    @Query('providerId') providerId?: string,
  ) {
    return this.mealUsageService.getProviderSubscriberAttendanceHistory(
      req.user.userId,
      subscriptionId,
      providerId,
    );
  }

  /**
   * Provider performs an audited manual correction for genuine technical issues.
   */
  @Post('provider/correct')
  @Roles(Role.PROVIDER, Role.ADMIN)
  async correctCheckIn(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      providerId: string;
      subscriptionId: string;
      reason: string;
    },
  ) {
    return this.mealUsageService.correctCheckIn(req.user.userId, body);
  }
}
