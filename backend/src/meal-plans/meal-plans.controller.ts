import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { MealPlansService } from './meal-plans.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { UpdateMealPlanDto } from './dto/update-meal-plan.dto';

@Controller('meal-plans')
export class MealPlansController {
  constructor(private readonly mealPlansService: MealPlansService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: CreateMealPlanDto,
  ) {
    return this.mealPlansService.create(req.user.userId, body);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: UpdateMealPlanDto,
  ) {
    return this.mealPlansService.update(req.user.userId, id, body);
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
