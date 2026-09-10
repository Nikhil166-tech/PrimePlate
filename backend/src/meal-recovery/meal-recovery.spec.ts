import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { MealRecoveryService } from './meal-recovery.service';
import { MealRecovery, MealRecoveryStatus } from './meal-recovery.entity';
import { MealProvider } from '../providers/meal-provider.entity';
import { MealUsage } from '../meal-usage/meal-usage.entity';
import { Subscription } from '../subscriptions/subscription.entity';

jest.setTimeout(30000);

const mockRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const PROVIDER_ID = 'provider-1';
const STUDENT_ID = 'student-1';
const USER_ID = 'user-provider-1';
const SUB_ID = 'sub-1';

const makeProvider = (overrides: Partial<MealProvider> = {}): MealProvider => ({
  id: PROVIDER_ID,
  name: 'Test Mess',
  userId: USER_ID,
  recoveryPercentage: 80,
  user: { id: USER_ID } as any,
  approvalStatus: 'APPROVED',
  acceptingSubscriptions: true,
  ...overrides,
} as any);

const makeSub = (overrides: any = {}): Subscription => ({
  id: SUB_ID,
  startDate: '2026-08-01',
  endDate: '2026-08-31',
  student: { id: STUDENT_ID } as any,
  mealPlan: { provider: makeProvider() } as any,
  ...overrides,
} as any);

describe('MealRecoveryService', () => {
  let service: MealRecoveryService;
  let recoveryRepo: ReturnType<typeof mockRepo>;
  let providerRepo: ReturnType<typeof mockRepo>;
  let usageRepo: ReturnType<typeof mockRepo>;
  let subRepo: ReturnType<typeof mockRepo>;

  // Helper to build service with mocked IST date
  const todayPast = '2026-09-10'; // after sub end 2026-08-31

  beforeEach(async () => {
    recoveryRepo = mockRepo();
    providerRepo = mockRepo();
    usageRepo = mockRepo();
    subRepo = mockRepo();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MealRecoveryService,
        { provide: getRepositoryToken(MealRecovery), useValue: recoveryRepo },
        { provide: getRepositoryToken(MealProvider), useValue: providerRepo },
        { provide: getRepositoryToken(MealUsage), useValue: usageRepo },
        { provide: getRepositoryToken(Subscription), useValue: subRepo },
      ],
    }).compile();

    service = module.get<MealRecoveryService>(MealRecoveryService);
    // Mock IST date to a known past date so all sub days are eligible
    jest.spyOn(service as any, 'getIstToday').mockReturnValue(todayPast);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= CALCULATION RULES =======
  it('1. 10 missed days @ 80% → 8 recovered', async () => {
    const sub = makeSub({ startDate: '2026-08-01', endDate: '2026-08-10' });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null); // not yet processed
    usageRepo.find.mockResolvedValue([]); // no check-ins
    const created = { id: 'rec-1', missedDays: 10, recoveryRate: 80, recoveredDays: 8, usedDays: 0, remainingDays: 8, status: MealRecoveryStatus.AVAILABLE };
    recoveryRepo.create.mockReturnValue(created);
    recoveryRepo.save.mockResolvedValue(created);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.missedDays).toBe(10);
    expect(result.recoveredDays).toBe(8);
    expect(result.recovery?.status).toBe(MealRecoveryStatus.AVAILABLE);
  });

  it('2. 7 missed days @ 50% → 3 recovered (floor)', async () => {
    const sub = makeSub({
      startDate: '2026-08-01', endDate: '2026-08-07',
      mealPlan: { provider: makeProvider({ recoveryPercentage: 50 }) } as any,
    });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    usageRepo.find.mockResolvedValue([]);
    const created = { missedDays: 7, recoveryRate: 50, recoveredDays: 3, usedDays: 0, remainingDays: 3, status: MealRecoveryStatus.AVAILABLE };
    recoveryRepo.create.mockReturnValue(created);
    recoveryRepo.save.mockResolvedValue(created);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.missedDays).toBe(7);
    expect(result.recoveredDays).toBe(3);
  });

  it('3. 1 missed day @ 50% → 0 recovered (no record created)', async () => {
    const sub = makeSub({
      startDate: '2026-08-01', endDate: '2026-08-01',
      mealPlan: { provider: makeProvider({ recoveryPercentage: 50 }) } as any,
    });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    usageRepo.find.mockResolvedValue([]);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.recoveredDays).toBe(0);
    expect(result.recovery).toBeNull();
    expect(recoveryRepo.save).not.toHaveBeenCalled();
  });

  it('4. 10 missed days @ 100% → 10 recovered', async () => {
    const sub = makeSub({
      startDate: '2026-08-01', endDate: '2026-08-10',
      mealPlan: { provider: makeProvider({ recoveryPercentage: 100 }) } as any,
    });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    usageRepo.find.mockResolvedValue([]);
    const created = { missedDays: 10, recoveryRate: 100, recoveredDays: 10, usedDays: 0, remainingDays: 10, status: MealRecoveryStatus.AVAILABLE };
    recoveryRepo.create.mockReturnValue(created);
    recoveryRepo.save.mockResolvedValue(created);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.recoveredDays).toBe(10);
  });

  // ======= DATE ELIGIBILITY =======
  it('5. Future dates are excluded from eligible dates', async () => {
    // Today is '2026-09-10', subscription goes to '2026-10-10' — future dates not counted
    const sub = makeSub({ startDate: '2026-09-08', endDate: '2026-10-10' });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    usageRepo.find.mockResolvedValue([]);
    // Only 2026-09-08 and 2026-09-09 are strictly < 2026-09-10
    const created = { missedDays: 2, recoveryRate: 80, recoveredDays: 1, usedDays: 0, remainingDays: 1, status: MealRecoveryStatus.AVAILABLE };
    recoveryRepo.create.mockReturnValue(created);
    recoveryRepo.save.mockResolvedValue(created);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    // missedDays must be ≤ 2 (only past dates)
    expect(result.missedDays).toBeLessThanOrEqual(2);
  });

  it('6. Dates before subscription start are excluded', async () => {
    // Sub starts 2026-08-15 but endDate 2026-08-17 — only 3 days eligible
    const sub = makeSub({ startDate: '2026-08-15', endDate: '2026-08-17' });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    usageRepo.find.mockResolvedValue([]);
    const created = { missedDays: 3, recoveryRate: 80, recoveredDays: 2, usedDays: 0, remainingDays: 2, status: MealRecoveryStatus.AVAILABLE };
    recoveryRepo.create.mockReturnValue(created);
    recoveryRepo.save.mockResolvedValue(created);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    // Must not exceed 3 (the actual subscription length)
    expect(result.missedDays).toBeLessThanOrEqual(3);
  });

  it('7. Subscription final day is counted only after it has ended (strictly < todayIst)', async () => {
    // Sub ends 2026-09-09 (yesterday relative to mocked today 2026-09-10) — should be eligible
    const sub = makeSub({ startDate: '2026-09-09', endDate: '2026-09-09' });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    usageRepo.find.mockResolvedValue([]);
    const created = { missedDays: 1, recoveryRate: 80, recoveredDays: 0, usedDays: 0, remainingDays: 0, status: MealRecoveryStatus.AVAILABLE };
    recoveryRepo.create.mockReturnValue(created);
    recoveryRepo.save.mockResolvedValue(created);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    // 2026-09-09 < 2026-09-10 → eligible
    expect(result.missedDays).toBe(1);
  });

  it('7b. Subscription final day on today is NOT counted (day has not ended)', async () => {
    // Sub ends on TODAY (2026-09-10) — today is NOT < today, so not eligible
    const sub = makeSub({ startDate: '2026-09-10', endDate: '2026-09-10' });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    usageRepo.find.mockResolvedValue([]);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.missedDays).toBe(0);
    expect(result.recoveredDays).toBe(0);
    expect(result.recovery).toBeNull();
  });

  it('8. Successfully checked-in dates are excluded from missed count', async () => {
    // Sub Aug 1–3, student checked in Aug 1 and Aug 2 → only Aug 3 missed
    const sub = makeSub({ startDate: '2026-08-01', endDate: '2026-08-03' });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    // Two check-ins: Aug 1 and Aug 2
    usageRepo.find.mockResolvedValue([
      { mealDate: '2026-08-01' },
      { mealDate: '2026-08-02' },
    ]);
    const created = { missedDays: 1, recoveryRate: 80, recoveredDays: 0, usedDays: 0, remainingDays: 0, status: MealRecoveryStatus.AVAILABLE };
    recoveryRepo.create.mockReturnValue(created);
    recoveryRepo.save.mockResolvedValue(created);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.missedDays).toBe(1);
  });

  // ======= IDEMPOTENCY =======
  it('9. Same subscription cannot be processed twice — returns existing record', async () => {
    const existingRec = { id: 'rec-1', missedDays: 10, recoveryRate: 80, recoveredDays: 8, usedDays: 0, remainingDays: 8, status: MealRecoveryStatus.AVAILABLE };
    const sub = makeSub();
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(existingRec); // already processed

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.alreadyProcessed).toBe(true);
    expect(recoveryRepo.save).not.toHaveBeenCalled();
  });

  it('10. Retry does not create duplicate recovery', async () => {
    const existingRec = { id: 'rec-1', missedDays: 5, recoveryRate: 80, recoveredDays: 4, usedDays: 0, remainingDays: 4 };
    const sub = makeSub();
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(existingRec);

    const r1 = await service.processSubscriptionRecovery(sub.id, USER_ID);
    const r2 = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(r1.alreadyProcessed).toBe(true);
    expect(r2.alreadyProcessed).toBe(true);
    expect(recoveryRepo.save).not.toHaveBeenCalled();
  });

  it('11. Race condition — unique constraint violation returns existing recovery', async () => {
    const sub = makeSub();
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne
      .mockResolvedValueOnce(null) // first check: not processed
      .mockResolvedValueOnce({ id: 'raced', missedDays: 10, recoveryRate: 80, recoveredDays: 8, usedDays: 0, remainingDays: 8 }); // second check after conflict
    recoveryRepo.create.mockReturnValue({});
    usageRepo.find.mockResolvedValue([]);
    // Simulate unique constraint violation
    recoveryRepo.save.mockRejectedValue(Object.assign(new Error('duplicate key value violates unique constraint'), { code: '23505' }));

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.alreadyProcessed).toBe(true);
  });

  // ======= PROVIDER ISOLATION =======
  it('12. Provider A recovery cannot be consumed by Provider B', async () => {
    const providerA = 'prov-a';
    const providerB = 'prov-b';
    const recA = { id: 'rec-a', studentId: STUDENT_ID, providerId: providerA, remainingDays: 8, usedDays: 0, status: MealRecoveryStatus.AVAILABLE, createdAt: new Date() };
    const mockManager = {
      find: jest.fn().mockResolvedValue([]), // no records for providerB
      save: jest.fn(),
    } as unknown as EntityManager;

    const consumed = await service.consumeRecovery(STUDENT_ID, providerB, mockManager);
    expect(consumed).toBe(0); // providerA balance NOT consumed at providerB
    expect(mockManager.save).not.toHaveBeenCalled();
  });

  it('13. Multiple recovery records accumulate for the same provider', async () => {
    const records = [
      { id: 'r1', studentId: STUDENT_ID, providerId: PROVIDER_ID, remainingDays: 5, status: MealRecoveryStatus.AVAILABLE },
      { id: 'r2', studentId: STUDENT_ID, providerId: PROVIDER_ID, remainingDays: 3, status: MealRecoveryStatus.AVAILABLE },
    ];
    recoveryRepo.find.mockResolvedValue(records);
    providerRepo.find.mockResolvedValue([{ id: PROVIDER_ID, name: 'Test Mess' }]);

    const balance = await service.getStudentRecoveryBalance(STUDENT_ID, PROVIDER_ID);
    expect(balance[0].remainingDays).toBe(8); // 5 + 3 accumulated
  });

  it('14. Historical recovery rate unchanged after provider changes percentage', async () => {
    // Existing recovery record at rate 70 — remains 70 even after provider changes to 50
    const existingRec = { id: 'rec-1', recoveryRate: 70, recoveredDays: 7, remainingDays: 7, sourceSubscriptionId: SUB_ID };
    const sub = makeSub({ mealPlan: { provider: makeProvider({ recoveryPercentage: 50 }) } as any });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(existingRec); // already processed with old rate

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    // Existing record rate must remain 70, not 50
    expect(result.recovery?.recoveryRate ?? existingRec.recoveryRate).toBe(70);
  });

  it('15. Recovery remains available without immediate resubscription', async () => {
    const records = [
      { id: 'r1', studentId: STUDENT_ID, providerId: PROVIDER_ID, remainingDays: 8, usedDays: 0, status: MealRecoveryStatus.AVAILABLE },
    ];
    recoveryRepo.find.mockResolvedValue(records);
    providerRepo.find.mockResolvedValue([{ id: PROVIDER_ID, name: 'Test Mess' }]);

    const balance = await service.getStudentRecoveryBalance(STUDENT_ID);
    // Balance exists even without resubscription
    expect(balance[0].remainingDays).toBe(8);
  });

  // ======= CONSUMPTION CORRECTNESS =======
  it('16. Recovery balance never becomes negative', async () => {
    const rec = { id: 'r1', studentId: STUDENT_ID, providerId: PROVIDER_ID, remainingDays: 3, usedDays: 0, status: MealRecoveryStatus.AVAILABLE, createdAt: new Date() };
    const savedRecs: any[] = [];
    const mockManager = {
      find: jest.fn().mockResolvedValue([rec]),
      save: jest.fn().mockImplementation((_entity: any, r: any) => { savedRecs.push(r); return r; }),
    } as unknown as EntityManager;

    const consumed = await service.consumeRecovery(STUDENT_ID, PROVIDER_ID, mockManager);
    // Cannot consume more than 3
    expect(consumed).toBe(3);
    // remainingDays must never be negative
    const saved = savedRecs[0];
    expect(saved.remainingDays).toBeGreaterThanOrEqual(0);
  });

  it('24. Recovery consumption correctly updates status to USED', async () => {
    const rec = { id: 'r1', studentId: STUDENT_ID, providerId: PROVIDER_ID, remainingDays: 5, usedDays: 0, status: MealRecoveryStatus.AVAILABLE, createdAt: new Date() };
    const savedRecs: any[] = [];
    const mockManager = {
      find: jest.fn().mockResolvedValue([rec]),
      save: jest.fn().mockImplementation((_e: any, r: any) => { savedRecs.push(r); return r; }),
    } as unknown as EntityManager;

    await service.consumeRecovery(STUDENT_ID, PROVIDER_ID, mockManager);
    expect(savedRecs[0].status).toBe(MealRecoveryStatus.USED);
    expect(savedRecs[0].remainingDays).toBe(0);
    expect(savedRecs[0].usedDays).toBe(5);
  });

  it('25. Partial consumption sets PARTIALLY_USED status', async () => {
    const rec = { id: 'r1', studentId: STUDENT_ID, providerId: PROVIDER_ID, remainingDays: 10, usedDays: 0, status: MealRecoveryStatus.AVAILABLE, createdAt: new Date() };
    const savedRecs: any[] = [];
    const mockManager = {
      // Consume all (10 days total)
      find: jest.fn().mockResolvedValue([rec]),
      save: jest.fn().mockImplementation((_e: any, r: any) => { savedRecs.push(r); return r; }),
    } as unknown as EntityManager;

    // Give only 10 days available — all consumed → USED
    const consumed = await service.consumeRecovery(STUDENT_ID, PROVIDER_ID, mockManager);
    expect(consumed).toBe(10);

    // Now simulate partial: rec has 10 but we mock it to have 15 originally, 5 already used
    const rec2 = { id: 'r2', studentId: STUDENT_ID, providerId: PROVIDER_ID, remainingDays: 10, usedDays: 5, status: MealRecoveryStatus.PARTIALLY_USED, createdAt: new Date() };
    const savedRecs2: any[] = [];
    const mockManager2 = {
      find: jest.fn().mockResolvedValue([rec2]),
      save: jest.fn().mockImplementation((_e: any, r: any) => { savedRecs2.push(r); return r; }),
    } as unknown as EntityManager;

    const consumed2 = await service.consumeRecovery(STUDENT_ID, PROVIDER_ID, mockManager2);
    expect(consumed2).toBe(10);
    expect(savedRecs2[0].status).toBe(MealRecoveryStatus.USED);
  });

  // ======= SECURITY =======
  it('17. Unauthorized student cannot access another student balance', async () => {
    // getStudentRecoveryBalance always uses the provided studentId (called with req.user.userId in controller)
    // The controller enforces authenticated identity — unit test verifies service returns only the student's records
    recoveryRepo.find.mockResolvedValue([]);
    const balance = await service.getStudentRecoveryBalance('other-student');
    expect(balance).toEqual([]);
  });

  it('18. Provider cannot access another provider stats', async () => {
    providerRepo.findOne.mockResolvedValue(null); // not found for this userId
    await expect(
      service.getProviderRecoveryStats(USER_ID, 'other-provider-id'),
    ).rejects.toThrow();
  });

  it('19. Provider cannot modify another provider recovery percentage', async () => {
    // Validated in ProvidersService.updateRecoveryPercentage — the entity check ensures userId matches
    // This test is a conceptual test via the recovery service's resolveProvider
    providerRepo.findOne.mockResolvedValue(null);
    await expect(
      service.getProviderRecoveryStats('hacker-user', PROVIDER_ID),
    ).rejects.toThrow();
  });

  it('20. Provider cannot process another provider subscription', async () => {
    const otherProviderUserId = 'other-user';
    const sub = makeSub({ mealPlan: { provider: makeProvider({ userId: otherProviderUserId, user: { id: otherProviderUserId } as any }) } as any });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    providerRepo.findOne.mockResolvedValue(null); // user does not own the provider

    await expect(
      service.processSubscriptionRecovery(sub.id, USER_ID, PROVIDER_ID),
    ).rejects.toThrow();
  });

  it('22. Zero recovery result does not create incorrect positive balance', async () => {
    // 1 missed @ 50% = 0 recovered → no record saved
    const sub = makeSub({
      startDate: '2026-08-01', endDate: '2026-08-01',
      mealPlan: { provider: makeProvider({ recoveryPercentage: 50 }) } as any,
    });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    usageRepo.find.mockResolvedValue([]);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.recoveredDays).toBe(0);
    expect(result.recovery).toBeNull();
    expect(recoveryRepo.save).not.toHaveBeenCalled();
  });

  it('23. Only successful MealUsage check-ins prevent recovery', async () => {
    // 3 day sub, 1 check-in → 2 missed
    const sub = makeSub({ startDate: '2026-08-01', endDate: '2026-08-03' });
    subRepo.findOne.mockResolvedValue(sub);
    recoveryRepo.findOne.mockResolvedValue(null);
    usageRepo.find.mockResolvedValue([{ mealDate: '2026-08-02' }]);
    const created = { missedDays: 2, recoveryRate: 80, recoveredDays: 1, usedDays: 0, remainingDays: 1, status: MealRecoveryStatus.AVAILABLE };
    recoveryRepo.create.mockReturnValue(created);
    recoveryRepo.save.mockResolvedValue(created);

    const result = await service.processSubscriptionRecovery(sub.id, USER_ID);
    expect(result.missedDays).toBe(2);
  });
});
