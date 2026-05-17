import fs from 'node:fs';
import { FileKind, joinFilePath } from './file';

export class FolderSyncItem {
	constructor(
		readonly depth: number,
		readonly path: string,
		readonly kind: FileKind,
	) {}

	static create(depth: number, entry: fs.Dirent<string>) {
		const sourcePath = joinFilePath(entry.parentPath, entry.name);
		const fileKind = entry.isFile()
			? FileKind.FILE
			: entry.isDirectory()
				? FileKind.DIRECTORY
				: undefined;
		if (fileKind == null) throw new Error('Undefined file kind');
		return new FolderSyncItem(depth, sourcePath, fileKind);
	}

	validate(sourcePath: string) {
		if (!this.path.startsWith(sourcePath))
			throw new Error(
				'Folder sync logic error: source path outside main source path: ' +
					sourcePath +
					' -> ' +
					this.path,
			);
		if (!fs.existsSync(this.path)) throw new Error('Source path does not exist: ' + this.path);
	}

	toString() {
		const kind = this.kind === FileKind.DIRECTORY ? '[D] ' : '';
		return kind + this.path;
	}
}
