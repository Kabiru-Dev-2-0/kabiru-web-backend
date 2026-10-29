import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  LEARNING_PATTERNS,
  type ActorContext,
  type EducationLevelItemDto,
  type InternalRequest,
  type MaterialListItemDto,
  type PaginationMeta,
  type SubjectItemDto,
  type TopicItemDto,
} from '@kabiru/contracts';
import { SEED_IDS } from '../prisma/seed';

interface Paginated<T> {
  items: T[];
  pagination: PaginationMeta;
}

function makeEnvelope<TData>(
  data: TData,
  actor: ActorContext | null = null,
): InternalRequest<TData> {
  return {
    meta: {
      requestId: randomUUID(),
      actor,
      callerService: 'api-gateway',
    },
    data,
  };
}

async function runSmokeTest() {
  const port = Number(process.env.SERVICE_PORT ?? 4013);
  const client = ClientProxyFactory.create({
    transport: Transport.TCP,
    options: { host: '127.0.0.1', port },
  });

  try {
    const levels = await firstValueFrom(
      client.send<EducationLevelItemDto[]>(
        LEARNING_PATTERNS.EDUCATION_LEVEL_LIST,
        makeEnvelope({}),
      ),
    );
    assert.deepEqual(
      levels.map((l) => l.code),
      ['SD', 'SMP', 'SMA'],
    );
    console.log('1. EDUCATION_LEVEL_LIST OK:', levels.map((l) => l.code));

    const subjects = await firstValueFrom(
      client.send<SubjectItemDto[]>(LEARNING_PATTERNS.SUBJECT_LIST, makeEnvelope({})),
    );
    assert.ok(subjects.length >= 1);
    assert.ok(subjects.every((s) => s.educationLevelCode === 'SMA'));
    console.log('2. SUBJECT_LIST (default SMA) OK:', subjects.map((s) => s.name));

    const studentActor: ActorContext = {
      userId: '00000000-0000-4000-8000-000000000010',
      role: 'student',
      educationLevelCode: 'SMA',
    };
    const studentTopics = await firstValueFrom(
      client.send<Paginated<TopicItemDto>>(
        LEARNING_PATTERNS.TOPIC_LIST,
        makeEnvelope({ status: 'draft' }, studentActor),
      ),
    );
    assert.ok(studentTopics.items.every((t) => t.status === 'published'));
    console.log(
      '3. TOPIC_LIST (student paksa minta draft -> tetap published) OK:',
      studentTopics.items.map((t) => `${t.title} [${t.status}]`),
    );

    const teacherActor: ActorContext = {
      userId: '00000000-0000-4000-8000-000000000099',
      role: 'teacher',
    };
    const teacherDraftTopics = await firstValueFrom(
      client.send<Paginated<TopicItemDto>>(
        LEARNING_PATTERNS.TOPIC_LIST,
        makeEnvelope({ status: 'draft' }, teacherActor),
      ),
    );
    assert.ok(teacherDraftTopics.items.length >= 1);
    assert.ok(teacherDraftTopics.items.every((t) => t.status === 'draft'));
    console.log(
      '4. TOPIC_LIST (teacher filter draft) OK:',
      teacherDraftTopics.items.map((t) => `${t.title} [${t.status}]`),
    );

    const studentMaterials = await firstValueFrom(
      client.send<Paginated<MaterialListItemDto>>(
        LEARNING_PATTERNS.MATERIAL_LIST,
        makeEnvelope({ topicId: SEED_IDS.topicSmaPublished }, studentActor),
      ),
    );
    assert.equal(studentMaterials.items.length, 2);
    assert.ok(studentMaterials.items.every((m) => m.status === 'published'));
    assert.ok(studentMaterials.items.every((m) => !('content' in m)));
    console.log(
      '5. MATERIAL_LIST (jalur belajar Duolingo student) OK:',
      studentMaterials.items.map((m) => `#${m.number} ${m.title}`),
    );

    console.log('\nSEMUA SMOKE TEST TCP KE POSTGRESQL LULUS!');
  } finally {
    await client.close();
  }
}

runSmokeTest().catch((err: unknown) => {
  console.error('Smoke test TCP gagal:', err);
  process.exitCode = 1;
});