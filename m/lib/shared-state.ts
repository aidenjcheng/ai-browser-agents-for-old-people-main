// Shared state for browser automation tasks
// This allows sharing state between different API route handlers

declare global {
  var browserInstance: any;
  var activeTasks: Map<string, any>;
}

if (!global.activeTasks) {
  global.activeTasks = new Map();
}

if (!global.browserInstance) {
  global.browserInstance = null;
}

export const getBrowserInstance = () => global.browserInstance;
export const setBrowserInstance = (browser: any) => {
  global.browserInstance = browser;
};

export const getActiveTasks = () => global.activeTasks;
export const getTask = (taskId: string) => global.activeTasks.get(taskId);
export const setTask = (taskId: string, task: any) => global.activeTasks.set(taskId, task);
