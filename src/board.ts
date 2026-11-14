import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface Task {
  id: number;
  title: string;
  done: boolean;
  children: Task[];
}

/** Validate imported JSON before any command can change the file. */
function validateTree(value: unknown, ids: Set<number>): asserts value is Task[] {
  if (!Array.isArray(value)) throw new Error("Expected a list of tasks.");
  for (const task of value) {
    if (!task || !Number.isSafeInteger(task.id) || task.id < 1 || ids.has(task.id)) {
      throw new Error("Invalid or duplicate task ID.");
    }
    if (typeof task.title !== "string" || !task.title.trim() || typeof task.done !== "boolean") {
      throw new Error("Invalid task title or status.");
    }
    ids.add(task.id);
    validateTree(task.children, ids);
  }
}

/** Yield each task with its depth for lookup and indented terminal output. */
function* walk(tasks: Task[], depth = 0): Generator<[Task, number]> {
  for (const task of tasks) {
    yield [task, depth];
    yield* walk(task.children, depth + 1);
  }
}

export class TaskBoard {
  private roots: Task[];
  private nextId: number;

  /** Build a board from validated data and resume numbering after the largest ID. */
  constructor(data: unknown) {
    const ids = new Set<number>();
    validateTree(data, ids);
    this.roots = data;
    this.nextId = 1;
    for (const id of ids) this.nextId = Math.max(this.nextId, id + 1);
  }

  /** Resolve a typed ID anywhere in the tree or report the invalid request. */
  private find(raw: string): Task {
    if (!/^[1-9]\d*$/.test(raw)) throw new Error("Enter a positive integer ID.");
    for (const [task] of walk(this.roots)) {
      if (task.id === Number(raw)) return task;
    }
    throw new Error("Task " + raw + " does not exist.");
  }

  /** Append a root or a child and return its permanent ID. */
  add(title: string, parent?: string): number {
    const clean = title.trim();
    if (!clean) throw new Error("Enter a task title.");
    const siblings = parent === undefined ? this.roots : this.find(parent).children;
    if (!Number.isSafeInteger(this.nextId)) throw new Error("Task IDs exhausted.");
    const task = { id: this.nextId++, title: clean, done: false, children: [] };
    siblings.push(task);
    return task.id;
  }

  /** Complete only the selected task so each subtask retains its own status. */
  complete(id: string): void {
    this.find(id).done = true;
  }

  /** Print a checklist with two spaces of indentation per parent. */
  display(): void {
    if (!this.roots.length) console.log("No tasks yet.");
    for (const [task, depth] of walk(this.roots)) {
      console.log("  ".repeat(depth) + (task.done ? "[x] " : "[ ] ") + task.id + " " + task.title);
    }
  }

  /** Serialize the task tree without transient bookkeeping fields. */
  serialize(): string {
    return JSON.stringify(this.roots, null, 2) + "\n";
  }
}

/** Initialize an empty board on first use and propagate all other read failures. */
export async function loadBoard(directory: string): Promise<TaskBoard> {
  try {
    const data = await readFile(join(directory, "tasks.json"), "utf8");
    return new TaskBoard(JSON.parse(data));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new TaskBoard([]);
    throw error;
  }
}

/** Lock the read-modify-write cycle and replace saved data only after a full write. */
export async function editBoard(directory: string, change: (board: TaskBoard) => string): Promise<string> {
  await mkdir(directory, { recursive: true });
  const lock = join(directory, "write.lock");
  try {
    await mkdir(lock);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Board is locked. Retry shortly.");
    throw error;
  }
  const temp = join(directory, randomUUID() + ".tmp");
  try {
    const board = await loadBoard(directory);
    const message = change(board);
    await writeFile(temp, board.serialize(), "utf8");
    await rename(temp, join(directory, "tasks.json"));
    return message;
  } finally {
    try {
      await rm(temp, { force: true });
    } finally {
      await rm(lock, { recursive: true });
    }
  }
}
