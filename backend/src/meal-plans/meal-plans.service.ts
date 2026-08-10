import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
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
    dto: { title: string; pricePerMonth: number; description?: string; providerId: string },
  ): Promise<MealPlan> {
    const provider = await this.providerRepo.findOne({
      where: { id: dto.providerId },
      relations: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider kitchen not found');
    if (provider.user && provider.user.id !== userId) {
      throw new ForbiddenException('Cannot create meal plans for another provider');
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
    return this.planRepo.find({
      where: { provider: { id: providerId }, isActive: true },
    });
  }

  async findById(id: string): Promise<MealPlan> {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Meal plan not found');
    return plan;
  }
}
