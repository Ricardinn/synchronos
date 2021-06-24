module.exports = (fn) => {
  return (...args) => {
    return new Promise((resolve, reject) => {
      const cb = (err, ...results) => {
        if (err) return reject(err);

        return resolve(results.length === 1 ? results[0] : results);
      };

      args.push(cb);
      fn.call(this, ...args);
    });
  };
};
