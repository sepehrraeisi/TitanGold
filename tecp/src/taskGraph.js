/**
 * TECP-008 in-memory task graph.
 *
 * Persistent schema owner remains migration 056 (`tecp_tasks`,
 * `tecp_task_dependencies`). In-memory `taskId` maps conceptually to task
 * identity. A dependency maps to task → dependsOn task
 * (`task_id` → `depends_on_task_id`). `COMPLETED` is a graph-level
 * satisfaction token only. This module owns no persistence and creates
 * no authorization.
 */

export const TASK_COMPLETION_STATUS = Object.freeze({
  COMPLETED: 'COMPLETED',
});

export const TASK_GRAPH_DECISIONS = Object.freeze({
  VALID: 'VALID',
  INVALID_DUPLICATE_TASK: 'INVALID_DUPLICATE_TASK',
  INVALID_MISSING_DEPENDENCY: 'INVALID_MISSING_DEPENDENCY',
  INVALID_SELF_DEPENDENCY: 'INVALID_SELF_DEPENDENCY',
  INVALID_DUPLICATE_EDGE: 'INVALID_DUPLICATE_EDGE',
  INVALID_CYCLE: 'INVALID_CYCLE',
  INVALID_TASK: 'INVALID_TASK',
  INVALID_DEPENDENCY: 'INVALID_DEPENDENCY',
});

export const TASK_READINESS_DECISIONS = Object.freeze({
  READY: 'READY',
  BLOCKED_DEPENDENCY: 'BLOCKED_DEPENDENCY',
  UNKNOWN_TASK: 'UNKNOWN_TASK',
  INVALID_GRAPH: 'INVALID_GRAPH',
});

const DECISION_PRIORITY = Object.freeze([
  TASK_GRAPH_DECISIONS.INVALID_TASK,
  TASK_GRAPH_DECISIONS.INVALID_DUPLICATE_TASK,
  TASK_GRAPH_DECISIONS.INVALID_DEPENDENCY,
  TASK_GRAPH_DECISIONS.INVALID_SELF_DEPENDENCY,
  TASK_GRAPH_DECISIONS.INVALID_MISSING_DEPENDENCY,
  TASK_GRAPH_DECISIONS.INVALID_DUPLICATE_EDGE,
  TASK_GRAPH_DECISIONS.INVALID_CYCLE,
]);

const TASK_KEYS = Object.freeze(['taskId', 'status']);
const DEPENDENCY_KEYS = Object.freeze(['taskId', 'dependsOnTaskId']);

function isPlainObject(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value);
  if (actual.length !== keys.length) return false;
  return keys.every((key) => actual.includes(key));
}

function isTaskShape(value) {
  return isPlainObject(value)
    && hasExactKeys(value, TASK_KEYS)
    && isNonEmptyString(value.taskId)
    && isNonEmptyString(value.status);
}

function isDependencyShape(value) {
  return isPlainObject(value)
    && hasExactKeys(value, DEPENDENCY_KEYS)
    && isNonEmptyString(value.taskId)
    && isNonEmptyString(value.dependsOnTaskId);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function compareTaskId(left, right) {
  if (left.taskId < right.taskId) return -1;
  if (left.taskId > right.taskId) return 1;
  return 0;
}

function compareEdge(left, right) {
  if (left.taskId < right.taskId) return -1;
  if (left.taskId > right.taskId) return 1;
  if (left.dependsOnTaskId < right.dependsOnTaskId) return -1;
  if (left.dependsOnTaskId > right.dependsOnTaskId) return 1;
  return 0;
}

function insertSorted(queue, taskId) {
  let index = 0;
  while (index < queue.length && queue[index] < taskId) index += 1;
  queue.splice(index, 0, taskId);
}

function freezeDeep(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

function invalidResult(decision, reasons) {
  return freezeDeep({
    valid: false,
    decision,
    reasons: uniqueSorted(reasons),
    graph: null,
  });
}

function kahnOrder(tasks, dependencies) {
  const indegree = new Map();
  const dependents = new Map();
  for (const task of tasks) {
    indegree.set(task.taskId, 0);
    dependents.set(task.taskId, []);
  }
  for (const dependency of dependencies) {
    indegree.set(dependency.taskId, indegree.get(dependency.taskId) + 1);
    dependents.get(dependency.dependsOnTaskId).push(dependency.taskId);
  }

  const ready = [];
  for (const taskId of indegree.keys()) {
    if (indegree.get(taskId) === 0) insertSorted(ready, taskId);
  }

  const order = [];
  while (ready.length > 0) {
    const current = ready.shift();
    order.push(current);
    for (const dependent of dependents.get(current)) {
      const remaining = indegree.get(dependent) - 1;
      indegree.set(dependent, remaining);
      if (remaining === 0) insertSorted(ready, dependent);
    }
  }

  return order.length === tasks.length ? order : null;
}

function classify(tasks, dependencies) {
  const issues = {
    [TASK_GRAPH_DECISIONS.INVALID_TASK]: [],
    [TASK_GRAPH_DECISIONS.INVALID_DUPLICATE_TASK]: [],
    [TASK_GRAPH_DECISIONS.INVALID_DEPENDENCY]: [],
    [TASK_GRAPH_DECISIONS.INVALID_SELF_DEPENDENCY]: [],
    [TASK_GRAPH_DECISIONS.INVALID_MISSING_DEPENDENCY]: [],
    [TASK_GRAPH_DECISIONS.INVALID_DUPLICATE_EDGE]: [],
    [TASK_GRAPH_DECISIONS.INVALID_CYCLE]: [],
  };
  const taskCopies = [];
  const seenTaskIds = new Set();

  if (!Array.isArray(tasks)) {
    issues[TASK_GRAPH_DECISIONS.INVALID_TASK].push('MALFORMED_TASK_INPUT');
  } else {
    for (const task of tasks) {
      if (!isTaskShape(task)) {
        const taskId = isPlainObject(task) && isNonEmptyString(task.taskId) ? task.taskId : null;
        issues[TASK_GRAPH_DECISIONS.INVALID_TASK].push(taskId ? `MALFORMED_TASK:${taskId}` : 'MALFORMED_TASK');
        continue;
      }
      if (seenTaskIds.has(task.taskId)) {
        issues[TASK_GRAPH_DECISIONS.INVALID_DUPLICATE_TASK].push(`DUPLICATE_TASK:${task.taskId}`);
        continue;
      }
      seenTaskIds.add(task.taskId);
      taskCopies.push({ taskId: task.taskId, status: task.status });
    }
  }

  const dependencyCopies = [];
  const seenEdges = new Set();
  if (!Array.isArray(dependencies)) {
    issues[TASK_GRAPH_DECISIONS.INVALID_DEPENDENCY].push('MALFORMED_DEPENDENCY_INPUT');
  } else {
    for (const dependency of dependencies) {
      if (!isDependencyShape(dependency)) {
        const taskId = isPlainObject(dependency) && isNonEmptyString(dependency.taskId)
          ? dependency.taskId
          : null;
        const dependsOnTaskId = isPlainObject(dependency) && isNonEmptyString(dependency.dependsOnTaskId)
          ? dependency.dependsOnTaskId
          : null;
        issues[TASK_GRAPH_DECISIONS.INVALID_DEPENDENCY].push(
          taskId && dependsOnTaskId
            ? `MALFORMED_DEPENDENCY:${taskId}->${dependsOnTaskId}`
            : 'MALFORMED_DEPENDENCY',
        );
        continue;
      }
      if (dependency.taskId === dependency.dependsOnTaskId) {
        issues[TASK_GRAPH_DECISIONS.INVALID_SELF_DEPENDENCY].push(`SELF_DEPENDENCY:${dependency.taskId}`);
        continue;
      }
      const edgeKey = `${dependency.taskId}\0${dependency.dependsOnTaskId}`;
      if (seenEdges.has(edgeKey)) {
        issues[TASK_GRAPH_DECISIONS.INVALID_DUPLICATE_EDGE].push(
          `DUPLICATE_EDGE:${dependency.taskId}->${dependency.dependsOnTaskId}`,
        );
        continue;
      }
      seenEdges.add(edgeKey);
      if (!seenTaskIds.has(dependency.taskId) || !seenTaskIds.has(dependency.dependsOnTaskId)) {
        issues[TASK_GRAPH_DECISIONS.INVALID_MISSING_DEPENDENCY].push(
          `MISSING_DEPENDENCY:${dependency.taskId}->${dependency.dependsOnTaskId}`,
        );
        continue;
      }
      dependencyCopies.push({
        taskId: dependency.taskId,
        dependsOnTaskId: dependency.dependsOnTaskId,
      });
    }
  }

  for (const decision of DECISION_PRIORITY) {
    if (decision === TASK_GRAPH_DECISIONS.INVALID_CYCLE) break;
    if (issues[decision].length > 0) {
      return { decision, reasons: uniqueSorted(issues[decision]), tasks: null, dependencies: null };
    }
  }

  taskCopies.sort(compareTaskId);
  dependencyCopies.sort(compareEdge);
  if (!kahnOrder(taskCopies, dependencyCopies)) {
    return {
      decision: TASK_GRAPH_DECISIONS.INVALID_CYCLE,
      reasons: ['CYCLE'],
      tasks: null,
      dependencies: null,
    };
  }

  return {
    decision: TASK_GRAPH_DECISIONS.VALID,
    reasons: [],
    tasks: taskCopies,
    dependencies: dependencyCopies,
  };
}

export function buildTaskGraph(tasks, dependencies) {
  const classified = classify(tasks, dependencies);
  if (classified.decision !== TASK_GRAPH_DECISIONS.VALID) {
    return invalidResult(classified.decision, classified.reasons);
  }
  return freezeDeep({
    valid: true,
    decision: TASK_GRAPH_DECISIONS.VALID,
    reasons: [],
    graph: {
      tasks: classified.tasks,
      dependencies: classified.dependencies,
    },
  });
}

function rebuild(graph) {
  if (!isPlainObject(graph) || !Array.isArray(graph.tasks) || !Array.isArray(graph.dependencies)) {
    return null;
  }
  return buildTaskGraph(graph.tasks, graph.dependencies);
}

export function evaluateTaskReadiness(graph, taskId) {
  const echoedTaskId = typeof taskId === 'string' ? taskId : null;
  const rebuilt = rebuild(graph);
  if (!rebuilt || !rebuilt.valid) {
    return freezeDeep({
      ready: false,
      decision: TASK_READINESS_DECISIONS.INVALID_GRAPH,
      taskId: echoedTaskId,
      blockingDependencies: [],
      reasons: ['INVALID_GRAPH'],
    });
  }

  const known = isNonEmptyString(taskId)
    && rebuilt.graph.tasks.some((task) => task.taskId === taskId);
  if (!known) {
    return freezeDeep({
      ready: false,
      decision: TASK_READINESS_DECISIONS.UNKNOWN_TASK,
      taskId: echoedTaskId,
      blockingDependencies: [],
      reasons: ['UNKNOWN_TASK'],
    });
  }

  const blockingDependencies = uniqueSorted(
    rebuilt.graph.dependencies
      .filter((dependency) => dependency.taskId === taskId)
      .filter((dependency) => {
        const prerequisite = rebuilt.graph.tasks.find((task) => task.taskId === dependency.dependsOnTaskId);
        return !prerequisite || prerequisite.status !== TASK_COMPLETION_STATUS.COMPLETED;
      })
      .map((dependency) => dependency.dependsOnTaskId),
  );

  if (blockingDependencies.length === 0) {
    return freezeDeep({
      ready: true,
      decision: TASK_READINESS_DECISIONS.READY,
      taskId,
      blockingDependencies: [],
      reasons: [],
    });
  }

  return freezeDeep({
    ready: false,
    decision: TASK_READINESS_DECISIONS.BLOCKED_DEPENDENCY,
    taskId,
    blockingDependencies,
    reasons: blockingDependencies.map((dependencyId) => `BLOCKED_DEPENDENCY:${dependencyId}`),
  });
}

export function topologicalOrder(graph) {
  const rebuilt = rebuild(graph);
  if (!rebuilt) {
    return freezeDeep({
      valid: false,
      decision: TASK_READINESS_DECISIONS.INVALID_GRAPH,
      order: [],
      reasons: ['INVALID_GRAPH'],
    });
  }
  if (!rebuilt.valid) {
    return freezeDeep({
      valid: false,
      decision: rebuilt.decision,
      order: [],
      reasons: rebuilt.reasons.slice(),
    });
  }

  const order = kahnOrder(rebuilt.graph.tasks, rebuilt.graph.dependencies);
  if (!order) {
    return freezeDeep({
      valid: false,
      decision: TASK_GRAPH_DECISIONS.INVALID_CYCLE,
      order: [],
      reasons: ['CYCLE'],
    });
  }

  return freezeDeep({
    valid: true,
    decision: TASK_GRAPH_DECISIONS.VALID,
    order,
    reasons: [],
  });
}
