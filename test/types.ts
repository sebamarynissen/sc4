export type AssertEqual<T, U> = (<V>() => V extends T ? 1 : 2) extends (<V>() => V extends U ? 1 : 2) ? true : false;
export function assertEqual<A, B>(_: AssertEqual<A, B>) {}
