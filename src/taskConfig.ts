export enum TaskCommand {
	MIRROR = 'mirror',
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

	static createEmpty() {
		//@ts-ignore
		return new TaskConfig();
	}
}

export class TaskConfigError extends Error {}
