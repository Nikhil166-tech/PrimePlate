import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealPlan } from './meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { CreateMealPlanDto } from './dto/create-meal-plan.dto';
import { UpdateMealPlanDto } from './dto/update-meal-plan.dto';

export function calculateDiscount(originalPrice: number, sellingPrice: number) {
  const orig = Number(originalPrice);
  const sell = Number(sellingPrice);

  if (isNaN(orig) || isNaN(sell) || orig <= 0 || sell <= 0 || sell >= orig) {
    return {
      discountAmount: 0,
      discountPercentage: 0,
      hasDiscount: false,
    };
  }

  const discountAmount = Math.round((orig - sell) * 100) / 100;
  const discountPercentage = Math.floor(((orig - sell) / orig) * 100);

  return {
    discountAmount,
    discountPercentage,
    hasDiscount: true,
  };
}

export function formatMealPlan(plan: MealPlan) {
  const originalPrice = Number(
    plan.originalPrice ?? plan.pricePerMonth ?? 0,
  );
  const sellingPrice = Number(
    plan.sellingPrice ?? plan.pricePerMonth ?? 0,
  );
  const { discountAmount, discountPercentage, hasDiscount } = calculateDiscount(
    originalPrice,
    sellingPrice,
  );

  return {
    ...plan,
    pricePerMonth: sellingPrice,
    originalPrice,
    sellingPrice,
    discountAmount,
    discountPercentage,
    hasDiscount,
  };
}

@Injectable()
export class MealPlansService {
  constructor(
    @InjectRepository(MealPlan)
    private readonly planRepo: Repository<MealPlan>,
    @InjectRepository(MealProvider)
    private readonly providerRepo: Repository<MealProvider>,
  ) {}

  async create(userId: string, dto: CreateMealPlanDto): Promise<MealPlan> {
    if (!dto.title || !dto.title.trim()) {
      throw new BadRequestException('title is required');
    }
    if (!dto.providerId) {
      throw new BadRequestException('providerId is required');
    }

    const origInput = dto.originalPrice ?? dto.pricePerMonth;
    const sellInput = dto.sellingPrice ?? dto.pricePerMonth;

    if (origInput === undefined || sellInput === undefined) {
      throw new BadRequestException(
        'originalPrice and sellingPrice are required',
      );
    }

    const orig = Number(origInput);
    const sell = Number(sellInput);

    if (isNaN(orig) || isNaN(sell) || !isFinite(orig) || !isFinite(sell)) {
      throw new BadRequestException('Prices must be valid numbers');
    }
    if (orig <= 0) {
      throw new BadRequestException(
        'Original price must be greater than 0',
      );
    }
    if (sell <= 0) {
      throw new BadRequestException(
        'Selling price must be greater than 0',
      );
    }
    if (sell > orig) {
      throw new BadRequestException(
        'Selling price cannot exceed original price',
      );
    }

    const provider = await this.providerRepo.findOne({
      where: { id: dto.providerId },
      relations: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider kitchen not found');
    if (provider.user && provider.user.id !== userId) {
      throw new ForbiddenException(
        'Cannot create meal plans for another provider',
      );
    }

    const plan = this.planRepo.create({
      title: dto.title.trim(),
      description: dto.description?.trim(),
      originalPrice: orig,
      sellingPrice: sell,
      pricePerMonth: sell, // synchronized for backward compatibility
      provider,
      isActive: dto.isActive ?? true,
    });

    const saved = await this.planRepo.save(plan);
    return formatMealPlan(saved) as any;
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateMealPlanDto,
  ): Promise<MealPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: { provider: { user: true } },
    });

    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }

    if (plan.provider?.user && plan.provider.user.id !== userId) {
      throw new ForbiddenException(
        'Cannot modify another provider\'s meal plan pricing',
      );
    }

    const currentOrig = Number(plan.originalPrice ?? plan.pricePerMonth);
    const currentSell = Number(plan.sellingPrice ?? plan.pricePerMonth);

    const newOrigInput = dto.originalPrice !== undefined ? dto.originalPrice : currentOrig;
    const newSellInput =
      dto.sellingPrice !== undefined
        ? dto.sellingPrice
        : dto.pricePerMonth !== undefined
          ? dto.pricePerMonth
          : currentSell;

    const newOrig = Number(newOrigInput);
    const newSell = Number(newSellInput);

    if (isNaN(newOrig) || isNaN(newSell) || !isFinite(newOrig) || !isFinite(newSell)) {
      throw new BadRequestException('Prices must be valid numbers');
    }
    if (newOrig <= 0) {
      throw new BadRequestException(
        'Original price must be greater than 0',
      );
    }
    if (newSell <= 0) {
      throw new BadRequestException(
        'Selling price must be greater than 0',
      );
    }
    if (newSell > newOrig) {
      throw new BadRequestException(
        'Selling price cannot exceed original price',
      );
    }

    if (dto.title !== undefined) plan.title = dto.title.trim();
    if (dto.description !== undefined) plan.description = dto.description?.trim();
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;

    plan.originalPrice = newOrig;
    plan.sellingPrice = newSell;
    plan.pricePerMonth = newSell; // keep synced for backward compatibility

    const saved = await this.planRepo.save(plan);
    return formatMealPlan(saved) as any;
  }

  async findByProvider(providerId: string): Promise<MealPlan[]> {
    const plans = await this.planRepo.find({
      where: { provider: { id: providerId }, isActive: true },
      relations: { provider: true },
      order: { createdAt: 'ASC' },
    });
    return plans.map(formatMealPlan) as any;
  }

  async findById(id: string): Promise<MealPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: { provider: true },
    });
    if (!plan) {
      throw new NotFoundException('Meal plan not found');
    }
    return formatMealPlan(plan) as any;
  }
}
