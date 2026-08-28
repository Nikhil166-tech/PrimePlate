import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MealPlan } from './meal-plan.entity';
import { MealProvider } from '../providers/meal-provider.entity';

@Injectable()
export class MealPlansService {
  constructor(
    @InjectRepository(MealPlan)
    private readonly planRepo: Repository<MealPlan>,
    @InjectRepository(MealProvider)
    private readonly providerRepo: Repository<MealProvider>,
  ) {}

  async create(
    userId: string,
    dto: {
      title: string;
      pricePerMonth: number;
      description?: string;
      providerId: string;
    },
  ): Promise<MealPlan> {
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
      title: dto.title,
      pricePerMonth: dto.pricePerMonth,
      description: dto.description,
      provider,
      isActive: true,
    });
    return this.planRepo.save(plan);
  }

  async findByProvider(providerId: string): Promise<MealPlan[]> {
    const plans = await this.planRepo.find({
      where: { provider: { id: providerId }, isActive: true },
      relations: { provider: true },
    });
    if (plans.length > 0) return plans;

    const provider = await this.providerRepo.findOne({
      where: { id: providerId },
    });
    if (
      provider &&
      provider.monthlyPrice &&
      Number(provider.monthlyPrice) > 0
    ) {
      const defaultPlan = this.planRepo.create({
        title: 'Monthly Subscription Plan',
        pricePerMonth: Number(provider.monthlyPrice),
        description: 'Daily fresh cooked breakfast, lunch & dinner',
        provider,
        isActive: true,
      });
      try {
        const saved = await this.planRepo.save(defaultPlan);
        return [saved];
      } catch (err) {
        return [
          {
            id: provider.id,
            title: 'Monthly Subscription Plan',
            pricePerMonth: Number(provider.monthlyPrice),
            description: 'Daily fresh cooked breakfast, lunch & dinner',
            provider,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          } as any,
        ];
      }
    }

    return [];
  }

  async findById(id: string): Promise<MealPlan> {
    const plan = await this.planRepo.findOne({
      where: { id },
      relations: { provider: true },
    });
    if (plan) return plan;

    const provider = await this.providerRepo.findOne({ where: { id } });
    if (
      provider &&
      provider.monthlyPrice &&
      Number(provider.monthlyPrice) > 0
    ) {
      const newPlan = this.planRepo.create({
        title: `${provider.name} Monthly Mess Plan`,
        pricePerMonth: Number(provider.monthlyPrice),
        description: 'Daily fresh cooked breakfast, lunch & dinner',
        provider,
        isActive: true,
      });
      try {
        return await this.planRepo.save(newPlan);
      } catch (_) {
        return newPlan;
      }
    }

    throw new NotFoundException('Meal plan not found');
  }
}
