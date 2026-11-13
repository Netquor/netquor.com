// lib/deadline.ts: stop waiting for something slow (it is not cancelled; the caller just no longer holds up on it).
export class DeadlineError extends Error { constructor() { super("deadline passed"); this.name = "DeadlineError"; } }

export function withDeadline<T>(work: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new DeadlineError()), ms);
        work.then((v) => { clearTimeout(timer); resolve(v); }, (e) => { clearTimeout(timer); reject(e); });
    });
}
