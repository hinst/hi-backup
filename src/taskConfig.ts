import chalk from 'chalk';
import { filesize } from 'filesize';
import { getFolderSize } from 'src/folderStats';

export enum TaskCommand {
	MIRROR = 'mirror',
	COMPRESS = 'compress',
	CHECK_HASH = 'checkHash',
	ENCRYPT = 'encrypt',
}

export const FOLDER_SYNC_COMMANDS = [TaskCommand.MIRROR, TaskCommand.COMPRESS, TaskCommand.ENCRYPT];

export class TaskConfig {
	constructor(
		readonly command: TaskCommand,
		readonly sourcePath: string = '',
		readonly targetPath: string = '',
		readonly ignoredList: string[] = [],
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

	formatSizeReport(targetSizeBefore: number): string {
		const targetSize = getFolderSize(this.targetPath);
		return (
			chalk.bold('SIZE') +
			' ' +
			chalk.green(this.sourcePath) +
			' ' +
			filesize(getFolderSize(this.sourcePath)) +
			' ' +
			chalk.bold(this.command) +
			' ' +
			chalk.cyan(this.targetPath) +
			' ' +
			filesize(targetSizeBefore) +
			' ' +
			(targetSize !== targetSizeBefore ? chalk.cyan('-> ') + filesize(targetSize) : '')
		);
	}
}

export class TaskConfigError extends Error {}
