// Define ANSI color codes
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
  brightGreen: "\x1b[92m"
};

export const logger = {
  info: (message: string, data?: any) => {
    console.log(
      `${colors.green}[INFO]${colors.reset} ${colors.gray}${new Date().toISOString()}${colors.reset} - ${message}`,
      data ? data : ''
    );
  },
  warn: (message: string, data?: any) => {
    console.log(
      `${colors.yellow}[WARN]${colors.reset} ${colors.gray}${new Date().toISOString()}${colors.reset} - ${message}`,
      data ? data : ''
    );
  },
  error: (message: string, error?: any) => {
    console.error(
      `${colors.red}[ERROR]${colors.reset} ${colors.gray}${new Date().toISOString()}${colors.reset} - ${message}`,
      error ? error : ''
    );
  },
  debug: (message: string, data?: any) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(
        `${colors.cyan}[DEBUG]${colors.reset} ${colors.gray}${new Date().toISOString()}${colors.reset} - ${message}`,
        data ? data : ''
      );
    }
  },
  websocket: (message: string, data?: any) => {
    console.log(
      `${colors.magenta}[WEBSOCKET]${colors.reset} ${colors.gray}${new Date().toISOString()}${colors.reset} - ${message}`,
      data ? data : ''
    );
  }
};
