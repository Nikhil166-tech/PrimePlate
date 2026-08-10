import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, ILike } from 'typeorm';
import { Category } from '../common/enums/category.enum';
import { ProviderDto } from './dto/provider.dto';
import { MealProvider } from './meal-provider.entity';
import { UsersService } from '../users/users.service';
import { Role } from '../common/roles.enum';
import { ProviderApprovalStatus } from '../common/enums/provider-approval-status.enum';

import { Subscription, SubscriptionStatus } from '../subscriptions/subscription.entity';

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(MealProvider)
    private readonly providerRepo: Repository<MealProvider>,
    @InjectRepository(Subscription)
    private readonly subRepo: Repository<Subscription>,
    private readonly usersService: UsersService,
  ) {}

  async create(userId: string, dto: ProviderDto): Promise<MealProvider> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== Role.PROVIDER) {
      throw new ForbiddenException(
        'Only providers can create a provider profile',
      );
    }
    const provider = this.providerRepo.create({
      user,
      name: dto.name,
      city: dto.city,
      description: dto.description,
      address: dto.address,
      imageUrl: dto.imageUrl,
      category: dto.category,
      totalCapacity: dto.totalCapacity || 50,
      acceptingSubscriptions: dto.acceptingSubscriptions ?? true,
      amenities: dto.amenities || [],
      contactPhone: dto.contactPhone || user.phone || '',
      approvalStatus: ProviderApprovalStatus.PENDING,
      verified: false,
    } as Partial<MealProvider>);
    return this.providerRepo.save(provider);
  }

  private async attachCapacityInfo(provider: MealProvider): Promise<any> {
    const currentSubscribers = await this.subRepo.count({
      where: {
        mealPlan: { provider: { id: provider.id } },
        status: SubscriptionStatus.ACTIVE,
      },
    });
    const totalCapacity =
      provider.totalCapacity !== undefined && provider.totalCapacity !== null
        ? Number(provider.totalCapacity)
        : null;
    const remainingCapacity =
      totalCapacity !== null
        ? Math.max(0, totalCapacity - currentSubscribers)
        : null;

    // Sanitize user object to never expose passwordHash
    const safeUser = provider.user
      ? { id: provider.user.id, email: provider.user.email, name: provider.user.name, role: provider.user.role }
      : undefined;

    return {
      ...provider,
      user: safeUser,
      totalCapacity,
      currentSubscribers,
      remainingCapacity,
    };
  }

  async findAll(filters?: { category?: Category }): Promise<any[]> {
    const where: FindOptionsWhere<MealProvider> = {
      approvalStatus: ProviderApprovalStatus.APPROVED,
    };
    if (filters?.category) {
      where.category = filters.category;
    }
    const providers = await this.providerRepo.find({ where });
    return Promise.all(providers.map((p) => this.attachCapacityInfo(p)));
  }

  async findByUserId(userId: string): Promise<any[]> {
    const providers = await this.providerRepo.find({
      where: { user: { id: userId } },
    });
    return Promise.all(providers.map((p) => this.attachCapacityInfo(p)));
  }

  async findPending(): Promise<MealProvider[]> {
    return this.providerRepo.find({
      where: { approvalStatus: ProviderApprovalStatus.PENDING },
    });
  }

  async findById(id: string): Promise<any> {
    const provider = await this.providerRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return this.attachCapacityInfo(provider);
  }

  async update(
    userId: string,
    id: string,
    dto: ProviderDto,
  ): Promise<MealProvider> {
    const provider = await this.providerRepo.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    if (provider.user.id !== userId) {
      throw new ForbiddenException('Cannot edit other providers');
    }

    // Whitelist update fields to prevent mass assignment of approvalStatus or verified
    if (dto.name !== undefined) provider.name = dto.name;
    if (dto.city !== undefined) provider.city = dto.city;
    if (dto.description !== undefined) provider.description = dto.description;
    if (dto.address !== undefined) provider.address = dto.address;
    if (dto.imageUrl !== undefined) provider.imageUrl = dto.imageUrl;
    if (dto.category !== undefined) provider.category = dto.category;
    if (dto.totalCapacity !== undefined) provider.totalCapacity = dto.totalCapacity;
    if (dto.acceptingSubscriptions !== undefined) provider.acceptingSubscriptions = dto.acceptingSubscriptions;
    if (dto.amenities !== undefined) provider.amenities = dto.amenities;
    if (dto.contactPhone !== undefined) provider.contactPhone = dto.contactPhone;
    if (dto.monthlyPrice !== undefined) provider.monthlyPrice = dto.monthlyPrice;

    const saved = await this.providerRepo.save(provider);
    return this.attachCapacityInfo(saved);
  }

  async approve(id: string): Promise<MealProvider> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    provider.approvalStatus = ProviderApprovalStatus.APPROVED;
    provider.verified = true;
    return this.providerRepo.save(provider);
  }

  async reject(id: string): Promise<MealProvider> {
    const provider = await this.providerRepo.findOne({ where: { id } });
    if (!provider) throw new NotFoundException('Provider not found');
    provider.approvalStatus = ProviderApprovalStatus.REJECTED;
    provider.verified = false;
    return this.providerRepo.save(provider);
  }

  async search(filters: {
    name?: string;
    city?: string;
    category?: Category;
  }): Promise<any[]> {
    const where: FindOptionsWhere<MealProvider> = {
      approvalStatus: ProviderApprovalStatus.APPROVED,
    };
    if (filters.name) {
      where.name = ILike(`%${filters.name}%`);
    }
    if (filters.city) {
      where.city = ILike(`%${filters.city}%`);
    }
    if (filters.category) {
      where.category = filters.category;
    }
    const providers = await this.providerRepo.find({ where });
    return Promise.all(providers.map((p) => this.attachCapacityInfo(p)));
  }
}
