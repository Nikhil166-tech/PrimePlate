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
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get('provider/:providerId')
  async findByProvider(@Param('providerId') providerId: string) {
    return this.reviewsService.findByProvider(providerId);
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

  @Patch(':id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async reply(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { replyText: string },
  ) {
    return this.reviewsService.reply(req.user.userId, id, body.replyText);
  }
}
