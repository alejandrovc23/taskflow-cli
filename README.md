# Overview

TaskFlow CLI keeps a checklist in the terminal. A task can contain subtasks at any depth. Each entry has a permanent numeric ID, so completing a task does not depend on its position in the display. The project explores how TypeScript models recursive data and how to validate the same data when it comes back from disk.

# Development Environment

TaskFlow uses TypeScript in strict mode, Node.js 22 or later, npm, and Git. Node supplies the terminal and file APIs. TypeScript and Node type definitions are development dependencies.

From the project directory, run:

~~~sh
npm ci
npm run build
npm start
~~~

In the menu, try the following on an empty board:

~~~text
add Prepare release
sub 1 Run checks
sub 2 Test restart
done 3
list
exit
~~~

The list shows:

~~~text
[ ] 1 Prepare release
  [ ] 2 Run checks
    [x] 3 Test restart
~~~

Run `npm start -- list` from the same directory to reopen the saved board. Commands also work directly from the shell, for example `npm start -- add Buy groceries`. Completing a parent changes only that entry. Enter `help` to see the commands.

In `src/board.ts`, the TaskBoard class stores typed lists of tasks. The walk generator recursively visits each child list, which lets display indent each row and find locate a task by ID. The loader checks the shape and IDs of the JSON before accepting it. Edits use asynchronous file operations, a writer lock, and a rename to publish the completed file. In `src/cli.ts`, the interactive loop catches exceptions so a missing parent or invalid ID leaves the menu usable.

The default save file is `.taskflow/tasks.json` in the working directory. Set the TASKFLOW_HOME environment variable to use a different folder. If a process is forcibly terminated while saving, close all TaskFlow processes before manually removing the empty write.lock directory inside the data folder.

# Useful Websites

- [TypeScript Handbook on classes](https://www.typescriptlang.org/docs/handbook/2/classes.html)
- [TypeScript Handbook on narrowing unknown values](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [Node.js promise-based file operations](https://nodejs.org/api/fs.html#promises-api)

# Future Work

- Add a rename command that preserves the task ID and its children.
- Add an open-task filter that keeps ancestor titles visible for context.
- Support moving a subtask between parents with cycle detection.
