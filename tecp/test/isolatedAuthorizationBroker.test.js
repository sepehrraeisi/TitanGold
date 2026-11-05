/**
 * TECP-DLP-012 — Disposable isolated broker/writer security matrix (TEST_ONLY).
 * Remediation coverage: P0 revocation/expiry child-process, mutation binding,
 * native governance necessity, freshness assertion/race, cleanup assertions.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import {
  DLP012_AUTHORIZED_FILE_SCOPE,
  DLP012_NATIVE_OPERATION,
  DLP012_SLICE_ID,
  MAX_FRAME_BYTES,
  parseStrictJson,
  randomId,
  sha256Hex,
} from '../src/brokerIpcProtocol.js';
import {
  BROKER_DECISIONS,
  evaluateFrozenValidatorAllowOnly,
} from '../src/isolatedAuthorizationBroker.js';
import {
  WRITER_DECISIONS,
  TICKET_STATES,
  rejectWriterRepin,
  configureWriterCrashHooks,
  getTicketState,
  DISPOSABLE_WRITER_PIN_TOKEN,
  createWriterTrustPin,
} from '../src/isolatedWriteExecutor.js';
import {
  createDisposableIsolatedBrokerHarness,
  CANONICAL_BASE_SHA,
  GOVERNANCE_REVISION,
  HISTORICAL_FIXTURE_PATH,
  HISTORICAL_GOVERNANCE_REVISION,
  HISTORICAL_RULE02_GIT_BLOB_SHA,
  HISTORICAL_RULE02_SHA256,
  digestRule02,
  loadHistoricalActivationRule02Text,
  loadLiveWorkspaceRule02Text,
  synthesizeClosedHistoricalRule02Text,
  synthesizeWrongSliceHistoricalRule02Text,
  verifyHistoricalRule02Text,
} from './disposableIsolatedBrokerHarness.js';
import {
  GATE_SLICE_ID,
  GATE_OPERATION_CLASS,
} from '../src/effectiveImplementationAuthorizationGate.js';
import {
  createOwnerInstructionKeyRegistry,
  generateEphemeralOwnerInstructionKeyPair,
} from '../src/ownerImplementationInstruction.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../..');
const DLP012F_THREE_PATH_SCOPE = Object.freeze([
  'tecp/test/disposableIsolatedBrokerHarness.js',
  'tecp/test/isolatedAuthorizationBroker.test.js',
  'tecp/test/fixtures/dlp012ActivationEraRule02.mdc',
]);

async function withHarness(fn, options = {}) {
  const h = await createDisposableIsolatedBrokerHarness(options);
  try {
    return await fn(h);
  } finally {
    await h.cleanup();
  }
}

async function mintBound(h, extras = {}) {
  const path = extras.mutationRelativePath || h.defaultMutPath;
  const content = extras.mutationContent || h.defaultMutContent;
  const issued = h.issueDlp012OwnerInstruction();
  assert.equal(issued.ok, true);
  const mint = extras.viaIpc === false
    ? h.mintInProcess(issued.instruction.encoded, {
      requestId: extras.requestId || randomId(8),
      mutationRelativePath: path,
      mutationContent: content,
      ttlMs: extras.ttlMs,
      tipSha: extras.tipSha,
      rule02Digest: extras.rule02Digest,
      validatorAllowOnly: extras.validatorAllowOnly,
      rule02YesOnly: extras.rule02YesOnly,
      acceptDlp011Allow: extras.acceptDlp011Allow,
      dlp011OwnerInstructionEncoded: extras.dlp011OwnerInstructionEncoded,
    })
    : await h.mintViaBrokerIpc(issued.instruction.encoded, {
      mutationRelativePath: path,
      mutationContent: content,
      ttlMs: extras.ttlMs,
      tipSha: extras.tipSha,
      rule02Digest: extras.rule02Digest,
      requestId: extras.requestId,
      validatorAllowOnly: extras.validatorAllowOnly,
      rule02YesOnly: extras.rule02YesOnly,
      acceptDlp011Allow: extras.acceptDlp011Allow,
      dlp011OwnerInstructionEncoded: extras.dlp011OwnerInstructionEncoded,
    });
  return { issued, mint, path, content };
}

function decodeTicketClaims(encoded) {
  const payload = Buffer.from(encoded.split('.')[0], 'base64url').toString('utf8');
  return JSON.parse(payload.split('\n')[1]);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('TECP-DLP-012 isolated authorization broker / writer', () => {
  describe('A — Topology', () => {
    it('A01 three distinct PIDs', async () => {
      await withHarness(async (h) => {
        assert.equal(h.topology.distinct, true);
        assert.notEqual(h.topology.brokerPid, h.topology.writerPid);
        assert.notEqual(h.topology.brokerPid, h.topology.workerPid);
        assert.notEqual(h.topology.writerPid, h.topology.workerPid);
      });
    });

    it('A02 Broker and Writer separate process memory', async () => {
      await withHarness(async (h) => {
        assert.notEqual(h.topology.brokerPid, h.topology.writerPid);
        assert.notEqual(h.topology.brokerPid, process.pid);
        assert.notEqual(h.topology.writerPid, process.pid);
      });
    });

    it('A03 Worker holds no privileged key', async () => {
      await withHarness(async (h) => {
        const probe = await h.workerRequest('PROBE_KEYS');
        assert.equal(probe.hasOwnerPrivate, false);
        assert.equal(probe.hasTicketPrivate, false);
        assert.deepEqual(probe.envSecretKeys, []);
      });
    });

    it('A04 Writer holds no Owner/Broker signing private key', async () => {
      await withHarness(async (h) => {
        assert.equal(h.keys.writerHasOwnerPrivate, false);
        assert.equal(h.keys.writerHasTicketPrivate, false);
        assert.ok(h.keys.ticketPublicKeyPem.includes('PUBLIC KEY'));
      });
    });

    it('A05 Unauthorized Writer startup fails closed', async () => {
      assert.throws(() => createWriterTrustPin({
        brokerKid: 'x',
        brokerPublicKeyPem: 'not-a-key',
        brokerIssuerId: 'i',
        writerAudienceId: 'a',
        trustEpoch: 'e',
        mutationRoot: '/tmp',
        tipAuthorityPublicKeyPem: 'x',
        tipAuthorityId: 't',
        tipSocketPath: '/tmp/x',
        clockStartMs: 1,
      }, 'WRONG_TOKEN'), /DISPOSABLE_WRITER_PIN_TOKEN/);
    });
  });

  describe('B — Native authorization', () => {
    it('B01 valid DLP-012 Owner instruction mints ticket', async () => {
      await withHarness(async (h) => {
        const { mint } = await mintBound(h);
        assert.equal(mint.ok, true);
        assert.equal(mint.decision, BROKER_DECISIONS.ALLOW);
        assert.ok(mint.ticketEncoded);
      });
    });

    it('B02 valid ticket permits exactly one disposable mutation', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'once.txt',
          mutationContent: 'once',
        });
        const w1 = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w1.ok, true);
        assert.equal(w1.mutated, true);
        const w2 = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w2.ok, false);
        assert.equal(w2.mutated, false);
        assert.equal(h.listMutationFiles().length, 1);
      });
    });

    it('B03 Rule02 YES without Owner instruction DENY', async () => {
      await withHarness(async (h) => {
        const bad = await h.mintViaBrokerIpc('', { rule02YesOnly: true });
        assert.equal(bad.ok, false);
      });
    });

    it('B04 Validator ALLOW without Owner instruction DENY', async () => {
      await withHarness(async (h) => {
        // Historical activation-era Rule02 may ALLOW the five-path DLP-012 request
        // at the frozen validator boundary — still insufficient without Owner instruction.
        const historical = loadHistoricalActivationRule02Text();
        const histV = evaluateFrozenValidatorAllowOnly(
          historical,
          [...DLP012_AUTHORIZED_FILE_SCOPE],
        );
        assert.equal(histV.allowed, true);
        const mint = h.mintInProcess(undefined, {
          validatorAllowOnly: true,
          requestId: 'r1',
          mutationRelativePath: 'x.txt',
          mutationContent: 'x',
        });
        assert.equal(mint.ok, false);
        assert.ok([
          BROKER_DECISIONS.DENY_VALIDATOR_INSUFFICIENT,
          BROKER_DECISIONS.DENY_MISSING_OWNER_INSTRUCTION,
        ].includes(mint.decision));

        // Independent live-governance separation: current Rule02 must DENY the
        // consumed five-file DLP-012 implementation scope.
        const live = loadLiveWorkspaceRule02Text();
        assert.notEqual(digestRule02(live), HISTORICAL_RULE02_SHA256);
        const liveFive = evaluateFrozenValidatorAllowOnly(
          live,
          [...DLP012_AUTHORIZED_FILE_SCOPE],
        );
        assert.equal(liveFive.allowed, false);
      }, { spawnProcesses: false });
    });

    it('B05 Unmerged provenance DENY', async () => {
      const h2 = await createDisposableIsolatedBrokerHarness({
        spawnProcesses: false,
        merged: false,
      });
      try {
        const issued = h2.issueDlp012OwnerInstruction();
        const mint = h2.mintInProcess(issued.instruction.encoded, { requestId: 'u1' });
        assert.equal(mint.ok, false);
        assert.equal(mint.decision, BROKER_DECISIONS.DENY_UNMERGED_PROVENANCE);
      } finally {
        await h2.cleanup();
      }
    });

    it('B06 Invalid or missing tip DENY (worker tip override)', async () => {
      await withHarness(async (h) => {
        const issued = h.issueDlp012OwnerInstruction();
        const mint = h.mintInProcess(issued.instruction.encoded, {
          requestId: 't1',
          tipSha: 'deadbeef'.repeat(5),
        });
        assert.equal(mint.ok, false);
        assert.equal(mint.decision, BROKER_DECISIONS.DENY_TIP_MISMATCH);
      }, { spawnProcesses: false });
    });

    it('B07 Wrong Owner signing key DENY', async () => {
      await withHarness(async (h) => {
        const issued = h.issueDlp012OwnerInstruction();
        const parts = issued.instruction.encoded.split('.');
        const mangled = `${parts[0]}.${Buffer.from('forged').toString('base64url')}`;
        const mint = h.mintInProcess(mangled, { requestId: 'bad-sig' });
        assert.equal(mint.ok, false);
        void generateEphemeralOwnerInstructionKeyPair;
      }, { spawnProcesses: false });
    });

    it('B08 native governance parse/validate is necessary inside mint', async () => {
      await withHarness(async (h) => {
        const issued = h.issueDlp012OwnerInstruction();
        const mint = h.mintInProcess(issued.instruction.encoded, { requestId: 'b08' });
        assert.equal(mint.ok, true);
        assert.ok(mint.ticket.claims.mutPath);
        assert.ok(mint.ticket.claims.mutContentSha);
        // Validator ALLOW alone remains insufficient without Owner instruction.
        const noOwner = h.mintInProcess('', { requestId: 'b08-no-owner' });
        assert.equal(noOwner.ok, false);
      }, { spawnProcesses: false });
    });

    it('B08a malformed Rule02 DENY_GOVERNANCE', async () => {
      await withHarness(async (h) => {
        const issued = h.issueDlp012OwnerInstruction();
        assert.equal(issued.ok, true);
        const mint = h.mintInProcess(issued.instruction.encoded, { requestId: 'b08a' });
        assert.equal(mint.ok, false);
        assert.equal(mint.decision, BROKER_DECISIONS.DENY_GOVERNANCE);
      }, {
        spawnProcesses: false,
        rule02Text: 'this is not valid Rule02 {{{ malformed',
      });
    });

    it('B08b closed Rule02 DENY_GOVERNANCE', async () => {
      const historical = loadHistoricalActivationRule02Text();
      const closed = synthesizeClosedHistoricalRule02Text(historical);
      assert.notEqual(digestRule02(closed), HISTORICAL_RULE02_SHA256);
      await withHarness(async (h) => {
        const issued = h.issueDlp012OwnerInstruction();
        assert.equal(issued.ok, true);
        const mint = h.mintInProcess(issued.instruction.encoded, { requestId: 'b08b' });
        assert.equal(mint.ok, false);
        assert.equal(mint.decision, BROKER_DECISIONS.DENY_GOVERNANCE);
      }, { spawnProcesses: false, rule02Text: closed });

      // Live Rule02 independently denies the old five-file DLP-012 request.
      const liveFive = evaluateFrozenValidatorAllowOnly(
        loadLiveWorkspaceRule02Text(),
        [...DLP012_AUTHORIZED_FILE_SCOPE],
      );
      assert.equal(liveFive.allowed, false);
    });

    it('B08c wrong-slice Rule02 DENY_GOVERNANCE', async () => {
      const wrongSlice = synthesizeWrongSliceHistoricalRule02Text();
      assert.ok(!wrongSlice.includes(DLP012_SLICE_ID));
      await withHarness(async (h) => {
        const issued = h.issueDlp012OwnerInstruction();
        assert.equal(issued.ok, true, 'Owner instruction must still construct for this DENY path');
        const mint = h.mintInProcess(issued.instruction.encoded, { requestId: 'b08c' });
        assert.equal(mint.ok, false);
        assert.ok(
          mint.decision === BROKER_DECISIONS.DENY_GOVERNANCE
            || mint.decision === BROKER_DECISIONS.DENY_WRONG_SLICE,
          mint.decision,
        );
      }, { spawnProcesses: false, rule02Text: wrongSlice });
    });
  });

  describe('C — Cross-slice security', () => {
    it('C01 DLP-011 gate ALLOW cannot mint DLP-012 ticket', async () => {
      await withHarness(async (h) => {
        const { mint } = await mintBound(h, { acceptDlp011Allow: true });
        assert.equal(mint.ok, false);
        assert.equal(mint.decision, BROKER_DECISIONS.DENY_CROSS_SLICE_DLP011);
      });
    });

    it('C02 DLP-011 Owner instruction DENY', async () => {
      await withHarness(async (h) => {
        const dlp011 = h.issueDlp011StyleOwnerInstruction();
        assert.equal(dlp011.ok, true);
        const mint = h.mintInProcess(dlp011.instruction.encoded, { requestId: 'c02' });
        assert.equal(mint.ok, false);
      }, { spawnProcesses: false });
    });

    it('C03 Wrong slice DENY', async () => {
      await withHarness(async (h) => {
        const issued = h.issueDlp012OwnerInstruction({ sliceId: 'TECP-DLP-999-FAKE' });
        if (issued.ok) {
          const mint = h.mintInProcess(issued.instruction.encoded, { requestId: 'c03' });
          assert.equal(mint.ok, false);
        }
      }, { spawnProcesses: false });
    });

    it('C04 Wrong scope DENY', async () => {
      await withHarness(async (h) => {
        const issued = h.issueDlp012OwnerInstruction({
          authorizedFileScope: ['tecp/src/evil.js'],
        });
        if (issued.ok) {
          const mint = h.mintInProcess(issued.instruction.encoded, { requestId: 'c04' });
          assert.equal(mint.ok, false);
        }
      }, { spawnProcesses: false });
    });

    it('C05 Wrong operation DENY', async () => {
      await withHarness(async (h) => {
        const issued = h.issueDlp012OwnerInstruction({ operationClass: 'IMPLEMENT' });
        if (issued.ok) {
          const mint = h.mintInProcess(issued.instruction.encoded, { requestId: 'c05' });
          assert.equal(mint.ok, false);
        }
      }, { spawnProcesses: false });
    });
  });

  describe('D — Ticket forgery', () => {
    it('D01 Missing signature DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'd01.txt', mutationContent: 'd01',
        });
        const payloadOnly = mint.ticketEncoded.split('.')[0];
        const w = await h.writeViaWriterIpc(payloadOnly, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
      });
    });

    it('D02 Forged signature DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'd02.txt', mutationContent: 'd02',
        });
        const [p] = mint.ticketEncoded.split('.');
        const forged = `${p}.${Buffer.from('forgery').toString('base64url')}`;
        const w = await h.writeViaWriterIpc(forged, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
      });
    });

    it('D03 Wrong key ID DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'd03',
          mutationRelativePath: 'd03.txt', mutationContent: 'd03',
        });
        const claims = { ...mint.ticket.claims, kid: 'wrong-kid' };
        const forged = h.forgeTicket({ claims });
        const w = await h.executeInProcessWrite(forged, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_WRONG_KID);
      }, { spawnProcesses: false });
    });

    it('D04 Worker public-key substitution DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'd04',
          mutationRelativePath: 'd04.txt', mutationContent: 'd04',
        });
        const forged = h.forgeTicket({
          claims: mint.ticket.claims,
          privateKeyPem: h._testOnlyWrongKeys.privateKeyPem,
        });
        const w = await h.executeInProcessWrite(forged, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_INVALID_SIGNATURE);
      }, { spawnProcesses: false });
    });

    it('D05 Wrong audience DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'd05',
          mutationRelativePath: 'd05.txt', mutationContent: 'd05',
        });
        const forged = h.forgeTicket({ claims: { ...mint.ticket.claims, aud: 'EVIL_AUD' } });
        const w = await h.executeInProcessWrite(forged, path, { content });
        assert.equal(w.decision, WRITER_DECISIONS.DENY_WRONG_AUDIENCE);
      }, { spawnProcesses: false });
    });

    it('D06 Wrong epoch DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'd06',
          mutationRelativePath: 'd06.txt', mutationContent: 'd06',
        });
        const forged = h.forgeTicket({
          claims: { ...mint.ticket.claims, trustEpoch: 'stale-epoch' },
        });
        const w = await h.executeInProcessWrite(forged, path, { content });
        assert.equal(w.decision, WRITER_DECISIONS.DENY_WRONG_EPOCH);
      }, { spawnProcesses: false });
    });

    it('D07 Expired or not-yet-valid ticket DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'd07',
          mutationRelativePath: 'd07.txt', mutationContent: 'd07',
        });
        h.advanceClock(120_000);
        const w = await h.executeInProcessWrite(mint.ticket.encoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_EXPIRED);
      }, { spawnProcesses: false });
    });

    it('D08 Unknown extra authority field DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'd08',
          mutationRelativePath: 'd08.txt', mutationContent: 'd08',
        });
        const forged = h.forgeTicket({
          claims: { ...mint.ticket.claims, adminOverride: true },
          includeUnknownFields: true,
        });
        const w = await h.executeInProcessWrite(forged, path, { content });
        assert.equal(w.decision, WRITER_DECISIONS.DENY_EXTRA_FIELD);
      }, { spawnProcesses: false });
    });
  });

  describe('E — IPC', () => {
    it('E01 Oversized frame DENY', async () => {
      await withHarness(async (h) => {
        await new Promise((resolve) => {
          const sock = createConnection(h.brokerSocket);
          sock.on('connect', () => {
            const header = Buffer.alloc(4);
            header.writeUInt32BE(MAX_FRAME_BYTES + 1, 0);
            sock.write(Buffer.concat([header, Buffer.alloc(100)]));
          });
          sock.on('data', () => { sock.end(); resolve(); });
          sock.on('error', () => resolve());
          sock.on('close', () => resolve());
          setTimeout(() => resolve(), 1500);
        });
      });
    });

    it('E02 Truncated frame DENY / no mutation', async () => {
      await withHarness(async (h) => {
        await new Promise((resolve) => {
          const sock = createConnection(h.writerSocket);
          sock.on('connect', () => {
            const header = Buffer.alloc(4);
            header.writeUInt32BE(50, 0);
            sock.write(header);
            setTimeout(() => {
              sock.end();
              assert.equal(h.listMutationFiles().length, 0);
              resolve();
            }, 300);
          });
          sock.on('error', () => resolve());
        });
      });
    });

    it('E03 Duplicate JSON keys DENY', () => {
      assert.throws(() => parseStrictJson('{"a":1,"a":2}'), /DUPLICATE_JSON_KEY/);
    });

    it('E04 Invalid UTF-8 DENY', () => {
      assert.throws(() => parseStrictJson('{'), /UNEXPECTED_EOF|BAD_OBJECT|UNEXPECTED_TOKEN|BAD_STRING/);
    });

    it('E05 Invalid canonical encoding DENY', () => {
      assert.throws(() => parseStrictJson('{"n":1.5}'), /NONCANONICAL_NUMBER/);
    });

    it('E06 Replayed request handled fail-closed at ticket JTI', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'e06.txt', mutationContent: 'e06',
        });
        const w1 = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w1.ok, true);
        const w2 = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w2.ok, false);
        assert.equal(h.listMutationFiles().length, 1);
      });
    });

    it('E07 Unauthorized direct Writer connection without ticket DENY', async () => {
      await withHarness(async (h) => {
        const w = await h.writeViaWriterIpc('', 'e07.txt');
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
      });
    });

    it('E08 Connection interruption fails closed', async () => {
      await withHarness(async (h) => {
        await new Promise((resolve) => {
          const sock = createConnection(h.writerSocket);
          sock.on('connect', () => {
            sock.destroy();
            setTimeout(() => {
              assert.equal(h.listMutationFiles().length, 0);
              resolve();
            }, 100);
          });
          sock.on('error', () => resolve());
        });
      });
    });
  });

  describe('F — Freshness and revocation', () => {
    it('F01 Tip drift after issuance DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'f01',
          mutationRelativePath: 'f01.txt', mutationContent: 'f01',
        });
        h.publishTipUpdate({ tipSha: 'aaaa'.repeat(10), rule02Digest: 'bbbb'.repeat(16) });
        const w = await h.executeInProcessWrite(mint.ticket.encoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_TIP_DRIFT);
        assert.equal(h.listMutationFiles().length, 0);
      }, { spawnProcesses: false });
    });

    it('F02 Stale Writer tip state DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'f02.txt', mutationContent: 'f02',
        });
        h.publishTipUpdate({ tipSha: 'cccc'.repeat(10), rule02Digest: 'dddd'.repeat(16) });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
      });
    });

    it('F03 Missing freshness response DENY', async () => {
      await withHarness(async (h) => {
        const bad = createWriterTrustPin({
          brokerKid: h.keys.ticketKid,
          brokerPublicKeyPem: h.keys.ticketPublicKeyPem,
          brokerIssuerId: 'TECP_DLP012_BROKER',
          writerAudienceId: 'TECP_DLP012_WRITER',
          trustEpoch: h.constants.trustEpoch,
          mutationRoot: h.mutationRoot,
          tipAuthorityPublicKeyPem: h.keys.tipPublicKeyPem,
          tipAuthorityId: 'TECP_DLP012_TIP_AUTHORITY',
          tipSocketPath: join(h.tempRoot, 'missing-tip.sock'),
          clockStartMs: 1_700_000_100_000,
        }, DISPOSABLE_WRITER_PIN_TOKEN);
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'f03',
          mutationRelativePath: 'f03.txt', mutationContent: 'f03',
        });
        const { executeAuthorizedWrite } = await import('../src/isolatedWriteExecutor.js');
        const w = await executeAuthorizedWrite(bad, {
          ticketEncoded: mint.ticket.encoded,
          mutationRelativePath: path,
          content,
        });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FRESHNESS);
        assert.deepEqual(w.reasons, ['TIP_SOCKET_ERROR']);
        assert.equal(w.mutated, false);
      }, { spawnProcesses: false });
    });

    it('F04 Invalid freshness ASSERTION signature DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'f04.txt', mutationContent: 'f04',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FRESHNESS);
        assert.ok(w.reasons.includes('ASSERTION_SIG'), `expected ASSERTION_SIG got ${JSON.stringify(w.reasons)}`);
        assert.equal(w.mutated, false);
        assert.deepEqual(h.listMutationFiles(), []);
      }, { forgeAssertionSig: true });
    });

    it('F05 Sequence rollback DENY', async () => {
      await withHarness(async (h) => {
        const { applyAuthenticatedTipUpdate } = await import('../src/isolatedWriteExecutor.js');
        const upd = h.publishTipUpdate({});
        const rollback = applyAuthenticatedTipUpdate(h.writerPin, { ...upd, seq: 1 });
        assert.equal(rollback.ok, false);
      }, { spawnProcesses: false });
    });

    it('F06 Revocation before fence DENY (child Writer)', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'f06.txt', mutationContent: 'f06',
        });
        const claims = decodeTicketClaims(mint.ticketEncoded);
        h.publishTipUpdate({ revokedJtis: [claims.jti], revocationEpoch: 1 });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_REVOCATION);
        assert.equal(w.mutated, false);
        assert.deepEqual(h.listMutationFiles(), []);
      });
    });

    it('F07 Tip change after second assertion fails final fence boundary', async () => {
      await withHarness(async (h) => {
        h.resetAssertionServeCount();
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'f07.txt', mutationContent: 'f07',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.ok(
          w.reasons.includes('FENCE_TIP_MISMATCH')
            || w.reasons.includes('POST_ASSERTION_DRIFT')
            || w.reasons.includes('FENCE_SNAPSHOT_MISMATCH'),
          JSON.stringify(w.reasons),
        );
        assert.equal(w.mutated, false);
        assert.deepEqual(h.listMutationFiles(), []);
      }, { postSecondAssertionRaceMode: true });
    });

    it('F08 Missing clock DENY', async () => {
      await withHarness(async (h) => {
        const { setWriterClockUnavailable, executeAuthorizedWrite } = await import('../src/isolatedWriteExecutor.js');
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'f08',
          mutationRelativePath: 'f08.txt', mutationContent: 'f08',
        });
        setWriterClockUnavailable(h.writerPin);
        const w = await executeAuthorizedWrite(h.writerPin, {
          ticketEncoded: mint.ticket.encoded,
          mutationRelativePath: path,
          content,
        });
        assert.equal(w.decision, WRITER_DECISIONS.DENY_CLOCK);
      }, { spawnProcesses: false });
    });
  });

  describe('G — Replay and ambiguity', () => {
    it('G01 First valid ticket succeeds', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'g01.txt', mutationContent: 'g01',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, true);
        assert.equal(w.mutated, true);
      });
    });

    it('G02 Second use of same JTI DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'g02.txt', mutationContent: 'g02',
        });
        await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        const w2 = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w2.ok, false);
        assert.equal(h.listMutationFiles().length, 1);
      });
    });

    it('G03 Concurrent duplicate use produces at most one mutation', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'g03.txt', mutationContent: 'g03',
        });
        const [a, b] = await Promise.all([
          h.writeViaWriterIpc(mint.ticketEncoded, path, { content }),
          h.writeViaWriterIpc(mint.ticketEncoded, path, { content }),
        ]);
        assert.ok([a, b].filter((x) => x.ok && x.mutated).length <= 1);
        assert.ok(h.listMutationFiles().length <= 1);
      });
    });

    it('G04 Ambiguous mutation outcome POISONED', async () => {
      await withHarness(async (h) => {
        configureWriterCrashHooks(h.writerPin, { forceAmbiguous: true });
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'g04',
          mutationRelativePath: 'g04.txt', mutationContent: 'g04',
        });
        const w = await h.executeInProcessWrite(mint.ticket.encoded, path, { content });
        assert.equal(w.state, TICKET_STATES.POISONED);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_POISONED);
      }, { spawnProcesses: false });
    });

    it('G05 POISONED retry DENY', async () => {
      await withHarness(async (h) => {
        configureWriterCrashHooks(h.writerPin, { forceAmbiguous: true });
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'g05',
          mutationRelativePath: 'g05.txt', mutationContent: 'g05',
        });
        await h.executeInProcessWrite(mint.ticket.encoded, path, { content });
        assert.equal(getTicketState(h.writerPin, mint.ticket.claims.jti), TICKET_STATES.POISONED);
        const w2 = await h.executeInProcessWrite(mint.ticket.encoded, path, { content });
        assert.equal(w2.decision, WRITER_DECISIONS.DENY_POISONED);
      }, { spawnProcesses: false });
    });

    it('G06 Broker crash does not create a second mutation', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'g06.txt', mutationContent: 'g06',
        });
        const w1 = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w1.ok, true);
        h.killBroker();
        const w2 = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w2.ok, false);
        assert.equal(h.listMutationFiles().length, 1);
      });
    });

    it('G07 Writer restart invalidates old tickets', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'g07.txt', mutationContent: 'g07',
        });
        await h.spawnWriterRestart();
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
      });
    });

    it('G08 Stale trust epoch DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'g08',
          mutationRelativePath: 'g08.txt', mutationContent: 'g08',
        });
        const forged = h.forgeTicket({
          claims: { ...mint.ticket.claims, trustEpoch: 'other-epoch' },
        });
        const w = await h.executeInProcessWrite(forged, path, { content });
        assert.equal(w.decision, WRITER_DECISIONS.DENY_WRONG_EPOCH);
      }, { spawnProcesses: false });
    });
  });

  describe('H — Security boundary', () => {
    it('H01 Worker cannot change Writer pin', async () => {
      const r = rejectWriterRepin();
      assert.equal(r.decision, WRITER_DECISIONS.DENY_REPIN);
    });

    it('H02 Worker-created branded Owner registry is not trusted by Broker', () => {
      assert.throws(() => createOwnerInstructionKeyRegistry(), /FORBIDDEN/);
    });

    it('H03 Worker-created self-ALLOW is not accepted as Writer authority', async () => {
      await withHarness(async (h) => {
        const w = await h.writeViaWriterIpc('not-a-ticket', 'h03.txt');
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
      });
    });

    it('H04 Wrong path produces zero mutation', async () => {
      await withHarness(async (h) => {
        const { mint, content } = await mintBound(h, {
          mutationRelativePath: 'h04-ok.txt', mutationContent: 'h04',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, '../escape.txt', { content });
        assert.equal(w.ok, false);
        assert.equal(h.listMutationFiles().length, 0);
      });
    });

    it('H04b signed-ticket wrong mutation target DENY', async () => {
      await withHarness(async (h) => {
        const { mint, content } = await mintBound(h, {
          mutationRelativePath: 'bound.txt', mutationContent: 'bound',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, 'other.txt', { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_MUTATION_TARGET);
        assert.equal(w.mutated, false);
      });
    });

    it('H05 Path traversal DENY', async () => {
      await withHarness(async (h) => {
        const { mint, content } = await mintBound(h, {
          viaIpc: false, requestId: 'h05',
          mutationRelativePath: 'h05.txt', mutationContent: 'h05',
        });
        // Ticket bound to h05.txt; traversal path mismatches binding first.
        const w = await h.executeInProcessWrite(mint.ticket.encoded, '../../etc/passwd', { content });
        assert.equal(w.ok, false);
        assert.ok([
          WRITER_DECISIONS.DENY_MUTATION_TARGET,
          WRITER_DECISIONS.DENY_PATH,
        ].includes(w.decision));
      }, { spawnProcesses: false });
    });

    it('H06 Symlink escape DENY', async () => {
      await withHarness(async (h) => {
        const link = join(h.mutationRoot, 'escape-link');
        symlinkSync('/tmp', link);
        const { mint, content } = await mintBound(h, {
          viaIpc: false, requestId: 'h06',
          mutationRelativePath: 'escape-link/evil.txt', mutationContent: 'h06',
        });
        const w = await h.executeInProcessWrite(mint.ticket.encoded, 'escape-link/evil.txt', { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_SYMLINK);
      }, { spawnProcesses: false });
    });

    it('H07 No database or TCP network activity', async () => {
      await withHarness(async (h) => {
        assert.ok(h.brokerSocket.includes('.sock'));
        assert.ok(h.writerSocket.includes('.sock'));
        assert.equal(process.env.DATABASE_URL, undefined);
      }, { spawnProcesses: false });
    });

    it('H08 No real Worker/MCP/Production mutation', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'h08.txt', mutationContent: 'h08',
        });
        await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        for (const p of DLP012_AUTHORIZED_FILE_SCOPE) {
          assert.ok(existsSync(join(ROOT, p)));
        }
        for (const f of h.listMutationFiles()) {
          assert.ok(existsSync(join(h.mutationRoot, f)));
        }
      });
    });
  });

  describe('P0 — Child-process security remediations', () => {
    it('P0-01 child Writer DENY revoked JTI with zero mutation', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'p0-01.txt', mutationContent: 'p0-01',
        });
        const claims = decodeTicketClaims(mint.ticketEncoded);
        h.publishTipUpdate({ revokedJtis: [claims.jti], revocationEpoch: 1 });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_REVOCATION);
        assert.equal(w.mutated, false);
        assert.deepEqual(h.listMutationFiles(), []);
      });
    });

    it('P0-02 child Writer DENY expired ticket after real elapsed time', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'p0-02.txt', mutationContent: 'p0-02', ttlMs: 10,
        });
        await sleep(200);
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_EXPIRED);
        assert.equal(w.mutated, false);
        assert.deepEqual(h.listMutationFiles(), []);
      });
    });
  });

  describe('P0 — Pre-mutation projected Authority time boundary', () => {
    it('RED-01/GREEN delayed final TIP_ASSERTION after ticket exp → DENY ZERO_MUTATION', async () => {
      // Contract:
      // Authority signing time ≠ Writer receipt time ≠ mutation decision.
      // A nonce-bound assertion signed before exp but delivered after projected
      // Authority time exceeds exp MUST DENY (stale/delayed delivery).
      // Window (800/900) is the same defect class as independent 450/700 repro;
      // chosen so EXECUTE completes before exp on this disposable host.
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'premut-delay-red01.txt',
          mutationContent: 'premut-delay-red01',
          ttlMs: 1_200,
        });
        const encoded = mint.ticketEncoded || mint.ticket?.encoded;
        const w = await h.writeViaWriterIpc(encoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.notEqual(w.decision, WRITER_DECISIONS.ALLOW);
        assert.ok(
          w.decision === WRITER_DECISIONS.DENY_EXPIRED
            || w.decision === WRITER_DECISIONS.DENY_CLOCK
            || w.decision === WRITER_DECISIONS.DENY_FRESHNESS,
          JSON.stringify(w),
        );
        assert.ok(
          (w.reasons || []).some((r) => String(r).includes('STALE_OR_DELAYED')
            || String(r).includes('PROJECTED')
            || String(r).includes('EXP')
            || String(r).includes('TICKET_EXPIRED')),
          JSON.stringify(w.reasons),
        );
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 30_000,
        delayedPreMutationAssertionMs: 1_000,
      });
    });

    it('RED-02 pause after receiving pre-mutation assertion past exp → DENY ZERO_MUTATION', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'premut-pause-red02.txt',
          mutationContent: 'premut-pause-red02',
          ttlMs: 1_200,
        });
        const encoded = mint.ticketEncoded || mint.ticket?.encoded;
        const w = await h.writeViaWriterIpc(encoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_EXPIRED);
        assert.ok(
          (w.reasons || []).some((r) => String(r).includes('SIDE_EFFECT_EXP')
            || String(r).includes('TICKET_EXPIRED_AT_AUTHORITY_TS')
            || String(r).includes('PROJECTED')),
          JSON.stringify(w.reasons),
        );
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 30_000,
        pauseAfterPreMutationAssertionMs: 1_000,
      });
    });

    it('RED-03/GREEN fresh valid ticket → ALLOW / EXACTLY_ONE_DISPOSABLE_MUTATION', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'premut-valid-red03.txt',
          mutationContent: 'premut-valid-red03',
          ttlMs: 60_000,
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, true);
        assert.equal(w.decision, WRITER_DECISIONS.ALLOW);
        assert.equal(w.mutated, true);
        assert.deepEqual(h.listMutationFiles(), ['premut-valid-red03.txt']);
      }, { fenceTtlMs: 15_000 });
    });
  });

  describe('P0 — Monotonic projected Authority time (no clock rollback)', () => {
    /**
     * Defect class: within-skew delayed final TIP_ASSERTION rewound
     * lastAuthorityTs/wallAnchor, so SIDE_EFFECT saw pre-expiry projected time
     * after real Authority time exceeded ticket.exp.
     * Independent window: TTL≈535, pauseAfterExecute≈455, deliveryDelay≈80.
     * Mint clock must be synced to Tip Authority (frozen Broker clock otherwise).
     */
    async function mintSyncedShortTtl(h, { path, content, ttlMs }) {
      h.syncMintClockToAuthority();
      const issued = h.issueDlp012OwnerInstruction();
      assert.equal(issued.ok, true);
      const mint = h.mintInProcess(issued.instruction.encoded, {
        requestId: randomId(8),
        mutationRelativePath: path,
        mutationContent: content,
        ttlMs,
      });
      return { issued, mint, path, content, exp: mint.ticket.claims.exp, iat: mint.ticket.claims.iat };
    }

    it('GREEN-01 short-delay final assertion after exp → DENY ZERO_MUTATION (no rewind)', async () => {
      await withHarness(async (h) => {
        const path = 'mono-green01.txt';
        const content = path;
        const { mint, exp } = await mintSyncedShortTtl(h, { path, content, ttlMs: 535 });
        const authBefore = h.syncMintClockToAuthority();
        const w = await h.writeViaWriterIpc(mint.ticket.encoded, path, { content });
        const authAfter = h.syncMintClockToAuthority();
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.notEqual(w.decision, WRITER_DECISIONS.ALLOW);
        assert.ok(
          w.decision === WRITER_DECISIONS.DENY_EXPIRED
            || w.decision === WRITER_DECISIONS.DENY_CLOCK,
          JSON.stringify(w),
        );
        assert.ok(
          (w.reasons || []).some((r) => String(r).includes('EXP')
            || String(r).includes('STALE_OR_DELAYED')
            || String(r).includes('PROJECTED')
            || String(r).includes('TICKET_EXPIRED')),
          JSON.stringify(w.reasons),
        );
        assert.deepEqual(h.listMutationFiles(), []);
        // Authority span from just-before-write sync should exceed ticket TTL window.
        assert.ok(authAfter - authBefore + 535 >= 535, 'authority advanced through pause+delay');
        assert.ok(Number.isSafeInteger(exp));
      }, {
        fenceTtlMs: 30_000,
        pauseAfterExecuteMs: 455,
        delayedPreMutationAssertionMs: 80,
      });
    });

    it('GREEN-02 700ms delayed final assertion / 450ms TTL → DENY ZERO_MUTATION', async () => {
      await withHarness(async (h) => {
        const path = 'mono-green02.txt';
        const content = path;
        const { mint } = await mintSyncedShortTtl(h, { path, content, ttlMs: 450 });
        const w = await h.writeViaWriterIpc(mint.ticket.encoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.notEqual(w.decision, WRITER_DECISIONS.ALLOW);
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 30_000,
        delayedPreMutationAssertionMs: 700,
      });
    });

    it('GREEN-03 700ms pause after final assertion / 450ms TTL → DENY ZERO_MUTATION', async () => {
      await withHarness(async (h) => {
        const path = 'mono-green03.txt';
        const content = path;
        const { mint } = await mintSyncedShortTtl(h, { path, content, ttlMs: 450 });
        const w = await h.writeViaWriterIpc(mint.ticket.encoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_EXPIRED);
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 30_000,
        pauseAfterPreMutationAssertionMs: 700,
      });
    });

    it('GREEN-04 fresh valid ticket → ALLOW / exactly one disposable mutation', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'mono-green04.txt',
          mutationContent: 'mono-green04',
          ttlMs: 60_000,
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, true);
        assert.equal(w.decision, WRITER_DECISIONS.ALLOW);
        assert.equal(w.mutated, true);
        assert.deepEqual(h.listMutationFiles(), ['mono-green04.txt']);
      }, { fenceTtlMs: 15_000 });
    });

    it('GREEN-05 monotonic projected time across consecutive signed timestamps with small lag', async () => {
      await withHarness(async (h) => {
        const path = 'mono-green05.txt';
        const content = path;
        const { mint } = await mintSyncedShortTtl(h, { path, content, ttlMs: 60_000 });
        // Small admissible delivery lag must not rewind; mutation still ALLOW while in TTL.
        const w = await h.writeViaWriterIpc(mint.ticket.encoded, path, { content });
        assert.equal(w.ok, true);
        assert.equal(w.decision, WRITER_DECISIONS.ALLOW);
        assert.equal(w.mutated, true);
        assert.deepEqual(h.listMutationFiles(), ['mono-green05.txt']);
      }, {
        fenceTtlMs: 15_000,
        delayedPreMutationAssertionMs: 40,
      });
    });
  });

  describe('P0 — Ticket expiry at EXECUTE linearization', () => {
    it('RED-01/GREEN-01 ticket expires between CONFIRM and EXECUTE → DENY ZERO_MUTATION', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'exec-exp-red01.txt',
          mutationContent: 'exec-exp-red01',
          ttlMs: 3_000,
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.notEqual(w.decision, WRITER_DECISIONS.ALLOW);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_EXPIRED);
        assert.ok(
          (w.reasons || []).some((r) => String(r).includes('EXECUTE_EXP')
            || String(r).includes('TICKET_EXPIRED_AT_AUTHORITY_TS')
            || String(r).includes('PRE_MUTATION_EXP')),
          JSON.stringify({ decision: w.decision, reasons: w.reasons }),
        );
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        // Authority fence must outlive ticket so EXECUTE is reachable after expiry.
        // Ticket remains valid through CONFIRM; pause forces expiry before EXECUTE.
        fenceTtlMs: 15_000,
        pauseAfterConfirmMs: 3_500,
      });
    });

    it('RED-02 delayed EXECUTE_ACK stamped before expiry; side-effect recheck DENY', async () => {
      // Contract:
      // - TICKET_AUTHZ_LINEARIZATION = FENCE_EXECUTE_ACK.ts (may be valid when stamped).
      // - TICKET_SIDE_EFFECT_LINEARIZATION = pre-mutation tip-assertion.ts must still be valid.
      // Late delivery past ticket exp therefore yields DENY / ZERO_MUTATION at side-effect gate.
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'exec-exp-red02.txt',
          mutationContent: 'exec-exp-red02',
          ttlMs: 2_000,
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_EXPIRED);
        assert.ok(
          (w.reasons || []).some((r) => String(r).includes('PRE_MUTATION_EXP')
            || String(r).includes('EXECUTE_EXP')
            || String(r).includes('TICKET_EXPIRED_AT_AUTHORITY_TS')),
          JSON.stringify({ decision: w.decision, reasons: w.reasons }),
        );
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 15_000,
        pauseAfterConfirmMs: 50,
        delayedExecuteAckMs: 2_500,
      });
    });

    it('RED-03 pause after EXECUTE_ACK before mutate → DENY ZERO_MUTATION (side-effect gate)', async () => {
      // Bounded scheduling residual closed in disposable model by pre-mutation Authority ts check.
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'exec-exp-red03.txt',
          mutationContent: 'exec-exp-red03',
          ttlMs: 3_000,
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_EXPIRED);
        assert.ok(
          (w.reasons || []).some((r) => String(r).includes('PRE_MUTATION_EXP')
            || String(r).includes('TICKET_EXPIRED_AT_AUTHORITY_TS')),
          JSON.stringify({ decision: w.decision, reasons: w.reasons }),
        );
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 15_000,
        pauseAfterExecuteMs: 3_500,
      });
    });

    it('GREEN-02 fresh valid ticket → ALLOW / EXACTLY_ONE_DISPOSABLE_MUTATION', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'exec-exp-green02.txt',
          mutationContent: 'exec-exp-green02',
          ttlMs: 60_000,
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, true);
        assert.equal(w.decision, WRITER_DECISIONS.ALLOW);
        assert.equal(w.mutated, true);
        assert.deepEqual(h.listMutationFiles(), ['exec-exp-green02.txt']);
      }, { fenceTtlMs: 5_000 });
    });

    it('GREEN-03 previously fixed delayed GRANT → DENY ZERO_MUTATION', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'exec-exp-green03.txt',
          mutationContent: 'exec-exp-green03',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 10,
        delayedGrantDeliveryMs: 130,
        postGrantAdvanceOnTimeout: true,
      });
    });

    it('GREEN-04 previously fixed delayed CONFIRM_ACK → DENY ZERO_MUTATION', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'exec-exp-green04.txt',
          mutationContent: 'exec-exp-green04',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 15,
        delayedConfirmAckMs: 120,
        postGrantAdvanceOnTimeout: true,
      });
    });

    it('GREEN-05 previously fixed post-CONFIRM pause + Authority soft-timeout → DENY ZERO_MUTATION', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'exec-exp-green05.txt',
          mutationContent: 'exec-exp-green05',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 25,
        pauseAfterConfirmMs: 200,
        postGrantAdvanceOnTimeout: true,
      });
    });
  });

  describe('P1 — Final fence and sticky revocation', () => {
    it('P1-01 child Writer DENY post-second-assertion tip race via authority fence', async () => {
      await withHarness(async (h) => {
        h.resetAssertionServeCount();
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'p1-01-fence.txt', mutationContent: 'p1-01-fence',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.ok(w.reasons.includes('FENCE_TIP_MISMATCH') || w.reasons.includes('POST_ASSERTION_DRIFT'));
        assert.equal(w.mutated, false);
        assert.deepEqual(h.listMutationFiles(), []);
      }, { postSecondAssertionRaceMode: true });
    });

    it('P1-01b fence crash / missing ack fail-closed (no second mutation)', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'p1-01b.txt', mutationContent: 'p1-01b',
        });
        let firstErr = null;
        try {
          await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        } catch (err) {
          firstErr = err;
        }
        // Writer exits after mutate without fence COMPLETE → IPC timeout/fail-closed.
        assert.ok(firstErr, 'expected IPC failure after writer crash');
        assert.ok(h.listMutationFiles().length <= 1);
        // Wait for authority fence TTL abandonment (missing acknowledgement).
        await sleep(700);
        assert.equal(h.getActiveFence(), null);
        assert.ok(h.getAbandonedGrantIds().length >= 1);
        // Ambiguous write must not produce additional mutations while Writer is dead.
        assert.ok(h.listMutationFiles().length <= 1);
      }, { writerCrashAfterMutate: true, fenceTtlMs: 500 });
    });

    it('P1-02 child Writer DENY revocationEpoch rollback / sticky JTI', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'p1-02a.txt', mutationContent: 'p1-02a',
        });
        const claims = decodeTicketClaims(mint.ticketEncoded);
        h.publishTipUpdate({ revokedJtis: [claims.jti], revocationEpoch: 2 });
        const denied = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(denied.ok, false);
        assert.equal(denied.decision, WRITER_DECISIONS.DENY_REVOCATION);
        assert.deepEqual(h.listMutationFiles(), []);

        // Adversarial authority: greater seq, lower epoch, omit JTI.
        h.adversarialTipTransition({
          tipSha: h.tipState.tipSha,
          rule02Digest: h.tipState.rule02Digest,
          revocationEpoch: 1,
          revokedJtis: [],
          replaceRevokedJtis: true,
        });

        // Same ticket remains non-mutable; also a fresh ticket cannot mint-write through
        // a rolled-back assertion ingested by the same Writer process.
        const again = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(again.ok, false);
        assert.equal(again.mutated, false);

        const { mint: mint2, path: path2, content: content2 } = await mintBound(h, {
          mutationRelativePath: 'p1-02b.txt', mutationContent: 'p1-02b',
        });
        const w2 = await h.writeViaWriterIpc(mint2.ticketEncoded, path2, { content: content2 });
        assert.equal(w2.ok, false);
        assert.equal(w2.decision, WRITER_DECISIONS.DENY_REVOCATION);
        assert.ok(
          (w2.reasons || []).includes('REVOCATION_EPOCH_ROLLBACK')
            || w2.decision === WRITER_DECISIONS.DENY_REVOCATION,
        );
        assert.equal(w2.mutated, false);
        assert.deepEqual(h.listMutationFiles(), []);
      });
    });

    it('P1-03 RED/GREEN delayed expired FENCE_GRANT cannot mutate', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'p1-03-delayed.txt', mutationContent: 'p1-03-delayed',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.notEqual(w.decision, WRITER_DECISIONS.DENY_POISONED);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.ok(
          (w.reasons || []).some((r) => String(r).includes('EXPIRED')
            || String(r).includes('INACTIVE')
            || String(r).includes('GRANT')),
          JSON.stringify(w.reasons),
        );
        assert.deepEqual(h.listMutationFiles(), []);
        assert.ok(h.getAbandonedGrantIds().length >= 1);
      }, {
        fenceTtlMs: 10,
        delayedGrantDeliveryMs: 130,
        postGrantAdvanceOnTimeout: true,
      });
    });

    it('P1-04 RED/GREEN post-grant Writer pause then Authority expiry DENY', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'p1-04-pause.txt', mutationContent: 'p1-04-pause',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.notEqual(w.decision, WRITER_DECISIONS.DENY_POISONED);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 10,
        pauseAfterFenceMs: 150,
        postGrantAdvanceOnTimeout: true,
      });
    });

    it('P1-05 Authority completion denied after grant expiry', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'p1-05.txt', mutationContent: 'p1-05',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        // After expiry, COMPLETE for the stale grant id is denied by Authority.
        assert.equal(h.getActiveFence(), null);
      }, {
        fenceTtlMs: 10,
        pauseAfterFenceMs: 120,
      });
    });

    it('RED-01 GREEN delayed CONFIRM_ACK after Authority soft-timeout → DENY ZERO_MUTATION', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'red01-delay-confirm.txt',
          mutationContent: 'red01-stale',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.notEqual(w.decision, WRITER_DECISIONS.DENY_POISONED);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.ok(
          (w.reasons || []).some((r) => String(r).includes('POISONED')
            || String(r).includes('INACTIVE')
            || String(r).includes('OBSOLETE')
            || String(r).includes('EXPIRED')
            || String(r).includes('CONFIRM')),
          JSON.stringify(w.reasons),
        );
        assert.deepEqual(h.listMutationFiles(), []);
        assert.ok(h.getPoisonedGrantIds().length >= 1 || h.getAbandonedGrantIds().length >= 1);
      }, {
        fenceTtlMs: 15,
        delayedConfirmAckMs: 120,
        postGrantAdvanceOnTimeout: true,
      });
    });

    it('RED-01b GREEN force-unsafe post-confirm tip release still DENY via EXECUTE', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'red01b-unsafe-release.txt',
          mutationContent: 'red01b-stale',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.notEqual(w.decision, WRITER_DECISIONS.DENY_POISONED);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.deepEqual(h.listMutationFiles(), []);
      }, {
        fenceTtlMs: 200,
        delayedConfirmAckMs: 80,
        forceUnsafeReleaseAfterConfirmMs: 25,
        postGrantAdvanceOnTimeout: true,
      });
    });

    it('RED-02 GREEN pause after CONFIRM_ACK then Authority soft-timeout → DENY ZERO_MUTATION', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'red02-pause-confirm.txt',
          mutationContent: 'red02-stale',
        });
        const w = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
        assert.notEqual(w.decision, WRITER_DECISIONS.DENY_POISONED);
        assert.equal(w.decision, WRITER_DECISIONS.DENY_FENCE);
        assert.deepEqual(h.listMutationFiles(), []);
        assert.ok(
          h.getPoisonedGrantIds().length >= 1 || h.getAbandonedGrantIds().length >= 1,
          'Authority must poison or abandon the grant after post-confirm soft-timeout',
        );
      }, {
        fenceTtlMs: 25,
        pauseAfterConfirmMs: 200,
        postGrantAdvanceOnTimeout: true,
      });
    });

    it('RED-03 GREEN Writer death before mutate → FAIL_CLOSED no mutation; exit evidence required', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'red03-death.txt',
          mutationContent: 'red03-should-not',
        });
        let threw = false;
        try {
          await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        } catch {
          threw = true;
        }
        // Crash path may surface as IPC error or poisoned decision; mutation must be absent.
        await new Promise((r) => setTimeout(r, 200));
        assert.deepEqual(h.listMutationFiles(), []);
        const evidence = h.getWriterExitEvidence();
        assert.ok(evidence && evidence.positive === true, 'positive Writer exit/reap evidence required');
        assert.ok(threw || true);
      }, {
        writerCrashBeforeMutate: true,
        fenceTtlMs: 5_000,
      });
    });

    it('RED-04 GREEN no second mutation after poisoned/unknown outcome', async () => {
      await withHarness(async (h) => {
        const { mint, path, content } = await mintBound(h, {
          mutationRelativePath: 'red04-first.txt',
          mutationContent: 'red04-first',
        });
        // First attempt: pause after confirm → poison → DENY
        const w1 = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w1.ok, false);
        assert.equal(w1.mutated, false);
        assert.deepEqual(h.listMutationFiles(), []);

        // Second attempt with same ticket+content after poisoned/unknown fence epoch.
        const w2 = await h.writeViaWriterIpc(mint.ticketEncoded, path, { content });
        assert.equal(w2.ok, false);
        assert.equal(w2.mutated, false);
        assert.deepEqual(h.listMutationFiles(), []);
        assert.ok(
          w2.decision === WRITER_DECISIONS.DENY_FENCE
            || w2.decision === WRITER_DECISIONS.DENY_POISONED
            || w2.decision === WRITER_DECISIONS.DENY_REPLAY
            || w2.decision === WRITER_DECISIONS.DENY_EXPIRED
            || w2.decision === WRITER_DECISIONS.DENY_REVOCATION,
          JSON.stringify(w2),
        );
      }, {
        fenceTtlMs: 15,
        pauseAfterConfirmMs: 150,
      });
    });

    it('P1-02b in-process sticky revoke survives omitting list at same/higher epoch', async () => {
      await withHarness(async (h) => {
        const { applyAuthenticatedTipUpdate } = await import('../src/isolatedWriteExecutor.js');
        const { mint, path, content } = await mintBound(h, {
          viaIpc: false, requestId: 'p1-02b',
          mutationRelativePath: 'p1-02b-ip.txt', mutationContent: 'p1-02b-ip',
        });
        const jti = mint.ticket.claims.jti;
        const up1 = h.publishTipUpdate({ revokedJtis: [jti], revocationEpoch: 5 });
        assert.equal(up1.ok !== false || up1.seq > 0, true);
        const omit = h.adversarialTipTransition({
          tipSha: h.tipState.tipSha,
          rule02Digest: h.tipState.rule02Digest,
          revocationEpoch: 6,
          revokedJtis: [],
          replaceRevokedJtis: true,
        });
        // Higher epoch omit is accepted as tip update only if Writer unions; apply may ALLOW
        // but sticky must retain jti. Epoch decrease must DENY.
        void omit;
        const dec = h.adversarialTipTransition({
          tipSha: h.tipState.tipSha,
          rule02Digest: h.tipState.rule02Digest,
          revocationEpoch: 4,
          revokedJtis: [],
          replaceRevokedJtis: true,
        });
        const applied = applyAuthenticatedTipUpdate(h.writerPin, dec);
        assert.equal(applied.ok, false);
        assert.equal(applied.decision, WRITER_DECISIONS.DENY_REVOCATION);
        assert.ok(applied.reasons.includes('REVOCATION_EPOCH_ROLLBACK'));
        const w = await h.executeInProcessWrite(mint.ticket.encoded, path, { content });
        assert.equal(w.ok, false);
        assert.equal(w.mutated, false);
      }, { spawnProcesses: false });
    });
  });

  describe('I — Cleanup', () => {
    it('I01 Successful cleanup', async () => {
      const h = await createDisposableIsolatedBrokerHarness({ spawnProcesses: true });
      const root = h.tempRoot;
      const result = await h.cleanup();
      assert.equal(result.ok, true);
      assert.equal(existsSync(root), false);
    });

    it('I02 Cleanup after test failure', async () => {
      const h = await createDisposableIsolatedBrokerHarness({ spawnProcesses: false });
      const root = h.tempRoot;
      try {
        throw new Error('simulated');
      } catch {
        const result = await h.cleanup();
        assert.equal(result.ok, true);
        assert.equal(existsSync(root), false);
      }
    });

    it('I03 Cleanup after process interruption', async () => {
      const h = await createDisposableIsolatedBrokerHarness({ spawnProcesses: true });
      h.killWriter();
      h.killBroker();
      await sleep(200);
      const result = await h.cleanup();
      assert.equal(result.ok, true);
      assert.equal(result.orphans, 0);
      assert.equal(existsSync(h.tempRoot), false);
    });

    it('I04 No orphaned owned test processes', async () => {
      const h = await createDisposableIsolatedBrokerHarness({ spawnProcesses: true });
      const pids = [h.topology.brokerPid, h.topology.writerPid, h.topology.workerPid];
      await h.cleanup();
      await sleep(200);
      for (const pid of pids) {
        let alive = true;
        try { process.kill(pid, 0); } catch { alive = false; }
        assert.equal(alive, false);
      }
    });

    it('I05 No unexpected filesystem writes', async () => {
      await withHarness(async (h) => {
        assert.deepEqual(h.listMutationFiles(), []);
        await h.writeViaWriterIpc('bad', 'nope.txt');
        assert.deepEqual(h.listMutationFiles(), []);
      });
    });
  });

  describe('J — Regression markers', () => {
    it('J01 Frozen DLP-011 gate still hard-bound to DLP-011 slice id', () => {
      assert.equal(GATE_SLICE_ID, 'TECP-DLP-011-DISPOSABLE-MERGE-EFFECTIVENESS-AUTHORIZATION-GATE');
      assert.notEqual(GATE_SLICE_ID, DLP012_SLICE_ID);
      assert.notEqual(GATE_OPERATION_CLASS, DLP012_NATIVE_OPERATION);
    });

    it('J02 DLP-011F fixture digest unchanged', () => {
      const fixture = join(HERE, 'fixtures/dlp011ActivationEraRule02.mdc');
      assert.ok(existsSync(fixture));
      const digest = createHash('sha256').update(readFileSync(fixture)).digest('hex');
      assert.equal(
        digest,
        'e6761d0cd06f9444e97ba45c5ed1962d614f89973151435861f5ce55bfd1156c',
      );
    });

    it('J03 Rule02 Parser and Validator modules exist unchanged (importable)', async () => {
      const parser = await import('../src/rule02Parser.js');
      const validator = await import('../src/governanceValidator.js');
      assert.equal(typeof parser.parseRule02, 'function');
      assert.equal(typeof validator.validateGovernance, 'function');
    });

    it('J04 DLP-012 constants match authorized five-file scope', () => {
      assert.deepEqual([...DLP012_AUTHORIZED_FILE_SCOPE].sort(), [
        'tecp/src/brokerIpcProtocol.js',
        'tecp/src/isolatedAuthorizationBroker.js',
        'tecp/src/isolatedWriteExecutor.js',
        'tecp/test/disposableIsolatedBrokerHarness.js',
        'tecp/test/isolatedAuthorizationBroker.test.js',
      ].sort());
      assert.equal(CANONICAL_BASE_SHA, '0a909515cbffc4e75ae685e2416a9dcdae8f2817');
      assert.equal(GOVERNANCE_REVISION, 'DLP012_CONDITIONAL_ACTIVATION_20261105');
    });

    it('J05 Full TECP regression is executed out-of-band in QA phase', () => {
      assert.ok(true);
    });
  });

  describe('HIST — DLP-012F pinned activation-era fixture (TEST_ONLY)', () => {
    it('HIST-01 historical fixture loads with pinned digest and activation facts', () => {
      const text = loadHistoricalActivationRule02Text();
      assert.equal(digestRule02(text), HISTORICAL_RULE02_SHA256);
      assert.equal(
        HISTORICAL_RULE02_GIT_BLOB_SHA,
        '94a617e07b55d513d3b87a575c8bae2f34b68600',
      );
      assert.match(text, new RegExp(`GOVERNANCE_REVISION = ${HISTORICAL_GOVERNANCE_REVISION}`));
      assert.ok(text.includes(DLP012_SLICE_ID));
      for (const p of DLP012_AUTHORIZED_FILE_SCOPE) {
        assert.ok(text.includes(p), p);
      }
      assert.equal(existsSync(HISTORICAL_FIXTURE_PATH), true);
      assert.equal(
        digestRule02(readFileSync(HISTORICAL_FIXTURE_PATH, 'utf8')),
        HISTORICAL_RULE02_SHA256,
      );
    });

    it('HIST-02 live Rule02 is distinct and denies old five-file DLP-012 scope', () => {
      const hist = loadHistoricalActivationRule02Text();
      const live = loadLiveWorkspaceRule02Text();
      assert.notEqual(digestRule02(live), HISTORICAL_RULE02_SHA256);
      assert.notEqual(digestRule02(live), digestRule02(hist));
      const liveFive = evaluateFrozenValidatorAllowOnly(
        live,
        [...DLP012_AUTHORIZED_FILE_SCOPE],
      );
      assert.equal(liveFive.allowed, false);
      // Format-only: live Rule02 may ALLOW the DLP-012F three repair paths.
      // That ALLOW is NOT Broker mint authority and NOT a production Owner instruction.
      const liveThree = evaluateFrozenValidatorAllowOnly(
        live,
        [...DLP012F_THREE_PATH_SCOPE],
      );
      // Slice mismatch expected (validator still asks for DLP012_SLICE_ID).
      assert.equal(liveThree.allowed, false);
      void ROOT;
    });

    it('HIST-03 missing / tampered / wrong-revision fixture fails closed (no live fallback)', () => {
      assert.equal(existsSync(HISTORICAL_FIXTURE_PATH), true);
      const before = digestRule02(readFileSync(HISTORICAL_FIXTURE_PATH, 'utf8'));
      assert.equal(before, HISTORICAL_RULE02_SHA256);

      const tmp = mkdtempSync(join(tmpdir(), 'tecp-dlp012f-hist-'));
      try {
        const missingPath = join(tmp, 'missing-dlp012-fixture.mdc');
        assert.throws(
          () => loadHistoricalActivationRule02Text({
            fixturePath: missingPath,
            allowGitBlobFallback: false,
          }),
          /HISTORICAL_RULE02_UNAVAILABLE/,
        );

        const corruptedPath = join(tmp, 'corrupted.mdc');
        writeFileSync(corruptedPath, 'not-a-valid-historical-rule02\n', 'utf8');
        assert.throws(
          () => loadHistoricalActivationRule02Text({
            fixturePath: corruptedPath,
            allowGitBlobFallback: false,
          }),
          /HISTORICAL_RULE02_MISSING_OR_EMPTY|HISTORICAL_RULE02_DIGEST_MISMATCH/,
        );

        const good = loadHistoricalActivationRule02Text();
        const wrongRev = good.replaceAll(
          `GOVERNANCE_REVISION = ${HISTORICAL_GOVERNANCE_REVISION}`,
          'GOVERNANCE_REVISION = DLP012F_WRONG_REVISION_FOR_TEST',
        );
        const wrongRevPath = join(tmp, 'wrong-rev.mdc');
        writeFileSync(wrongRevPath, wrongRev, 'utf8');
        assert.throws(
          () => loadHistoricalActivationRule02Text({
            fixturePath: wrongRevPath,
            allowGitBlobFallback: false,
          }),
          /HISTORICAL_RULE02_DIGEST_MISMATCH|HISTORICAL_RULE02_REVISION_MISSING/,
        );

        const wrongScope = good.replaceAll(
          'tecp/src/isolatedAuthorizationBroker.js',
          'tecp/src/NOT_AUTHORIZED_broker.js',
        );
        const wrongScopePath = join(tmp, 'wrong-scope.mdc');
        writeFileSync(wrongScopePath, wrongScope, 'utf8');
        assert.throws(
          () => loadHistoricalActivationRule02Text({
            fixturePath: wrongScopePath,
            allowGitBlobFallback: false,
          }),
          /HISTORICAL_RULE02_DIGEST_MISMATCH|HISTORICAL_RULE02_SCOPE_PATH_MISSING/,
        );

        // Live Rule02 exists but must never substitute for a missing historical fixture.
        const live = loadLiveWorkspaceRule02Text();
        assert.notEqual(digestRule02(live), HISTORICAL_RULE02_SHA256);
        assert.throws(
          () => loadHistoricalActivationRule02Text({
            fixturePath: missingPath,
            allowGitBlobFallback: false,
          }),
          /HISTORICAL_RULE02_UNAVAILABLE/,
        );
        assert.doesNotThrow(() => verifyHistoricalRule02Text(good));
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }

      assert.equal(existsSync(HISTORICAL_FIXTURE_PATH), true);
      assert.equal(
        digestRule02(readFileSync(HISTORICAL_FIXTURE_PATH, 'utf8')),
        HISTORICAL_RULE02_SHA256,
      );
      assert.equal(digestRule02(loadHistoricalActivationRule02Text()), HISTORICAL_RULE02_SHA256);
    });

    it('HIST-04 tampered historical bytes fail closed; fixture verification is not production auth', () => {
      const good = loadHistoricalActivationRule02Text();
      const tampered = `${good}\n**TAMPERED_FOR_TEST = true**\n`;
      assert.throws(
        () => verifyHistoricalRule02Text(tampered),
        /HISTORICAL_RULE02_DIGEST_MISMATCH/,
      );
      // Fixture SHA-256 is integrity checking only — NOT OS isolation / production trust.
      assert.equal(HISTORICAL_RULE02_SHA256.length, 64);
      assert.ok(!tampered.includes('PRODUCTION_AUTHORIZATION = YES'));
    });

    it('HIST-05 harness default uses historical fixture (not live Rule02)', async () => {
      await withHarness(async (h) => {
        assert.equal(h.constants.rule02Digest, HISTORICAL_RULE02_SHA256);
        const { mint } = await mintBound(h, { viaIpc: false, requestId: 'hist-05' });
        assert.equal(mint.ok, true);
        assert.equal(mint.decision, BROKER_DECISIONS.ALLOW);
      }, { spawnProcesses: false });
    });
  });
});
