import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WeeklyMenu } from './weekly-menu.entity';
import { MealProvider } from '../providers/meal-provider.entity';

@Injectable()
export class WeeklyMenusService {
  constructor(
    @InjectRepository(WeeklyMenu)
    private readonly menuRepo: Repository<WeeklyMenu>,
    @InjectRepository(MealProvider)
    private readonly providerRepo: Repository<MealProvider>,
  ) {}

  async findByProvider(providerId: string): Promise<WeeklyMenu[]> {
    return this.menuRepo.find({
      where: { provider: { id: providerId } },
      order: { dayOfWeek: 'ASC' },
    });
  }

  async saveWeeklyMenu(
    userId: string,
    providerId: string,
    items: Array<{ dayOfWeek: number; mealType: string; menuItems: string; description?: string }>,
  ): Promise<WeeklyMenu[]> {
    const provider = await this.providerRepo.findOne({
      where: { id: providerId },
      relations: { user: true },
    });

    if (!provider) {
      throw new NotFoundException('Kitchen provider not found');
    }

    if (provider.user?.id !== userId && provider.userId !== userId) {
      throw new UnauthorizedException('Not authorized to modify menu for this mess');
    }

    // Upsert menu items per dayOfWeek & mealType
    const savedMenus: WeeklyMenu[] = [];
    for (const item of items) {
      let existing = await this.menuRepo.findOne({
        where: {
          provider: { id: providerId },
          dayOfWeek: item.dayOfWeek,
          mealType: item.mealType,
        },
      });

      if (existing) {
        existing.menuItems = item.menuItems;
        existing.description = item.description || '';
        savedMenus.push(await this.menuRepo.save(existing));
      } else {
        const created = this.menuRepo.create({
          provider,
          dayOfWeek: item.dayOfWeek,
          mealType: item.mealType,
          menuItems: item.menuItems,
          description: item.description || '',
        });
        savedMenus.push(await this.menuRepo.save(created));
      }
    }

    return savedMenus;
  }
}
