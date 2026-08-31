import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Put,
  Patch,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ProvidersService } from './providers.service';
import { ProviderDto } from './dto/provider.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../common/roles.enum';
import { Category } from '../common/enums/category.enum';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: ProviderDto) {
    return this.providersService.create(req.user.userId, dto);
  }

  @Get()
  async findAll(@Query('category') category?: Category) {
    const filters = category ? { category } : undefined;
    return this.providersService.findAll(filters);
  }

  @Get('categories')
  getCategories() {
    return Object.values(Category);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async findMyProviders(@Req() req: AuthenticatedRequest) {
    return this.providersService.findByUserId(req.user.userId);
  }

  @Get('search')
  async search(
    @Query('name') name?: string,
    @Query('city') city?: string,
    @Query('category') category?: Category,
  ) {
    return this.providersService.search({ name, city, category });
  }

  @Get('nearby')
  async findNearby(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);
    const parsedRadius = radius ? parseFloat(radius) : 5;
    return this.providersService.findNearby(parsedLat, parsedLng, parsedRadius);
  }

  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async findPending() {
    return this.providersService.findPending();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.providersService.findById(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ProviderDto,
  ) {
    return this.providersService.update(req.user.userId, id, dto);
  }

  @Patch(':id/subscription-break-settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.PROVIDER)
  async updateBreakSettings(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: { subscriptionBreaksEnabled: boolean },
  ) {
    return this.providersService.updateBreakSettings(
      id,
      req.user.userId,
      body.subscriptionBreaksEnabled,
    );
  }

  @Patch('approve/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async approve(@Param('id') id: string) {
    return this.providersService.approve(id);
  }

  @Patch('reject/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async reject(@Param('id') id: string) {
    return this.providersService.reject(id);
  }
}
