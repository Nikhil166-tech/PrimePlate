import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';

import { SubscriptionBreaksService } from './subscription-breaks.service';
import { CreateBreakRequestDto } from './dto/create-break-request.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('subscription-breaks')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionBreaksController {
  constructor(private readonly breaksService: SubscriptionBreaksService) {}

  @Post()
  @Roles(Role.STUDENT)
  async createBreakRequest(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateBreakRequestDto,
  ) {
    return await this.breaksService.createBreakRequest(req.user.userId, dto);
  }

  @Get('my')
  @Roles(Role.STUDENT)
  async getMyBreakRequests(@Req() req: AuthenticatedRequest) {
    return await this.breaksService.getMyBreakRequests(req.user.userId);
  }

  @Get('provider/:providerId')
  @Roles(Role.PROVIDER)
  async getProviderBreakRequests(
    @Req() req: AuthenticatedRequest,
    @Param('providerId') providerId: string,
  ) {
    return await this.breaksService.getProviderBreakRequests(
      providerId,
      req.user.userId,
    );
  }

  @Patch(':id/approve')
  @Roles(Role.PROVIDER)
  async approveBreakRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') requestId: string,
  ) {
    return await this.breaksService.approveBreakRequest(
      requestId,
      req.user.userId,
    );
  }

  @Patch(':id/reject')
  @Roles(Role.PROVIDER)
  async rejectBreakRequest(
    @Req() req: AuthenticatedRequest,
    @Param('id') requestId: string,
  ) {
    return await this.breaksService.rejectBreakRequest(
      requestId,
      req.user.userId,
    );
  }

  @Patch('provider-settings')
  @Roles(Role.PROVIDER)
  async updateBreakSettingsAlt(
    @Req() req: AuthenticatedRequest,
    @Body() body: { providerId?: string; subscriptionBreaksEnabled: boolean },
  ) {
    if (!body.providerId) {
      throw new BadRequestException('providerId is required');
    }
    return await this.breaksService.updateBreakSettings(
      body.providerId,
      req.user.userId,
      body.subscriptionBreaksEnabled,
    );
  }

  @Patch('provider-settings/:providerId')
  @Roles(Role.PROVIDER)
  async updateBreakSettingsAlt2(
    @Req() req: AuthenticatedRequest,
    @Param('providerId') providerId: string,
    @Body() body: { subscriptionBreaksEnabled: boolean },
  ) {
    return await this.breaksService.updateBreakSettings(
      providerId,
      req.user.userId,
      body.subscriptionBreaksEnabled,
    );
  }
}
