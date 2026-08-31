import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  async getMySubscriptions(@Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.findByStudent(req.user.userId);
  }

  @Get('history')
  async getSubscriptionHistory(@Req() req: AuthenticatedRequest) {
    return this.subscriptionsService.findByStudent(req.user.userId);
  }

  @Get('provider/:providerId')
  @Roles(Role.PROVIDER, Role.ADMIN)
  async getProviderSubscriptions(
    @Req() req: AuthenticatedRequest,
    @Param('providerId') providerId: string,
  ) {
    if (req.user.role === Role.PROVIDER) {
      await this.subscriptionsService.verifyProviderOwnership(
        req.user.userId,
        providerId,
      );
    }
    return this.subscriptionsService.findByProvider(providerId);
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: { mealPlanId: string; startDate?: string; endDate?: string },
  ) {
    return this.subscriptionsService.create(
      req.user.userId,
      body.mealPlanId,
      body.startDate,
      body.endDate,
    );
  }

  @Patch(':id/pause')
  @Roles(Role.STUDENT)
  async pause(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.subscriptionsService.pause(req.user.userId, id);
  }

  @Patch(':id/resume')
  @Roles(Role.STUDENT)
  async resume(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.subscriptionsService.resume(req.user.userId, id);
  }

  @Patch(':id/cancel')
  @Roles(Role.STUDENT)
  async cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.subscriptionsService.cancel(req.user.userId, id);
  }
}
