import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';

@ApiTags('Analytics')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('public-summary')
  @ApiOperation({ summary: 'Public summary stats for homepage' })
  async getPublicSummary() {
    const totalProviders = await this.analyticsService.getTotalProviders();
    const totalUsers = await this.analyticsService.getTotalUsers();
    return {
      approvedProviders: totalProviders,
      happyStudents: totalUsers,
    };
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Total number of users' })
  async getTotalUsers() {
    const total = await this.analyticsService.getTotalUsers();
    return { totalUsers: total };
  }

  @Get('providers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Total number of providers' })
  async getTotalProviders() {
    const total = await this.analyticsService.getTotalProviders();
    return { totalProviders: total };
  }

  @Get('subscriptions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Total number of subscriptions' })
  async getTotalSubscriptions() {
    const total = await this.analyticsService.getTotalSubscriptions();
    return { totalSubscriptions: total };
  }

  @Get('revenue')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Total revenue from successful payments' })
  async getTotalRevenue() {
    const total = await this.analyticsService.getTotalRevenue();
    return { totalRevenue: total };
  }

  @Get('todays-users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Number of users registered today' })
  async getTodaysUsers() {
    const total = await this.analyticsService.getTodaysUsers();
    return { todaysUsers: total };
  }

  @Get('pending-approvals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Number of providers pending admin approval' })
  async getPendingApprovals() {
    const total = await this.analyticsService.getPendingApprovals();
    return { pendingApprovals: total };
  }
}
