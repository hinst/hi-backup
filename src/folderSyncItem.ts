import type fs from 'node:fs';
import { FileKind, joinFilePath } from './file';

export class FolderSyncItem {
	constructor(
		readonly depth: number,
		readonly path: string,
		readonly kind: FileKind,
	) {}

	public static create(depth: number, entry: fs.Dirent<string>) {
		const sourcePath = joinFilePath(entry.parentPath, entry.name);
		const fileKind = entry.isFile()
			? FileKind.FILE
			: entry.isDirectory()
				? FileKind.DIRECTORY
				: undefined;
		if (fileKind == null) throw new Error('Undefined file kind');
		return new FolderSyncItem(depth, sourcePath, fileKind);
	}

	public toString() {
		const kind = this.kind === FileKind.DIRECTORY ? '[D] ' : '';
		return kind + this.path;
	}
}
