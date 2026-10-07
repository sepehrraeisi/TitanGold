/**
 * TECP-008 task graph tests.
 *
 * Persistent schema owner remains migration 056. In-memory `taskId` maps
 * conceptually to task identity. A dependency maps to task → dependsOn task.
 * `COMPLETED` is a graph-level token only. This module owns no persistence
 * and does not read a database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  TASK_COMPLETION_STATUS,
  TASK_GRAPH_DECISIONS,
  TASK_READINESS_DECISIONS,
  buildTaskGraph,
  evaluateTaskReadiness,
  topologicalOrder,
} from '../src/taskGraph.js';

const here = dirname(fileURLToPath(import.meta.url));
const sourcePath = join(here, '../src/taskGraph.js');

function task(taskId, status = 'PENDING') {
  return { taskId, status };
}

function edge(taskId, dependsOnTaskId) {
  return { taskId, dependsOnTaskId };
}

function shuffle(values) {
  return [values[values.length - 1], ...values.slice(1, -1), values[0]].filter((value) => value !== undefined);
}

test('single task with no dependency is valid', () => {
  const result = buildTaskGraph([task('solo')], []);
  assert.equal(result.valid, true);
  assert.equal(result.decision, TASK_GRAPH_DECISIONS.VALID);
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(result.graph.tasks, [task('solo')]);
  assert.deepEqual(result.graph.dependencies, []);
});

test('independent tasks are valid', () => {
  const result = buildTaskGraph([task('b'), task('a')], []);
  assert.equal(result.valid, true);
  assert.deepEqual(result.graph.tasks.map((item) => item.taskId), ['a', 'b']);
});

test('simple chain is valid', () => {
  const result = buildTaskGraph(
    [task('C'), task('A'), task('B')],
    [edge('B', 'A'), edge('C', 'B')],
  );
  assert.equal(result.valid, true);
  assert.equal(result.decision, TASK_GRAPH_DECISIONS.VALID);
});

test('diamond DAG is valid', () => {
  const result = buildTaskGraph(
    [task('D'), task('B'), task('C'), task('A')],
    [edge('D', 'C'), edge('B', 'A'), edge('C', 'A'), edge('D', 'B')],
  );
  assert.equal(result.valid, true);
  assert.deepEqual(result.graph.tasks.map((item) => item.taskId), ['A', 'B', 'C', 'D']);
});

test('duplicate task id is invalid', () => {
  const result = buildTaskGraph([task('a'), task('a', 'COMPLETED')], []);
  assert.equal(result.valid, false);
  assert.equal(result.decision, TASK_GRAPH_DECISIONS.INVALID_DUPLICATE_TASK);
  assert.equal(result.graph, null);
  assert.deepEqual(result.reasons, ['DUPLICATE_TASK:a']);
});

test('malformed task is invalid', () => {
  const cases = [
    null,
    [],
    { taskId: 'a' },
    { taskId: '', status: 'PENDING' },
    { taskId: 'a', status: '' },
    { taskId: 1, status: 'PENDING' },
    { taskId: 'a', status: 'PENDING', extra: true },
  ];
  for (const malformed of cases) {
    const result = buildTaskGraph([malformed], []);
    assert.equal(result.valid, false);
    assert.equal(result.decision, TASK_GRAPH_DECISIONS.INVALID_TASK);
    assert.equal(result.graph, null);
  }
  assert.equal(buildTaskGraph(null, []).decision, TASK_GRAPH_DECISIONS.INVALID_TASK);
});

test('malformed dependency is invalid', () => {
  const tasks = [task('a'), task('b')];
  const cases = [
    null,
    { taskId: 'a' },
    { taskId: '', dependsOnTaskId: 'b' },
    { taskId: 'a', dependsOnTaskId: '' },
    { taskId: 'a', dependsOnTaskId: 'b', extra: true },
  ];
  for (const malformed of cases) {
    const result = buildTaskGraph(tasks, [malformed]);
    assert.equal(result.valid, false);
    assert.equal(result.decision, TASK_GRAPH_DECISIONS.INVALID_DEPENDENCY);
    assert.equal(result.graph, null);
  }
  assert.equal(buildTaskGraph(tasks, null).decision, TASK_GRAPH_DECISIONS.INVALID_DEPENDENCY);
});

test('missing dependency task is invalid', () => {
  const result = buildTaskGraph([task('a')], [edge('a', 'missing')]);
  assert.equal(result.valid, false);
  assert.equal(result.decision, TASK_GRAPH_DECISIONS.INVALID_MISSING_DEPENDENCY);
  assert.equal(result.graph, null);
  assert.deepEqual(result.reasons, ['MISSING_DEPENDENCY:a->missing']);
});

test('self dependency is invalid', () => {
  const result = buildTaskGraph([task('a')], [edge('a', 'a')]);
  assert.equal(result.valid, false);
  assert.equal(result.decision, TASK_GRAPH_DECISIONS.INVALID_SELF_DEPENDENCY);
  assert.equal(result.graph, null);
});

test('duplicate edge is invalid', () => {
  const result = buildTaskGraph(
    [task('a'), task('b')],
    [edge('b', 'a'), edge('b', 'a')],
  );
  assert.equal(result.valid, false);
  assert.equal(result.decision, TASK_GRAPH_DECISIONS.INVALID_DUPLICATE_EDGE);
  assert.equal(result.graph, null);
  assert.deepEqual(result.reasons, ['DUPLICATE_EDGE:b->a']);
});

test('two-node cycle is invalid', () => {
  const result = buildTaskGraph(
    [task('a'), task('b')],
    [edge('a', 'b'), edge('b', 'a')],
  );
  assert.equal(result.valid, false);
  assert.equal(result.decision, TASK_GRAPH_DECISIONS.INVALID_CYCLE);
  assert.equal(result.graph, null);
  assert.deepEqual(topologicalOrder({
    tasks: [task('a'), task('b')],
    dependencies: [edge('a', 'b'), edge('b', 'a')],
  }).order, []);
});

test('longer cycle is invalid', () => {
  const result = buildTaskGraph(
    [task('a'), task('b'), task('c')],
    [edge('b', 'a'), edge('c', 'b'), edge('a', 'c')],
  );
  assert.equal(result.decision, TASK_GRAPH_DECISIONS.INVALID_CYCLE);
  assert.equal(result.graph, null);
});

test('disconnected graph with one cycle is invalid', () => {
  const result = buildTaskGraph(
    [task('solo'), task('a'), task('b')],
    [edge('a', 'b'), edge('b', 'a')],
  );
  assert.equal(result.decision, TASK_GRAPH_DECISIONS.INVALID_CYCLE);
  assert.equal(result.valid, false);
  assert.equal(result.graph, null);
});

test('zero dependency task is ready', () => {
  const graph = buildTaskGraph([task('solo', 'PENDING')], []).graph;
  const readiness = evaluateTaskReadiness(graph, 'solo');
  assert.equal(readiness.ready, true);
  assert.equal(readiness.decision, TASK_READINESS_DECISIONS.READY);
  assert.deepEqual(readiness.blockingDependencies, []);
  assert.deepEqual(readiness.reasons, []);
});

test('all dependencies completed is ready', () => {
  const graph = buildTaskGraph(
    [task('a', TASK_COMPLETION_STATUS.COMPLETED), task('b', 'PENDING')],
    [edge('b', 'a')],
  ).graph;
  const readiness = evaluateTaskReadiness(graph, 'b');
  assert.equal(readiness.decision, TASK_READINESS_DECISIONS.READY);
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.blockingDependencies, []);
});

test('one pending dependency blocks readiness', () => {
  const graph = buildTaskGraph(
    [task('a', 'PENDING'), task('b', 'PENDING')],
    [edge('b', 'a')],
  ).graph;
  const readiness = evaluateTaskReadiness(graph, 'b');
  assert.equal(readiness.ready, false);
  assert.equal(readiness.decision, TASK_READINESS_DECISIONS.BLOCKED_DEPENDENCY);
  assert.deepEqual(readiness.blockingDependencies, ['a']);
});

test('unknown non-completed status blocks readiness', () => {
  const graph = buildTaskGraph(
    [task('a', 'NOT_A_REAL_STATUS'), task('b')],
    [edge('b', 'a')],
  ).graph;
  const readiness = evaluateTaskReadiness(graph, 'b');
  assert.equal(readiness.decision, TASK_READINESS_DECISIONS.BLOCKED_DEPENDENCY);
  assert.deepEqual(readiness.blockingDependencies, ['a']);
});

test('multiple blocking dependencies are lexical', () => {
  const graph = buildTaskGraph(
    [task('z', 'PENDING'), task('a', 'AGED'), task('m', TASK_COMPLETION_STATUS.COMPLETED), task('target')],
    [edge('target', 'z'), edge('target', 'm'), edge('target', 'a')],
  ).graph;
  const readiness = evaluateTaskReadiness(graph, 'target');
  assert.deepEqual(readiness.blockingDependencies, ['a', 'z']);
  assert.deepEqual(readiness.reasons, ['BLOCKED_DEPENDENCY:a', 'BLOCKED_DEPENDENCY:z']);
});

test('unknown task is unknown', () => {
  const graph = buildTaskGraph([task('a')], []).graph;
  const readiness = evaluateTaskReadiness(graph, 'missing');
  assert.equal(readiness.ready, false);
  assert.equal(readiness.decision, TASK_READINESS_DECISIONS.UNKNOWN_TASK);
  assert.equal(readiness.taskId, 'missing');
  assert.deepEqual(readiness.blockingDependencies, []);
});

test('invalid graph readiness fails closed', () => {
  const invalid = buildTaskGraph([task('a'), task('a')], []);
  const readiness = evaluateTaskReadiness(invalid.graph, 'a');
  assert.equal(readiness.ready, false);
  assert.equal(readiness.decision, TASK_READINESS_DECISIONS.INVALID_GRAPH);
  assert.deepEqual(readiness.blockingDependencies, []);
  assert.equal(evaluateTaskReadiness(invalid, 'a').decision, TASK_READINESS_DECISIONS.INVALID_GRAPH);
});

test('topological order of a simple chain', () => {
  const graph = buildTaskGraph(
    [task('C'), task('A'), task('B')],
    [edge('C', 'B'), edge('B', 'A')],
  ).graph;
  const ordered = topologicalOrder(graph);
  assert.equal(ordered.valid, true);
  assert.equal(ordered.decision, TASK_GRAPH_DECISIONS.VALID);
  assert.deepEqual(ordered.order, ['A', 'B', 'C']);
});

test('topological order of independent nodes is lexical', () => {
  const graph = buildTaskGraph([task('c'), task('a'), task('b')], []).graph;
  assert.deepEqual(topologicalOrder(graph).order, ['a', 'b', 'c']);
});

test('topological order of a diamond is deterministic', () => {
  const tasks = [task('D'), task('B'), task('C'), task('A')];
  const dependencies = [edge('D', 'C'), edge('B', 'A'), edge('C', 'A'), edge('D', 'B')];
  const first = topologicalOrder(buildTaskGraph(tasks, dependencies).graph).order;
  const second = topologicalOrder(buildTaskGraph(shuffle(tasks), shuffle(dependencies)).graph).order;
  assert.deepEqual(first, ['A', 'B', 'C', 'D']);
  assert.deepEqual(second, first);
});

test('repeated build is deterministic', () => {
  const tasks = [task('b'), task('a'), task('c')];
  const dependencies = [edge('c', 'a'), edge('b', 'a')];
  const first = JSON.stringify(buildTaskGraph(tasks, dependencies));
  const second = JSON.stringify(buildTaskGraph(shuffle(tasks), shuffle(dependencies)));
  assert.equal(first, second);
});

test('repeated readiness is deterministic', () => {
  const graph = buildTaskGraph(
    [task('z', 'PENDING'), task('a', 'PENDING'), task('target')],
    [edge('target', 'z'), edge('target', 'a')],
  ).graph;
  const first = JSON.stringify(evaluateTaskReadiness(graph, 'target'));
  const second = JSON.stringify(evaluateTaskReadiness(graph, 'target'));
  assert.equal(first, second);
  assert.deepEqual(JSON.parse(first).blockingDependencies, ['a', 'z']);
});

test('repeated topological order is deterministic', () => {
  const graph = buildTaskGraph([task('b'), task('a')], []).graph;
  assert.equal(
    JSON.stringify(topologicalOrder(graph)),
    JSON.stringify(topologicalOrder(graph)),
  );
});

test('input tasks are not mutated', () => {
  const tasks = [task('b', 'PENDING'), task('a', 'COMPLETED')];
  const dependencies = [edge('b', 'a')];
  const beforeTasks = JSON.stringify(tasks);
  const beforeTask = JSON.stringify(tasks[0]);
  Object.freeze(tasks);
  Object.freeze(tasks[0]);
  Object.freeze(tasks[1]);
  buildTaskGraph(tasks, dependencies);
  evaluateTaskReadiness(buildTaskGraph([task('a')], []).graph, 'a');
  assert.equal(JSON.stringify(tasks), beforeTasks);
  assert.equal(JSON.stringify(tasks[0]), beforeTask);
});

test('input dependencies are not mutated', () => {
  const tasks = [task('a', 'COMPLETED'), task('b')];
  const dependencies = [edge('b', 'a'), edge('b', 'a')];
  const before = JSON.stringify(dependencies);
  const beforeEdge = JSON.stringify(dependencies[0]);
  Object.freeze(dependencies);
  Object.freeze(dependencies[0]);
  Object.freeze(dependencies[1]);
  buildTaskGraph(tasks, dependencies);
  assert.equal(JSON.stringify(dependencies), before);
  assert.equal(JSON.stringify(dependencies[0]), beforeEdge);
});

test('result structure is stable', () => {
  const built = buildTaskGraph([task('a', 'COMPLETED'), task('b')], [edge('b', 'a')]);
  assert.deepEqual(Object.keys(built), ['valid', 'decision', 'reasons', 'graph']);
  assert.deepEqual(Object.keys(built.graph), ['tasks', 'dependencies']);
  assert.deepEqual(Object.keys(built.graph.tasks[0]), ['taskId', 'status']);
  assert.deepEqual(Object.keys(built.graph.dependencies[0]), ['taskId', 'dependsOnTaskId']);
  const readiness = evaluateTaskReadiness(built.graph, 'b');
  assert.deepEqual(Object.keys(readiness), ['ready', 'decision', 'taskId', 'blockingDependencies', 'reasons']);
  const ordered = topologicalOrder(built.graph);
  assert.deepEqual(Object.keys(ordered), ['valid', 'decision', 'order', 'reasons']);
  assert.deepEqual(ordered.order, ['a', 'b']);
});

test('returned graph data is not externally mutable', () => {
  const built = buildTaskGraph([task('a')], []);
  assert.throws(() => {
    built.graph.tasks.push(task('b'));
  }, TypeError);
  assert.throws(() => {
    built.graph.tasks[0].status = 'COMPLETED';
  }, TypeError);
  assert.throws(() => {
    built.reasons.push('x');
  }, TypeError);
  const ordered = topologicalOrder(built.graph);
  assert.throws(() => {
    ordered.order.push('z');
  }, TypeError);
});

test('source has no side-effect authority', () => {
  const source = readFileSync(sourcePath, 'utf8');
  for (const token of [
    'node:fs',
    'node:net',
    'node:http',
    'node:https',
    'node:child_process',
    'process.env',
    'child_process',
    'governanceValidator',
    'actorCapabilityEngine',
    'backend/',
  ]) {
    assert.equal(source.includes(token), false, token);
  }
  assert.equal(source.includes('import '), false);
});

test('source does not load validator actor backend or db modules', () => {
  const source = readFileSync(sourcePath, 'utf8');
  assert.equal(source.includes('require('), false);
  assert.match(source, /migration 056/);
  assert.match(source, /COMPLETED/);
  assert.match(source, /owns no persistence/);
  assert.equal(TASK_COMPLETION_STATUS.COMPLETED, 'COMPLETED');
  assert.equal(Object.isFrozen(TASK_GRAPH_DECISIONS), true);
  assert.equal(Object.isFrozen(TASK_READINESS_DECISIONS), true);
});
