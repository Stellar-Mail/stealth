import assert from "node:assert";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assignWorkload } from "../services/workloadBalancer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");

const fixturePath = join(__dirname, "..", "fixtures", "sample-workload-requests.json");

const fixture = JSON.parse(await readFile(fixturePath, "utf8"));

const expectedAssignments = fixture.expectedAssignments;

assert.ok(Array.isArray(expectedAssignments), "fixture must expose expectedAssignments array");

const actualAssignments = assignWorkload({
  teamMembers: fixture.teamMembers,
  workItems: fixture.workItems,
});

assert.deepStrictEqual(
  actualAssignments,
  expectedAssignments,
  "Workload assignments must match the folder-local contract",
);

assert.strictEqual(
  actualAssignments.length,
  fixture.workItems.length,
  "All work items should return an assignment result",
);

const unassignedItem = actualAssignments.find((item) => item.taskId === "task-accounting-review");
assert.strictEqual(
  unassignedItem.status,
  "unassigned",
  "Tasks with no matching skills should remain unassigned",
);
assert.strictEqual(
  unassignedItem.reason,
  "skill mismatch",
  "The reason should explain why the task was not assigned",
);

const assignedLoads = actualAssignments
  .filter((item) => item.status === "assigned")
  .map((item) => item.assigneeId);
assert.deepStrictEqual(
  assignedLoads,
  ["bob", "cara", "cara", "alice"],
  "Assigned tasks should distribute to the expected members in contract order",
);

console.log("All folder-local workload balancer contract checks passed.");
