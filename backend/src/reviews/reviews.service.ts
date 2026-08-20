import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { User } from '../users/user.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { Subscription } from '../subscriptions/subscription.entity';
import { Role } from '../common/roles.enum';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private reviewRepo: Repository<Review>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(MealProvider)
    private providerRepo: Repository<MealProvider>,
    @InjectRepository(Subscription)
    private subscriptionRepo: Repository<Subscription>,
  ) {}

  async findByProvider(
    providerId: string,
    currentUser?: { userId: string; role: string },
  ): Promise<any[]> {
    if (!providerId || typeof providerId !== 'string') {
      throw new BadRequestException('providerId is required');
    }

    const provider = await this.providerRepo.findOne({
      where: { id: providerId },
      relations: { user: true },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    if (currentUser && (currentUser.role || '').toUpperCase() === Role.PROVIDER) {
      const ownerId = provider.userId || provider.user?.id;
      if (ownerId !== currentUser.userId) {
        throw new ForbiddenException('You can only view reviews for your own PG');
      }
    }

    const reviews = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.student', 'student')
      .leftJoinAndSelect('review.provider', 'provider')
      .where('provider.id = :providerId', { providerId })
      .orderBy('review.createdAt', 'DESC')
      .getMany();

    return reviews.map((r: any) => {
      const safeStudent = r.student
        ? { id: r.student.id, name: r.student.name || 'Student Customer' }
        : undefined;
      return {
        ...r,
        student: safeStudent,
      };
    });
  }

  async create(
    studentId: string,
    providerId: string,
    rating: number,
    comment: string,
  ): Promise<Review> {
    if (!providerId || typeof providerId !== 'string') {
      throw new BadRequestException('providerId is required');
    }

    if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be an integer between 1 and 5');
    }

    if (typeof comment !== 'string' || comment.trim().length === 0) {
      throw new BadRequestException('Comment is required and cannot be empty or whitespace only');
    }

    const trimmedComment = comment.trim();
    if (trimmedComment.length > 1000) {
      throw new BadRequestException('Comment exceeds maximum length of 1000 characters');
    }

    const student = await this.userRepo.findOne({ where: { id: studentId } });
    if (!student) throw new NotFoundException('Student not found');

    const provider = await this.providerRepo.findOne({
      where: { id: providerId },
    });
    if (!provider) throw new NotFoundException('Provider not found');

    const sub = await this.subscriptionRepo
      .createQueryBuilder('subscription')
      .leftJoin('subscription.student', 'student')
      .leftJoin('subscription.mealPlan', 'mealPlan')
      .leftJoin('mealPlan.provider', 'provider')
      .where('student.id = :studentId', { studentId })
      .andWhere('provider.id = :providerId', { providerId })
      .getOne();

    if (!sub) {
      throw new ForbiddenException('You can only review a PG you have or had a subscription with');
    }

    const existingReview = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.student', 'student')
      .leftJoin('review.provider', 'provider')
      .where('student.id = :studentId', { studentId })
      .andWhere('provider.id = :providerId', { providerId })
      .getOne();

    if (existingReview) {
      throw new ConflictException('You have already reviewed this provider. Please edit your existing review.');
    }

    const review = this.reviewRepo.create({
      student,
      provider,
      rating,
      comment: trimmedComment,
    });

    const saved = await this.reviewRepo.save(review);
    await this.recalculateProviderRating(providerId);
    return saved;
  }

  async update(
    studentId: string,
    reviewId: string,
    rating?: number,
    comment?: string,
  ): Promise<Review> {
    const review = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.student', 'student')
      .leftJoinAndSelect('review.provider', 'provider')
      .where('review.id = :reviewId', { reviewId })
      .getOne();

    if (!review) throw new NotFoundException('Review not found');

    if (review.student.id !== studentId) {
      throw new ForbiddenException('You can only edit your own review');
    }

    if (rating !== undefined) {
      if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new BadRequestException('Rating must be an integer between 1 and 5');
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      if (typeof comment !== 'string' || comment.trim().length === 0) {
        throw new BadRequestException('Comment cannot be empty or whitespace only');
      }
      const trimmed = comment.trim();
      if (trimmed.length > 1000) {
        throw new BadRequestException('Comment exceeds maximum length of 1000 characters');
      }
      review.comment = trimmed;
    }

    const updated = await this.reviewRepo.save(review);
    await this.recalculateProviderRating(review.provider.id);
    return updated;
  }

  async delete(studentId: string, reviewId: string): Promise<{ success: boolean }> {
    const review = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoinAndSelect('review.student', 'student')
      .leftJoinAndSelect('review.provider', 'provider')
      .where('review.id = :reviewId', { reviewId })
      .getOne();

    if (!review) throw new NotFoundException('Review not found');

    if (review.student.id !== studentId) {
      throw new ForbiddenException('You can only delete your own review');
    }

    const providerId = review.provider.id;
    await this.reviewRepo.remove(review);
    await this.recalculateProviderRating(providerId);
    return { success: true };
  }

  async recalculateProviderRating(providerId: string): Promise<void> {
    const reviews = await this.reviewRepo
      .createQueryBuilder('review')
      .leftJoin('review.provider', 'provider')
      .where('provider.id = :providerId', { providerId })
      .getMany();

    const provider = await this.providerRepo.findOne({
      where: { id: providerId },
    });

    if (provider) {
      if (reviews.length > 0) {
        const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        provider.rating = Math.round(avg * 10) / 10;
      } else {
        provider.rating = 0;
      }
      await this.providerRepo.save(provider);
    }
  }
}
