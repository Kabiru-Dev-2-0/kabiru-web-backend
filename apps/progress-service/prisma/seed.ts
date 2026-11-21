import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const dateOnly = (value: string): Date => new Date(`${value}T00:00:00.000Z`);
const timestamp = (value: string): Date => new Date(value);

const ids = {
  users: {
    user1: '11111111-1111-4111-8111-111111111111',
    user2: '22222222-2222-4222-8222-222222222222',
  },
  badges: {
    badge1: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    badge2: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  },
  challenges: {
    challenge1: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
  },
  tests: {
    test1: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1',
    test2: 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2',
  },
  assets: {
    icon1: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd1',
    icon2: 'dddddddd-dddd-4ddd-8ddd-ddddddddddd2',
  },
  submissions: {
    submission1: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',
    submission2: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',
  },
  submissionCodes: {
    code1: 'ffffffff-ffff-4fff-8fff-fffffffffff1',
    code2: 'ffffffff-ffff-4fff-8fff-fffffffffff2',
  },
  scores: {
    score1: '99999999-9999-4999-8999-999999999991',
    score2: '99999999-9999-4999-8999-999999999992',
  },
};

async function seed(): Promise<void> {
  const rankTiers = [
    { id: '10000000-0000-4000-8000-000000000001', name: 'Bronze', minAveragePoint: new Prisma.Decimal(0), maxAveragePoint: new Prisma.Decimal('59.99') },
    { id: '10000000-0000-4000-8000-000000000002', name: 'Silver', minAveragePoint: new Prisma.Decimal(60), maxAveragePoint: new Prisma.Decimal('74.99') },
    { id: '10000000-0000-4000-8000-000000000003', name: 'Gold', minAveragePoint: new Prisma.Decimal(75), maxAveragePoint: new Prisma.Decimal('89.99') },
    { id: '10000000-0000-4000-8000-000000000004', name: 'Platinum', minAveragePoint: new Prisma.Decimal(90), maxAveragePoint: new Prisma.Decimal(100) },
  ];
  for (const item of rankTiers) {
    await prisma.rankTier.upsert({ where: { id: item.id }, update: item, create: item });
  }

  const levels = [
    { id: '20000000-0000-4000-8000-000000000001', name: 'Beginner', minExp: 0, iconAssetId: ids.assets.icon1 },
    { id: '20000000-0000-4000-8000-000000000002', name: 'Intermediate', minExp: 500, iconAssetId: ids.assets.icon1 },
    { id: '20000000-0000-4000-8000-000000000003', name: 'Advanced', minExp: 1500, iconAssetId: ids.assets.icon2 },
    { id: '20000000-0000-4000-8000-000000000004', name: 'Expert', minExp: 3000, iconAssetId: ids.assets.icon2 },
  ];
  for (const item of levels) {
    await prisma.level.upsert({ where: { id: item.id }, update: item, create: item });
  }

  const masteryRules = [
    { id: '30000000-0000-4000-8000-000000000001', mastery: 'BEGINNER', baseExp: 10, expBonus: 0, rankPoint: new Prisma.Decimal(40) },
    { id: '30000000-0000-4000-8000-000000000002', mastery: 'INTERMEDIATE', baseExp: 20, expBonus: 5, rankPoint: new Prisma.Decimal(60) },
    { id: '30000000-0000-4000-8000-000000000003', mastery: 'ADVANCED', baseExp: 30, expBonus: 10, rankPoint: new Prisma.Decimal(80) },
    { id: '30000000-0000-4000-8000-000000000004', mastery: 'EXPERT', baseExp: 40, expBonus: 20, rankPoint: new Prisma.Decimal(100) },
  ];
  for (const item of masteryRules) {
    await prisma.masteryRule.upsert({ where: { id: item.id }, update: item, create: item });
  }

  const updatedAt = timestamp('2026-11-21T04:00:00Z');
  const userStats = [
    { userId: ids.users.user1, totalExp: BigInt(1250), currentStreak: 7, longestStreak: 12, lastActivityDate: dateOnly('2026-11-21'), streakFreezeCount: 2, dailyTarget: 50, updatedAt },
    { userId: ids.users.user2, totalExp: BigInt(650), currentStreak: 3, longestStreak: 5, lastActivityDate: dateOnly('2026-11-21'), streakFreezeCount: 1, dailyTarget: 40, updatedAt },
  ];
  for (const item of userStats) {
    await prisma.userStat.upsert({ where: { userId: item.userId }, update: item, create: item });
  }

  const userRanks = [
    { userId: ids.users.user1, menu: 'PYTHON', averagePoint: new Prisma.Decimal('85.50'), rankTierId: rankTiers[2].id, updatedAt },
    { userId: ids.users.user2, menu: 'PYTHON', averagePoint: new Prisma.Decimal('68.50'), rankTierId: rankTiers[1].id, updatedAt },
  ];
  for (const item of userRanks) {
    await prisma.userRank.upsert({
      where: { userId_menu: { userId: item.userId, menu: item.menu } },
      update: item,
      create: item,
    });
  }

  const dailyActivities = [
    { userId: ids.users.user1, activityDate: dateOnly('2026-11-21'), expEarned: 80, testsDone: 4, loggedIn: true, freezeUsed: false },
    { userId: ids.users.user2, activityDate: dateOnly('2026-11-21'), expEarned: 40, testsDone: 2, loggedIn: true, freezeUsed: false },
  ];
  for (const item of dailyActivities) {
    await prisma.dailyActivity.upsert({
      where: { userId_activityDate: { userId: item.userId, activityDate: item.activityDate } },
      update: item,
      create: item,
    });
  }

  const userBadges = [
    { userId: ids.users.user1, badgeId: ids.badges.badge1, awardedAt: timestamp('2026-11-20T10:00:00Z') },
    { userId: ids.users.user2, badgeId: ids.badges.badge1, awardedAt: timestamp('2026-11-21T08:00:00Z') },
  ];
  for (const item of userBadges) {
    await prisma.userBadge.upsert({
      where: { userId_badgeId: { userId: item.userId, badgeId: item.badgeId } },
      update: item,
      create: item,
    });
  }

  const progressBadges = [
    { userId: ids.users.user1, badgeId: ids.badges.badge2, currentValue: 8, targetValue: 10, updatedAt },
    { userId: ids.users.user2, badgeId: ids.badges.badge2, currentValue: 4, targetValue: 10, updatedAt },
  ];
  for (const item of progressBadges) {
    await prisma.progressBadge.upsert({
      where: { userId_badgeId: { userId: item.userId, badgeId: item.badgeId } },
      update: item,
      create: item,
    });
  }

  const challenges = [
    { userId: ids.users.user1, challengeId: ids.challenges.challenge1, periodStart: dateOnly('2026-11-17'), currentValue: 8, bestValue: 8, updatedAt },
    { userId: ids.users.user2, challengeId: ids.challenges.challenge1, periodStart: dateOnly('2026-11-17'), currentValue: 5, bestValue: 5, updatedAt },
  ];
  for (const item of challenges) {
    await prisma.progressChallenge.upsert({
      where: { userId_challengeId_periodStart: { userId: item.userId, challengeId: item.challengeId, periodStart: item.periodStart } },
      update: item,
      create: item,
    });
  }

  const expTransactions = [
    { id: '40000000-0000-4000-8000-000000000001', userId: ids.users.user1, amount: 50, sourceType: 'TEST_COMPLETION', sourceId: ids.tests.test1, createdAt: timestamp('2026-11-20T10:00:00Z') },
    { id: '40000000-0000-4000-8000-000000000002', userId: ids.users.user1, amount: 30, sourceType: 'DAILY_CHALLENGE', sourceId: ids.challenges.challenge1, createdAt: timestamp('2026-11-21T09:00:00Z') },
    { id: '40000000-0000-4000-8000-000000000003', userId: ids.users.user2, amount: 40, sourceType: 'TEST_COMPLETION', sourceId: ids.tests.test2, createdAt: timestamp('2026-11-21T08:00:00Z') },
  ];
  for (const item of expTransactions) {
    await prisma.expTransaction.upsert({ where: { id: item.id }, update: item, create: item });
  }

  const progressTests = [
    { userId: ids.users.user1, testId: ids.tests.test1, bestScore: new Prisma.Decimal('95.50'), bestMastery: 'EXPERT', attemptsCount: 3, wrongAttemptsCount: 1, currentHintLevel: 0, status: 'COMPLETED', expAwardedAt: timestamp('2026-11-20T10:00:00Z') },
    { userId: ids.users.user2, testId: ids.tests.test2, bestScore: new Prisma.Decimal('72.00'), bestMastery: 'INTERMEDIATE', attemptsCount: 2, wrongAttemptsCount: 2, currentHintLevel: 1, status: 'IN_PROGRESS', expAwardedAt: null },
  ];
  for (const item of progressTests) {
    await prisma.progressTest.upsert({
      where: { userId_testId: { userId: item.userId, testId: item.testId } },
      update: item,
      create: item,
    });
  }

  const submissions = [
    { id: ids.submissions.submission1, userId: ids.users.user1, testId: ids.tests.test1, isCorrect: true, hintsUsed: 0, mastery: 'EXPERT', durationSeconds: 120, answer: { language: 'python', code: 'print(3.14 * 5 ** 2)', expectedOutput: '78.5' }, createdAt: timestamp('2026-11-20T10:00:00Z') },
    { id: ids.submissions.submission2, userId: ids.users.user2, testId: ids.tests.test2, isCorrect: false, hintsUsed: 1, mastery: 'INTERMEDIATE', durationSeconds: 240, answer: { language: 'python', code: 'print(3.14 * 5)', expectedOutput: '78.5' }, createdAt: timestamp('2026-11-21T08:00:00Z') },
  ];
  for (const item of submissions) {
    await prisma.submission.upsert({ where: { id: item.id }, update: item, create: item });
  }

  const submissionCodes = [
    { id: ids.submissionCodes.code1, sourceCode: 'radius = 5\npi = 3.14\nprint(pi * radius ** 2)', compileStatus: 'SUCCESS', executionStatus: 'SUCCESS', executionTimeMs: 45, submissionId: ids.submissions.submission1 },
    { id: ids.submissionCodes.code2, sourceCode: 'radius = 5\npi = 3.14\nprint(pi * radius)', compileStatus: 'SUCCESS', executionStatus: 'SUCCESS', executionTimeMs: 52, submissionId: ids.submissions.submission2 },
  ];
  for (const item of submissionCodes) {
    await prisma.submissionCode.upsert({ where: { id: item.id }, update: item, create: item });
  }

  const scores = [
    { id: ids.scores.score1, submissionId: ids.submissions.submission1, aiScore: new Prisma.Decimal(95), finalScore: new Prisma.Decimal('95.50'), aiSuggestion: 'Solusi benar dan menggunakan operasi perpangkatan dengan tepat.' },
    { id: ids.scores.score2, submissionId: ids.submissions.submission2, aiScore: new Prisma.Decimal(60), finalScore: new Prisma.Decimal(60), aiSuggestion: 'Periksa kembali rumus luas lingkaran. Gunakan pangkat dua pada radius.' },
  ];
  for (const item of scores) {
    await prisma.score.upsert({ where: { id: item.id }, update: item, create: item });
  }
}

seed()
  .then(() => console.log('Progress Service seeding completed.'))
  .catch((error: unknown) => {
    console.error('Progress Service seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
