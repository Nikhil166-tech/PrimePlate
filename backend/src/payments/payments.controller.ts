import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import type { Request } from 'express';

@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create Razorpay Order for a Meal Plan' })
  async createOrder(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      mealPlanId: string;
      durationDays?: number | string;
      duration?: number | string;
    },
  ) {
    if (!body.mealPlanId)
      throw new BadRequestException('mealPlanId is required');
    const durationInput =
      body.durationDays !== undefined ? body.durationDays : body.duration;
    return this.paymentsService.createOrder(
      body.mealPlanId,
      req.user.userId,
      durationInput,
    );
  }

  @Post('verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Verify Razorpay Payment Signature and Activate Subscription',
  })
  async verifyPayment(
    @Req() req: AuthenticatedRequest,
    @Body()
    body: {
      razorpay_payment_id: string;
      razorpay_order_id: string;
      razorpay_signature: string;
      mealPlanId: string;
      durationDays?: number | string;
      duration?: number | string;
    },
  ) {
    if (
      !body.razorpay_payment_id ||
      !body.razorpay_order_id ||
      !body.mealPlanId
    ) {
      throw new BadRequestException('Missing payment verification details');
    }

    const durationInput =
      body.durationDays !== undefined ? body.durationDays : body.duration;

    return this.paymentsService.processVerifiedPayment({
      userId: req.user.userId,
      razorpayOrderId: body.razorpay_order_id,
      razorpayPaymentId: body.razorpay_payment_id,
      razorpaySignature: body.razorpay_signature || '',
      mealPlanId: body.mealPlanId,
      durationInput,
    });
  }

  @Post('webhook')
  @ApiOperation({ summary: 'Razorpay Webhook Listener' })
  async handleWebhook(
    @Headers('x-razorpay-signature') signature: string,
    @Body() body: Record<string, any>,
    @Req() req: Request,
  ) {
    const rawBody = (req as Record<string, any>).rawBody
      ? String((req as Record<string, any>).rawBody)
      : JSON.stringify(body);
    return this.paymentsService.handleWebhook(rawBody, signature, body);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.STUDENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Payment History for Authenticated Student' })
  async getHistory(@Req() req: AuthenticatedRequest) {
    return this.paymentsService.getHistory(req.user.userId);
  }
}
