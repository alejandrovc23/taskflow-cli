import { createInterface } from "node:readline/promises";
import { resolve } from "node:path";
import { editBoard, loadBoard, type TaskBoard } from "./board.js";

const directory = resolve(process.env.TASKFLOW_HOME || ".taskflow");
const help = [
  "add TITLE             Create a top-level task",
  "sub PARENT_ID TITLE   Add a child at any depth",
  "done ID               Mark a task complete",
  "list                  Display the entire board",
  "help                  Show commands",
  "exit                  Leave the interactive menu",
].join("\n");

/** Interpret a single edit and return the message printed after the save succeeds. */
function applyEdit(board: TaskBoard, command: string, args: string[]): string {
  if (command === "add") return "Added task " + board.add(args.join(" "));
  if (command === "sub") {
    if (args.length < 2) throw new Error("Use sub PARENT_ID TITLE.");
    return "Added subtask " + board.add(args.slice(1).join(" "), args[0]);
  }
  if (command === "done" && args.length === 1) {
    board.complete(args[0]);
    return "Completed task " + args[0];
  }
  throw new Error("Invalid command or arguments. Enter help for usage.");
}

/** Dispatch read-only commands directly and save edits under a write lock. */
async function dispatch([command, ...args]: string[]): Promise<void> {
  if (command === "help" && !args.length) return console.log(help);
  if (command === "list" && !args.length) return (await loadBoard(directory)).display();
  console.log(await editBoard(directory, board => applyEdit(board, command, args)));
}

/** Present input and filesystem errors in a consistent terminal format. */
function report(error: unknown): void {
  console.error("TaskFlow: " + (error instanceof Error ? error.message : String(error)));
}

/** Run one shell command or accept commands until the interactive session ends. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length) return dispatch(args);
  console.log(help);
  const menu = createInterface({ input: process.stdin, output: process.stdout, prompt: "taskflow> " });
  if (process.stdin.isTTY) menu.prompt();
  try {
    for await (const line of menu) {
      const input = line.trim();
      if (input === "exit") break;
      try {
        if (input) await dispatch(input.split(/\s+/));
      } catch (error) {
        report(error);
      }
      if (process.stdin.isTTY) menu.prompt();
    }
  } finally {
    menu.close();
  }
}

try {
  await main();
} catch (error) {
  report(error);
  process.exitCode = 1;
}
