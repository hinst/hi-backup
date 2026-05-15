export enum TaskCommand {
	MIRROR = 'mirror',
	COMPRESS = 'compress',
}

export class TaskConfig {
	constructor(
		readonly sourcePath: string,
		readonly targetPath: string,
		readonly command: TaskCommand,
	) {}

	validate() {
		if (!this.sourcePath?.length) throw new TaskConfigError('Need sourcePath');
		if (!this.targetPath?.length) throw new TaskConfigError('Need targetPath');
		if (!this.command?.length) throw new TaskConfigError('Need command');
	}

	static createUndefined() {
		//@ts-ignore
		return new TaskConfig();
	}

	toString() {
		return this.sourcePath + ' ' + this.command + ' ' + this.targetPath;
	}
}

export class TaskConfigError extends Error {}
