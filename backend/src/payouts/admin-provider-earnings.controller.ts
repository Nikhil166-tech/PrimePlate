import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { MarkPaidDto } from './dto/mark-paid.dto';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@ApiTags('Admin Provider Earnings & Settlement Management')
@Controller('admin/provider-earnings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@ApiBearerAuth()
export class AdminProviderEarningsController {
  constructor(private readonly payoutsService: PayoutsService) {}

  @Get()
  @ApiOperation({
    summary: 'Get Platform Provider Earnings Summary & Provider List',
  })
  async getOverview(
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    const summary = await this.payoutsService.getAdminEarningsSummary();
    const providers = await this.payoutsService.getAdminProviderEarningsList({
      search,
      status,
    });
    return {
      summary,
      providers,
    };
  }

  @Get(':providerId')
  @ApiOperation({
    summary: 'Get Detailed Provider Earnings & Transaction-Level Ledger',
  })
  async getProviderDetail(
    @Param('providerId') providerId: string,
    @Query('status') status?: string,
  ) {
    return this.payoutsService.getAdminProviderEarningsDetail(providerId, {
      status,
    });
  }

  @Patch(':id/mark-paid')
  @ApiOperation({
    summary: 'Manually Mark an Individual Provider Earning as Paid',
  })
  async markPaid(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body?: MarkPaidDto,
  ) {
    return this.payoutsService.markEarningAsPaid(
      id,
      {
        userId: req.user.userId,
        email: (req.user as any)?.email || 'admin@primeplate.com',
      },
      body?.settlementReference,
    );
  }
}
