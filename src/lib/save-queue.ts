/** 連続タップでも、前の保存が終わってから次を読む */
export function createSaveQueue() {
  let chain: Promise<void> = Promise.resolve();

  return function enqueue(task: () => Promise<void>): Promise<void> {
    const run = chain.then(task, task);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  };
}
