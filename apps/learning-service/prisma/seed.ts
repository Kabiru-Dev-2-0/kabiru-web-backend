import {
  BloomLevel,
  ContentStatus,
  DifficultyType,
  PrismaClient,
  VisibilityType,
} from '@prisma/client';

const prisma = new PrismaClient();

export const SEED_IDS = {
  levelSd: '11111111-1111-4111-8111-111111111001',
  levelSmp: '11111111-1111-4111-8111-111111111002',
  levelSma: '11111111-1111-4111-8111-111111111003',
  subjectSmp: '11111111-1111-4111-8111-111111111101',
  subjectSmaInformatika: '11111111-1111-4111-8111-111111111102',
  topicSmaPublished: '11111111-1111-4111-8111-111111111201',
  topicSmaDraft: '11111111-1111-4111-8111-111111111202',
  materialPub1: '11111111-1111-4111-8111-111111111301',
  materialPub2: '11111111-1111-4111-8111-111111111302',
  materialDraft3: '11111111-1111-4111-8111-111111111303',
  testPub1: '11111111-1111-4111-8111-111111111401',
  testDraft2: '11111111-1111-4111-8111-111111111402',
  testCasePubSample: '11111111-1111-4111-8111-111111111501',
  testCasePubHidden: '11111111-1111-4111-8111-111111111502',
} as const;

async function main() {
  const sd = await prisma.educationLevel.upsert({
    where: { code: 'SD' },
    update: { name: 'Sekolah Dasar' },
    create: { id: SEED_IDS.levelSd, code: 'SD', name: 'Sekolah Dasar' },
  });

  const smp = await prisma.educationLevel.upsert({
    where: { code: 'SMP' },
    update: { name: 'Sekolah Menengah Pertama' },
    create: { id: SEED_IDS.levelSmp, code: 'SMP', name: 'Sekolah Menengah Pertama' },
  });

  const sma = await prisma.educationLevel.upsert({
    where: { code: 'SMA' },
    update: { name: 'Sekolah Menengah Atas' },
    create: { id: SEED_IDS.levelSma, code: 'SMA', name: 'Sekolah Menengah Atas' },
  });

  await prisma.subject.upsert({
    where: { id: SEED_IDS.subjectSmp },
    update: { name: 'Informatika Dasar SMP', educationLevelId: smp.id },
    create: {
      id: SEED_IDS.subjectSmp,
      educationLevelId: smp.id,
      name: 'Informatika Dasar SMP',
    },
  });

  const smaInformatika = await prisma.subject.upsert({
    where: { id: SEED_IDS.subjectSmaInformatika },
    update: { name: 'Informatika', educationLevelId: sma.id },
    create: {
      id: SEED_IDS.subjectSmaInformatika,
      educationLevelId: sma.id,
      name: 'Informatika',
    },
  });

  const topicPub = await prisma.topic.upsert({
    where: { id: SEED_IDS.topicSmaPublished },
    update: {
      subjectId: smaInformatika.id,
      number: 1,
      title: 'Struktur Data & Algoritma Dasar',
      description: 'Fondasi struktur data array, pencarian, dan pengurutan untuk jenjang SMA.',
      status: ContentStatus.PUBLISHED,
      visibility: VisibilityType.PUBLIC,
      deletedAt: null,
    },
    create: {
      id: SEED_IDS.topicSmaPublished,
      subjectId: smaInformatika.id,
      number: 1,
      title: 'Struktur Data & Algoritma Dasar',
      description: 'Fondasi struktur data array, pencarian, dan pengurutan untuk jenjang SMA.',
      status: ContentStatus.PUBLISHED,
      visibility: VisibilityType.PUBLIC,
    },
  });

  await prisma.topic.upsert({
    where: { id: SEED_IDS.topicSmaDraft },
    update: {
      subjectId: smaInformatika.id,
      number: 2,
      title: 'Graf & Pemrograman Dinamis (Draft)',
      description: 'Materi lanjutan yang masih disusun oleh guru.',
      status: ContentStatus.DRAFT,
      visibility: VisibilityType.PUBLIC,
      deletedAt: null,
    },
    create: {
      id: SEED_IDS.topicSmaDraft,
      subjectId: smaInformatika.id,
      number: 2,
      title: 'Graf & Pemrograman Dinamis (Draft)',
      description: 'Materi lanjutan yang masih disusun oleh guru.',
      status: ContentStatus.DRAFT,
      visibility: VisibilityType.PUBLIC,
    },
  });

  await prisma.material.upsert({
    where: { id: SEED_IDS.materialPub1 },
    update: {
      topicId: topicPub.id,
      number: 1,
      title: 'Pengenalan Array & Kompleksitas Waktu',
      description: 'Memahami indeks memori dan notasi Big-O dasar.',
      learningOutcome: 'Siswa mampu membedakan akses O(1) dan pencarian linear O(n).',
      summary: 'Array menyimpan elemen bertipe sama secara berurutan.',
      content: '# Pengenalan Array\n\nArray menyimpan data secara kontigu di memori...',
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
    },
    create: {
      id: SEED_IDS.materialPub1,
      topicId: topicPub.id,
      number: 1,
      title: 'Pengenalan Array & Kompleksitas Waktu',
      description: 'Memahami indeks memori dan notasi Big-O dasar.',
      learningOutcome: 'Siswa mampu membedakan akses O(1) dan pencarian linear O(n).',
      summary: 'Array menyimpan elemen bertipe sama secara berurutan.',
      content: '# Pengenalan Array\n\nArray menyimpan data secara kontigu di memori...',
      status: ContentStatus.PUBLISHED,
    },
  });

  await prisma.material.upsert({
    where: { id: SEED_IDS.materialPub2 },
    update: {
      topicId: topicPub.id,
      number: 2,
      title: 'Pencarian Biner (Binary Search)',
      description: 'Strategi divide-and-conquer pada data terurut.',
      learningOutcome: 'Siswa mampu menelusuri langkah Binary Search secara mandiri.',
      summary: 'Binary Search memangkas ruang pencarian menjadi setengah di tiap langkah.',
      content: '# Binary Search\n\nSyarat utama Binary Search adalah elemen sudah terurut...',
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
    },
    create: {
      id: SEED_IDS.materialPub2,
      topicId: topicPub.id,
      number: 2,
      title: 'Pencarian Biner (Binary Search)',
      description: 'Strategi divide-and-conquer pada data terurut.',
      learningOutcome: 'Siswa mampu menelusuri langkah Binary Search secara mandiri.',
      summary: 'Binary Search memangkas ruang pencarian menjadi setengah di tiap langkah.',
      content: '# Binary Search\n\nSyarat utama Binary Search adalah elemen sudah terurut...',
      status: ContentStatus.PUBLISHED,
    },
  });

  await prisma.material.upsert({
    where: { id: SEED_IDS.materialDraft3 },
    update: {
      topicId: topicPub.id,
      number: 3,
      title: 'Optimasi Hash Table (Draft Guru)',
      description: 'Belum siap ditampilkan ke siswa.',
      content: '# Draft Hash Table\n\nMasih dalam tahap penyuntingan...',
      status: ContentStatus.DRAFT,
      deletedAt: null,
    },
    create: {
      id: SEED_IDS.materialDraft3,
      topicId: topicPub.id,
      number: 3,
      title: 'Optimasi Hash Table (Draft Guru)',
      description: 'Belum siap ditampilkan ke siswa.',
      content: '# Draft Hash Table\n\nMasih dalam tahap penyuntingan...',
      status: ContentStatus.DRAFT,
    },
  });

  const testPub1 = await prisma.test.upsert({
    where: { id: SEED_IDS.testPub1 },
    update: {
      materialId: SEED_IDS.materialPub1,
      number: 1,
      title: 'Kompleksitas Akses Indeks Array',
      questionType: 'multiple_choice',
      prompt: 'Berapakah kompleksitas waktu mengakses elemen array langsung melalui indeks ke-i?',
      points: 10,
      difficulty: DifficultyType.EASY,
      bloomLevel: BloomLevel.UNDERSTAND,
      maxAttempts: 3,
      payload: {
        options: [
          { id: 'opt-a', text: 'O(1)' },
          { id: 'opt-b', text: 'O(n)' },
          { id: 'opt-c', text: 'O(log n)' },
          { id: 'opt-d', text: 'O(n^2)' },
        ],
      },
      answerKey: { correctOptionId: 'opt-a' },
      status: ContentStatus.PUBLISHED,
      deletedAt: null,
    },
    create: {
      id: SEED_IDS.testPub1,
      materialId: SEED_IDS.materialPub1,
      number: 1,
      title: 'Kompleksitas Akses Indeks Array',
      questionType: 'multiple_choice',
      prompt: 'Berapakah kompleksitas waktu mengakses elemen array langsung melalui indeks ke-i?',
      points: 10,
      difficulty: DifficultyType.EASY,
      bloomLevel: BloomLevel.UNDERSTAND,
      maxAttempts: 3,
      payload: {
        options: [
          { id: 'opt-a', text: 'O(1)' },
          { id: 'opt-b', text: 'O(n)' },
          { id: 'opt-c', text: 'O(log n)' },
          { id: 'opt-d', text: 'O(n^2)' },
        ],
      },
      answerKey: { correctOptionId: 'opt-a' },
      status: ContentStatus.PUBLISHED,
    },
  });

  await prisma.testCase.upsert({
    where: { id: SEED_IDS.testCasePubSample },
    update: {
      testId: testPub1.id,
      input: 'arr = [10, 20, 30], idx = 1',
      expectedOutput: '20',
      weight: 1,
      isHidden: false,
    },
    create: {
      id: SEED_IDS.testCasePubSample,
      testId: testPub1.id,
      input: 'arr = [10, 20, 30], idx = 1',
      expectedOutput: '20',
      weight: 1,
      isHidden: false,
    },
  });

  await prisma.testCase.upsert({
    where: { id: SEED_IDS.testCasePubHidden },
    update: {
      testId: testPub1.id,
      input: 'arr = [99, 88, 77], idx = 2',
      expectedOutput: '77',
      weight: 2,
      isHidden: true,
    },
    create: {
      id: SEED_IDS.testCasePubHidden,
      testId: testPub1.id,
      input: 'arr = [99, 88, 77], idx = 2',
      expectedOutput: '77',
      weight: 2,
      isHidden: true,
    },
  });

  await prisma.test.upsert({
    where: { id: SEED_IDS.testDraft2 },
    update: {
      materialId: SEED_IDS.materialPub1,
      number: 2,
      title: 'Soal Rotasi Array (Draft Guru)',
      questionType: 'fill_blank',
      prompt: 'Lengkapi indeks elemen terakhir setelah rotasi ke kanan sebanyak k langkah.',
      points: 20,
      difficulty: DifficultyType.MEDIUM,
      bloomLevel: BloomLevel.APPLY,
      maxAttempts: 3,
      payload: { template: '(i + ___) % n' },
      answerKey: { blanks: ['k'] },
      status: ContentStatus.DRAFT,
      deletedAt: null,
    },
    create: {
      id: SEED_IDS.testDraft2,
      materialId: SEED_IDS.materialPub1,
      number: 2,
      title: 'Soal Rotasi Array (Draft Guru)',
      questionType: 'fill_blank',
      prompt: 'Lengkapi indeks elemen terakhir setelah rotasi ke kanan sebanyak k langkah.',
      points: 20,
      difficulty: DifficultyType.MEDIUM,
      bloomLevel: BloomLevel.APPLY,
      maxAttempts: 3,
      payload: { template: '(i + ___) % n' },
      answerKey: { blanks: ['k'] },
      status: ContentStatus.DRAFT,
    },
  });

  // ==========================================
  // SEED 8 KATALOG GAME TEMPLATE (PRD Bab 3.1 & 5.4)
  // ==========================================
  const gameTemplates = [
    {
      id: 'multiple_choice',
      name: 'Multiple Choice',
      description: 'Kuis pilihan ganda satu jawaban benar lengkap dengan penjelasan umpan balik.',
      configSchema: {
        type: 'object',
        required: ['question', 'options', 'answerIndex'],
        properties: {
          question: { type: 'string', title: 'Pertanyaan', maxLength: 500 },
          options: {
            type: 'array',
            title: 'Daftar Pilihan Jawaban',
            minItems: 2,
            maxItems: 6,
            items: { type: 'string', maxLength: 200 },
          },
          answerIndex: { type: 'integer', title: 'Indeks Jawaban Benar (mulai dari 0)', minimum: 0 },
          explanation: { type: 'string', title: 'Penjelasan Jawaban', maxLength: 500 },
        },
      },
      defaultConfig: {
        question: 'Struktur data manakah yang bekerja dengan prinsip LIFO (Last In First Out)?',
        options: ['Queue', 'Stack', 'Tree', 'Graph'],
        answerIndex: 1,
        explanation: 'Stack menumpuk elemen sehingga elemen terakhir yang masuk keluar lebih dulu.',
      },
    },
    {
      id: 'sorting',
      name: 'Sorting',
      description: 'Permainan mengurutkan langkah algoritma atau nilai secara berurutan.',
      configSchema: {
        type: 'object',
        required: ['instruction', 'items'],
        properties: {
          instruction: { type: 'string', title: 'Instruksi Pengurutan', maxLength: 300 },
          items: {
            type: 'array',
            title: 'Urutan Item yang Benar',
            minItems: 2,
            maxItems: 10,
            items: { type: 'string', maxLength: 150 },
          },
        },
      },
      defaultConfig: {
        instruction: 'Urutkan tahapan kompilasi dan eksekusi program berikut dari awal hingga akhir:',
        items: ['Menulis Source Code', 'Kompilasi ke Kode Mesin', 'Linking Library', 'Eksekusi Program'],
      },
    },
    {
      id: 'checkbox',
      name: 'Checkbox (Multi-Select)',
      description: 'Pertanyaan pilihan jamak dengan perhitungan skor proporsional.',
      configSchema: {
        type: 'object',
        required: ['question', 'options', 'correctIndices'],
        properties: {
          question: { type: 'string', title: 'Pertanyaan', maxLength: 500 },
          options: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 8 },
          correctIndices: { type: 'array', items: { type: 'integer', minimum: 0 }, minItems: 1 },
        },
      },
      defaultConfig: {
        question: 'Pilih tipe data primitif pada bahasa pemrograman:',
        options: ['Integer', 'Boolean', 'Database', 'Character'],
        correctIndices: [0, 1, 3],
      },
    },
    {
      id: 'fill_blank',
      name: 'Fill in the Blank',
      description: 'Melengkapi bagian rumpang pada kalimat atau potongan algoritma.',
      configSchema: {
        type: 'object',
        required: ['prompt', 'blanks'],
        properties: {
          prompt: { type: 'string', title: 'Teks dengan penanda ___', maxLength: 1000 },
          blanks: { type: 'array', items: { type: 'string' }, minItems: 1 },
          caseSensitive: { type: 'boolean', default: false },
        },
      },
      defaultConfig: {
        prompt: 'Kompleksitas waktu pencarian Binary Search pada array terurut adalah O(___).',
        blanks: ['log n'],
        caseSensitive: false,
      },
    },
    {
      id: 'drag_drop',
      name: 'Drag & Drop',
      description: 'Memasangkan konsep dengan kategori atau definisi yang sesuai.',
      configSchema: {
        type: 'object',
        required: ['instruction', 'pairs'],
        properties: {
          instruction: { type: 'string', maxLength: 300 },
          pairs: {
            type: 'array',
            minItems: 2,
            items: {
              type: 'object',
              required: ['item', 'target'],
              properties: {
                item: { type: 'string' },
                target: { type: 'string' },
              },
            },
          },
        },
      },
      defaultConfig: {
        instruction: 'Pasangkan komponen komputer berikut dengan fungsinya:',
        pairs: [
          { item: 'CPU', target: 'Pemrosesan Instruksi' },
          { item: 'RAM', target: 'Memori Sementara (Volatile)' },
        ],
      },
    },
    {
      id: 'pattern_painter',
      name: 'Pattern Painter',
      description: 'Mewarnai sel grid sesuai pola target untuk melatih pengenalan pola.',
      configSchema: {
        type: 'object',
        required: ['gridSize', 'palette', 'targetGrid'],
        properties: {
          gridSize: { type: 'integer', minimum: 2, maximum: 8 },
          palette: { type: 'array', items: { type: 'string' } },
          targetGrid: { type: 'array', items: { type: 'integer' } },
        },
      },
      defaultConfig: {
        gridSize: 3,
        palette: ['#ffffff', '#0284c7', '#16a34a'],
        targetGrid: [1, 0, 1, 0, 2, 0, 1, 0, 1],
      },
    },
    {
      id: 'maze_runner',
      name: 'Maze Runner',
      description: 'Menyusun langkah navigasi dari titik awal ke tujuan dengan langkah optimal.',
      configSchema: {
        type: 'object',
        required: ['grid', 'start', 'goal', 'maxSteps'],
        properties: {
          grid: { type: 'array', items: { type: 'array', items: { type: 'integer' } } },
          start: { type: 'array', items: { type: 'integer' } },
          goal: { type: 'array', items: { type: 'integer' } },
          maxSteps: { type: 'integer', minimum: 1 },
        },
      },
      defaultConfig: {
        grid: [
          [0, 0, 1],
          [1, 0, 0],
          [0, 0, 0],
        ],
        start: [0, 0],
        goal: [2, 2],
        maxSteps: 6,
      },
    },
    {
      id: 'code_debugger',
      name: 'Code Debugger',
      description: 'Menemukan dan memperbaiki baris kode yang mengandung bug logika/sintaks.',
      configSchema: {
        type: 'object',
        required: ['language', 'buggyCode', 'bugLine', 'fixedLine'],
        properties: {
          language: { type: 'string', default: 'python' },
          buggyCode: { type: 'string', maxLength: 2000 },
          bugLine: { type: 'integer', minimum: 1 },
          fixedLine: { type: 'string', maxLength: 300 },
        },
      },
      defaultConfig: {
        language: 'python',
        buggyCode: 'def is_even(n):\n  return n % 2 == 1',
        bugLine: 2,
        fixedLine: '  return n % 2 == 0',
      },
    },
  ];

  for (const tpl of gameTemplates) {
    await prisma.gameTemplate.upsert({
      where: { id: tpl.id },
      update: {
        name: tpl.name,
        description: tpl.description,
        configSchema: tpl.configSchema,
        defaultConfig: tpl.defaultConfig,
        isActive: true,
      },
      create: {
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        configSchema: tpl.configSchema,
        defaultConfig: tpl.defaultConfig,
        isActive: true,
      },
    });
  }

  console.log(
    `Seed learning-service selesai: jenjang=[${sd.code}, ${smp.code}, ${sma.code}], topikPublished=${topicPub.id}, soalPublished=${testPub1.id}, gameTemplates=${gameTemplates.length}`,
  );
}

const isMain =
  (typeof require !== 'undefined' && require.main === module) ||
  (typeof process !== 'undefined' && Boolean(process.argv[1]?.includes('seed')));

if (isMain) {
  main()
    .catch((err: unknown) => {
      console.error('Gagal menjalankan seed learning-service:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}