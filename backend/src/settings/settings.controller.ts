import { Controller, Get, Put, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService, FeeSettingsDto } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { Public } from '../auth/public.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Public()
  @Get('public/fees')
  @ApiOperation({
    summary: 'Get Active Platform Fee Configuration for Checkout (Public)',
  })
  async getPublicFees() {
    return this.settingsService.getPublicFeeSettings();
  }

  @Get('fees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Get Platform Fee Configuration, Analytics, and Audits (Admin Only)',
  })
  async getAdminFees() {
    const [settings, analytics, audits] = await Promise.all([
      this.settingsService.getFeeSettings(),
      this.settingsService.getFeeAnalytics(),
      this.settingsService.getFeeAudits(20),
    ]);

    return {
      settings,
      analytics,
      audits,
    };
  }

  @Put('fees')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Platform Fee Configuration (Admin Only)' })
  async updateAdminFees(
    @Req() req: AuthenticatedRequest,
    @Body() body: Partial<FeeSettingsDto>,
  ) {
    const updated = await this.settingsService.updateFeeSettings(body, {
      userId: req.user.userId,
      email: (req.user as any).email,
    });

    const [analytics, audits] = await Promise.all([
      this.settingsService.getFeeAnalytics(),
      this.settingsService.getFeeAudits(20),
    ]);

    return {
      settings: updated,
      analytics,
      audits,
      message: 'Platform fee settings updated successfully',
    };
  }
}
