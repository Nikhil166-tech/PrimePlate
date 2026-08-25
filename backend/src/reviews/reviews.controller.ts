import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('provider/:providerId')
  @UseGuards(OptionalJwtAuthGuard)
  async findByProvider(
    @Req() req: AuthenticatedRequest,
    @Param('providerId') providerId: string,
  ) {
    return this.reviewsService.findByProvider(providerId, req.user);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() body: { providerId: string; rating: number; comment: string },
  ) {
    return this.reviewsService.create(
      req.user.userId,
      body.providerId,
      body.rating,
      body.comment,
    );
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { rating?: number; comment?: string },
  ) {
    return this.reviewsService.update(
      req.user.userId,
      id,
      body.rating,
      body.comment,
    );
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  async delete(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.reviewsService.delete(req.user.userId, id);
  }
}
