export class AsyncTaskQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.pending = [];
    this.activeCount = 0;
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.pending.push({ task, resolve, reject });
      this.#next();
    });
  }

  #next() {
    if (this.activeCount >= this.concurrency) {
      return;
    }

    const workItem = this.pending.shift();
    if (!workItem) {
      return;
    }

    this.activeCount += 1;
    Promise.resolve()
      .then(workItem.task)
      .then((result) => {
        workItem.resolve(result);
      })
      .catch((error) => {
        workItem.reject(error);
      })
      .finally(() => {
        this.activeCount -= 1;
        this.#next();
      });
  }
}
