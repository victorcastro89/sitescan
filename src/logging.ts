import chalk from 'chalk';
 class Log {
  public static info = (args: any): void => {
    // eslint-disable-next-line no-console
    console.log(
      chalk.blue(`
[Log]:`),
      typeof args === 'string' ? chalk.blueBright(args) : args,
    );
  };

  public static warn = (args: any): void => {
    // eslint-disable-next-line no-console
    console.log(
      chalk.yellow(`
[${new Date().toLocaleString()}]
[Info]:`),
      typeof args === 'string' ? chalk.yellowBright(args) : args,
    );
  };

  public static error = (args: any): void => {
    // eslint-disable-next-line no-console
    console.log(
      chalk.red(`
[${new Date().toLocaleString()}]
[Warn]:`),
      typeof args === 'string' ? chalk.redBright(args) : args,
    );
  };

  public static log = (args: any): void => {
    // eslint-disable-next-line no-console
    console.log(
      chalk.green(`
[${new Date().toLocaleString()}]
[Error]:`),
      typeof args === 'string' ? chalk.greenBright(args) : args,
    );
  };
}

export { Log };