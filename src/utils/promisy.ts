type InferArguments<T> = T extends (
  ...t: [...infer Arg, (...args: any) => any]
) => any
  ? Arg
  : never;
type InferCallbackResults<T> = T extends (
  ...t: [...infer Arg, (res: infer Res) => any]
) => any
  ? Res
  : never;

export default function promisify<Fun extends (...args: any[]) => any>(
  f: Fun
): (...args: InferArguments<Fun>) => Promise<InferCallbackResults<Fun>> {
  return (...args: InferArguments<Fun>) =>
    new Promise((resolve) => {
      function cb(result: InferCallbackResults<Fun>) {
        resolve(result);
      }

      args.push(cb);
      f.call(null, ...args);
    });
}
