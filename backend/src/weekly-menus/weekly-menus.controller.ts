import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WeeklyMenusService } from './weekly-menus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@ApiTags('Weekly Menus')
@Controller('weekly-menus')
export class WeeklyMenusController {
  constructor(private readonly weeklyMenusService: WeeklyMenusService) {}

  @Get('provider/:providerId')
  @ApiOperation({ summary: 'Get weekly 7-day menu for a mess provider' })
  async getByProvider(@Param('providerId') providerId: string) {
    return this.weeklyMenusService.findByProvider(providerId);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Save or update weekly menu schedule' })
  async saveMenu(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      providerId: string;
      items: Array<{
        dayOfWeek: number;
        mealType: string;
        menuItems: string;
        description?: string;
      }>;
    },
  ) {
    if (!body.providerId || !Array.isArray(body.items)) {
      throw new BadRequestException('providerId and items array are required');
    }
    return this.weeklyMenusService.saveWeeklyMenu(
      req.user.userId,
      body.providerId,
      body.items,
    );
  }
}
