import { Controller, Get, Post, Param, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: { title: string; pricePerMonth: number; description?: string; providerId: string },
  ) {
    if (!body.title || !body.pricePerMonth || !body.providerId) {
      throw new BadRequestException('title, pricePerMonth, and providerId are required');
    }
    return this.mealPlansService.create(req.user.userId, body);
  }

  @Get('provider/:providerId')
  async findByProvider(@Param('providerId') providerId: string) {
    return this.mealPlansService.findByProvider(providerId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.mealPlansService.findById(id);
  }
}
