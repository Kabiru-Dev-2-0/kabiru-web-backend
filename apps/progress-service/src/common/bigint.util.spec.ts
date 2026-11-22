import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { serializeBigInt } from './bigint.util';

describe('serializeBigInt', () => {
  it('mempertahankan objek Date sebagai nilai tanggal yang valid dan bukan {}', () => {
    const now = new Date('2026-11-22T08:00:00.000Z');
    const serialized = serializeBigInt(now);

    assert.ok(serialized instanceof Date);
    assert.equal(serialized.toISOString(), '2026-11-22T08:00:00.000Z');
    assert.notDeepEqual(serialized, {});
  });

  it('mengonversi BigInt menjadi string', () => {
    const bigVal = BigInt(9007199254740995n);
    const serialized = serializeBigInt(bigVal);

    assert.equal(typeof serialized, 'string');
    assert.equal(serialized, '9007199254740995');
  });

  it('berhasil melakukan serialisasi pada nested object dan array dengan Date dan BigInt', () => {
    const testDate = new Date('2026-11-20T12:00:00.000Z');
    const input = {
      userId: 'user-123',
      totalExp: BigInt(2500),
      lastActivityDate: testDate,
      history: [
        { id: '1', amount: BigInt(50), createdAt: testDate },
        { id: '2', amount: BigInt(100), createdAt: testDate },
      ],
      meta: {
        rawBig: BigInt(999),
        nestedDate: testDate,
        active: true,
      },
    };

    const output = serializeBigInt(input);

    assert.equal(output.userId, 'user-123');
    assert.equal(typeof output.totalExp, 'string');
    assert.equal(output.totalExp, '2500');

    // Date harus tetap merupakan instance Date
    assert.ok(output.lastActivityDate instanceof Date);
    assert.equal(output.lastActivityDate.toISOString(), testDate.toISOString());

    // Array items
    assert.equal(output.history.length, 2);
    assert.equal(output.history[0].amount, '50');
    assert.ok(output.history[0].createdAt instanceof Date);

    // Nested object
    assert.equal(output.meta.rawBig, '999');
    assert.ok(output.meta.nestedDate instanceof Date);
    assert.equal(output.meta.active, true);
  });

  it('menangani nilai primitif lain serta null dan undefined dengan aman', () => {
    assert.equal(serializeBigInt(null), null);
    assert.equal(serializeBigInt(undefined), undefined);
    assert.equal(serializeBigInt('test'), 'test');
    assert.equal(serializeBigInt(123), 123);
    assert.equal(serializeBigInt(false), false);
  });
});
