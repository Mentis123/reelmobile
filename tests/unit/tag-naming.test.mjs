import assert from 'node:assert/strict';
import test from 'node:test';

function approvedTagFor(candidateTag) {
  return candidateTag.replace('-candidate', '-approved');
}

test('candidate tags map to human approval commands', () => {
  assert.equal(
    approvedTagFor('v0.1-vertical-slice-candidate'),
    'v0.1-vertical-slice-approved'
  );
});
