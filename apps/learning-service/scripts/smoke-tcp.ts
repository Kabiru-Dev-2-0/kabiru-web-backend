import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  LEARNING_PATTERNS,
  isServiceErrorPayload,
  type ActorContext,
  type CreateTopicDto,
  type EducationLevelItemDto,
  type InternalRequest,
  type MaterialAuthoringDetailDto,
  type MaterialDetailDto,
  type MaterialListItemDto,
  type MutationResultDto,
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

    const materialDetail = await firstValueFrom(
      client.send<MaterialDetailDto>(
        LEARNING_PATTERNS.MATERIAL_GET_DETAIL,
        makeEnvelope({ materialId: SEED_IDS.materialPub1 }, studentActor),
      ),
    );
    assert.equal(materialDetail.id, SEED_IDS.materialPub1);
    assert.equal(materialDetail.breadcrumb.educationLevelCode, 'SMA');
    assert.equal(materialDetail.navigation.previousMaterialId, null);
    assert.equal(materialDetail.navigation.nextMaterialId, SEED_IDS.materialPub2);
    assert.equal(materialDetail.tests.length, 1);
    const publicTest = materialDetail.tests[0];
    assert.ok(publicTest);
    assert.equal('answerKey' in publicTest, false);
    assert.equal(publicTest.sampleTestCases.length, 1);
    assert.equal(publicTest.sampleTestCases[0]?.id, SEED_IDS.testCasePubSample);
    console.log('6. MATERIAL_GET_DETAIL (student soal aman & navigasi) OK:', {
      title: materialDetail.title,
      nextMaterialId: materialDetail.navigation.nextMaterialId,
      tests: materialDetail.tests.map(
        (t) => `#${t.number} ${t.title} (sampleTestCases=${t.sampleTestCases.length})`,
      ),
    });

    await assert.rejects(
      () =>
        firstValueFrom(
          client.send<MaterialDetailDto>(
            LEARNING_PATTERNS.MATERIAL_GET_DETAIL,
            makeEnvelope({ materialId: SEED_IDS.materialDraft3 }, studentActor),
          ),
        ),
      (err: unknown) => {
        assert.ok(isServiceErrorPayload(err));
        assert.equal(err.code, 'NOT_FOUND');
        assert.equal(err.httpStatus, 404);
        return true;
      },
    );
    console.log('7. MATERIAL_GET_DETAIL (student blokir akses materi draft -> 404) OK');

    // 8. TOPIC_CREATE (student coba buat topik -> 403 FORBIDDEN)
    await assert.rejects(
      () =>
        firstValueFrom(
          client.send<TopicItemDto>(
            LEARNING_PATTERNS.TOPIC_CREATE,
            makeEnvelope<CreateTopicDto>(
              {
                subjectId: SEED_IDS.subjectSmaInformatika,
                number: 99,
                title: 'Topik Ilegal Student',
                status: 'draft',
              },
              studentActor,
            ),
          ),
        ),
      (err: unknown) => {
        assert.ok(isServiceErrorPayload(err));
        assert.equal(err.code, 'FORBIDDEN');
        assert.equal(err.httpStatus, 403);
        return true;
      },
    );
    console.log('8. TOPIC_CREATE (student blokir akses create -> 403) OK');

    // 9. TOPIC_CREATE (teacher buat topik baru -> status draft)
    const newTopic = await firstValueFrom(
      client.send<TopicItemDto>(
        LEARNING_PATTERNS.TOPIC_CREATE,
        makeEnvelope<CreateTopicDto>(
          {
            subjectId: SEED_IDS.subjectSmaInformatika,
            number: 10,
            title: 'Topik Smoke Test Teacher',
            status: 'draft',
          },
          teacherActor,
        ),
      ),
    );
    assert.ok(newTopic.id);
    assert.equal(newTopic.title, 'Topik Smoke Test Teacher');
    assert.equal(newTopic.status, 'draft');
    console.log('9. TOPIC_CREATE (teacher buat topik draft) OK:', newTopic.id);

    // 10. MATERIAL_GET_AUTHORING (teacher ambil detail materi lengkap dengan answerKey)
    const authoringDetail = await firstValueFrom(
      client.send<MaterialAuthoringDetailDto>(
        LEARNING_PATTERNS.MATERIAL_GET_AUTHORING,
        makeEnvelope({ materialId: SEED_IDS.materialPub1 }, teacherActor),
      ),
    );
    assert.equal(authoringDetail.id, SEED_IDS.materialPub1);
    assert.ok(authoringDetail.tests.length >= 1);
    const testWithKey = authoringDetail.tests.find((t) => t.id === SEED_IDS.testPub1);
    assert.ok(testWithKey);
    assert.ok(testWithKey.answerKey !== null);
    assert.equal(testWithKey.testCases.length, 2); // sample + hidden
    console.log('10. MATERIAL_GET_AUTHORING (teacher lihat answerKey & hidden test case) OK:', {
      material: authoringDetail.title,
      totalTests: authoringDetail.tests.length,
      hasAnswerKey: Boolean(testWithKey.answerKey),
      totalTestCases: testWithKey.testCases.length,
    });

    // 11. TOPIC_DELETE (teacher soft delete topik baru)
    const deleteResult = await firstValueFrom(
      client.send<MutationResultDto>(
        LEARNING_PATTERNS.TOPIC_DELETE,
        makeEnvelope({ topicId: newTopic.id }, teacherActor),
      ),
    );
    assert.equal(deleteResult.success, true);
    assert.equal(deleteResult.id, newTopic.id);
    console.log('11. TOPIC_DELETE (teacher soft-delete topik) OK');

    console.log('\nSEMUA SMOKE TEST TCP KE POSTGRESQL LULUS!');
  } finally {
    await client.close();
  }
}

runSmokeTest().catch((err: unknown) => {
  console.error('Smoke test TCP gagal:', err);
  process.exitCode = 1;
});