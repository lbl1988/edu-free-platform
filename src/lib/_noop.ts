// 客户端构建时替换服务端原生包的 noop 占位，避免 webpack 因 node:xxx scheme 报错
const noop = {};

export default noop;
export const hash = async () => '';
export const verify = async () => false;
