export function fireAndForget<T>(task: Promise<T>, label = 'background task'): void {
  void task.catch((error) => {
    console.error(`[Async] ${label} failed:`, error);
  });
}
