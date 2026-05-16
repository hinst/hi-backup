import chalk from 'chalk';

export enum TaskCommand {
	MIRROR = 'mirror',
	COMPRESS = 'compress',
	CHECK_HASH = 'checkHash',
	ENCRYPT = 'encrypt',
}

export class TaskConfig {
	constructor(
		readonly command: TaskCommand,
		readonly sourcePath: string,
		readonly targetPath: string,
		readonly password: string,
	) {}

	static createUndefined() {
		//@ts-ignore
		return new TaskConfig();
	}

	toColoredString() {
		const texts: string[] = [];
		if (this.sourcePath) texts.push(chalk.green(this.sourcePath));
		if (this.command) texts.push(chalk.bold(this.command));
		if (this.targetPath) texts.push(chalk.cyan(this.targetPath));
		return texts.join(' ');
	}
}

export class TaskConfigError extends Error {}
