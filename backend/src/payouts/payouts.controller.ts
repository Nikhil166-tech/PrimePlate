import { Controller, Get, UseGuards, Req, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@ApiTags('Payouts & Provider Earnings Ledger')
@Controller('payouts')
export class PayoutsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get('provider/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Financial Earnings Summary for Provider' })
  async getSummary(
    @Req() req: AuthenticatedRequest,
    @Query('kitchenId') kitchenId?: string,
  ) {
    return this.payoutsService.getProviderSummary(req.user.userId, kitchenId);
  }

  @Get('provider/history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Provider Earnings History Ledger' })
  async getHistory(
    @Req() req: AuthenticatedRequest,
    @Query('kitchenId') kitchenId?: string,
  ) {
    return this.payoutsService.getProviderHistory(req.user.userId, kitchenId);
  }
}
