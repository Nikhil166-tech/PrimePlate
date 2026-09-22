import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReviewsService } from './reviews.service';
import { Review } from './review.entity';
import { User } from '../users/user.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Role } from '../common/roles.enum';

describe('Public Reviews Access & Modification Authorization', () => {
  let service: ReviewsService;
  let reviewRepo: any;
  let providerRepo: any;
  let userRepo: any;
  let subRepo: any;

  const providerOwnerAId = 'provider-user-a';
  const providerOwnerBId = 'provider-user-b';
  const providerKitchenBId = 'kitchen-b';
  const studentAId = 'student-a';
  const studentBId = 'student-b';

  beforeEach(async () => {
    reviewRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      remove: jest.fn(),
    };

    providerRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    userRepo = {
      findOne: jest.fn(),
    };

    subRepo = {
      createQueryBuilder: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: getRepositoryToken(Review), useValue: reviewRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(MealProvider), useValue: providerRepo },
        { provide: getRepositoryToken(Subscription), useValue: subRepo },
      ],
    }).compile();

    service = module.get<ReviewsService>(ReviewsService);
  });

  it('1. Provider A requests Provider B public reviews → SUCCESS (public reviews visible across providers)', async () => {
    const mockKitchenB = {
      id: providerKitchenBId,
      name: 'Kitchen B',
      userId: providerOwnerBId,
      user: { id: providerOwnerBId },
    };

    providerRepo.findOne.mockResolvedValue(mockKitchenB);

    const mockQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'rev-1',
          rating: 5,
          comment: 'Great food at Kitchen B!',
          student: { id: studentAId, name: 'Alice' },
          createdAt: new Date(),
        },
      ]),
    };
    reviewRepo.createQueryBuilder.mockReturnValue(mockQb);

    // Provider A browsing Provider B's page
    const result = await service.findByProvider(providerKitchenBId, {
      userId: providerOwnerAId,
      role: Role.PROVIDER,
    });

    expect(result).toHaveLength(1);
    expect(result[0].comment).toBe('Great food at Kitchen B!');
    expect(result[0].rating).toBe(5);
  });

  it('2. Public / student visitor requests Provider B public reviews → SUCCESS', async () => {
    const mockKitchenB = {
      id: providerKitchenBId,
      name: 'Kitchen B',
      userId: providerOwnerBId,
      user: { id: providerOwnerBId },
    };

    providerRepo.findOne.mockResolvedValue(mockKitchenB);

    const mockQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([
        {
          id: 'rev-1',
          rating: 4,
          comment: 'Tasty dinner!',
          student: { id: studentAId, name: 'Alice' },
        },
      ]),
    };
    reviewRepo.createQueryBuilder.mockReturnValue(mockQb);

    const result = await service.findByProvider(providerKitchenBId);

    expect(result).toHaveLength(1);
    expect(result[0].comment).toBe('Tasty dinner!');
  });

  it('3. Provider A or another student attempts to modify Student A review → FORBIDDEN', async () => {
    const mockReview = {
      id: 'rev-1',
      student: { id: studentAId },
      provider: { id: providerKitchenBId },
      comment: 'Original comment',
      rating: 5,
    };

    const mockQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockReview),
    };
    reviewRepo.createQueryBuilder.mockReturnValue(mockQb);

    // Provider A attempts to edit Alice's review
    await expect(
      service.update(providerOwnerAId, 'rev-1', 1, 'Fake edit'),
    ).rejects.toThrow('You can only edit your own review');

    // Student B attempts to edit Alice's review
    await expect(
      service.update(studentBId, 'rev-1', 1, 'Fake edit'),
    ).rejects.toThrow('You can only edit your own review');
  });

  it('4. Provider A or another student attempts to delete Student A review → FORBIDDEN', async () => {
    const mockReview = {
      id: 'rev-1',
      student: { id: studentAId },
      provider: { id: providerKitchenBId },
    };

    const mockQb: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(mockReview),
    };
    reviewRepo.createQueryBuilder.mockReturnValue(mockQb);

    await expect(service.delete(providerOwnerAId, 'rev-1')).rejects.toThrow(
      'You can only delete your own review',
    );
  });
});
