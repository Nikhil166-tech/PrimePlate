import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { User } from '../users/user.entity';
import { MealProvider } from '../providers/meal-provider.entity';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private reviewRepo: Repository<Review>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(MealProvider)
    private providerRepo: Repository<MealProvider>,
  ) {}

  async create(
    studentId: string,
    providerId: string,
    rating: number,
    comment: string,
  ): Promise<Review> {
    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const provider = await this.providerRepo.findOne({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const review = this.reviewRepo.create({
      student,
      provider,
      rating,
      comment,
    });

    const saved = await this.reviewRepo.save(review);

    // Recalculate provider average rating
    const reviews = await this.reviewRepo.find({
      where: { provider: { id: providerId } },
    });
    if (reviews.length > 0) {
      const avg =
        reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      provider.rating = Math.round(avg * 10) / 10;
      await this.providerRepo.save(provider);
    }

    return saved;
  }

  async findByProvider(providerId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { provider: { id: providerId } },
      order: { createdAt: 'DESC' },
    });
  }

  async reply(
    providerUserId: string,
    reviewId: string,
    replyText: string,
  ): Promise<Review> {
    const review = await this.reviewRepo.findOne({
      where: { id: reviewId },
      relations: { provider: { user: true } },
    });
    if (!review) throw new NotFoundException('Review not found');

    if (review.provider.user.id !== providerUserId) {
      throw new ForbiddenException(
        'Only the kitchen provider owner can reply to this review',
      );
    }

    review.providerReply = replyText;
    return this.reviewRepo.save(review);
  }
}
