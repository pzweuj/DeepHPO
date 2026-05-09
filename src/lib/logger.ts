/**
 * 日志控制模块
 * 通过环境变量 ENABLE_LOG 控制是否输出日志
 * - ENABLE_LOG=true: 输出所有日志
 * - ENABLE_LOG=false 或未设置: 禁用日志
 */

const isLogEnabled = process.env.ENABLE_LOG === 'true';

export const logger = {
  log: (...args: any[]) => {
    if (isLogEnabled) {
      console.log(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isLogEnabled) {
      console.warn(...args);
    }
  },

  error: (...args: any[]) => {
    // 错误日志默认输出，除非明确设置为 false
    if (process.env.ENABLE_LOG !== 'false') {
      console.error(...args);
    }
  },

  debug: (...args: any[]) => {
    if (isLogEnabled) {
      console.log('[DEBUG]', ...args);
    }
  }
};

export default logger;