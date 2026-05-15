import type fs from 'node:fs';
import path from 'node:path';
import { FileKind } from './file';

export class FolderSyncItem {
	constructor(
		readonly path: string,
		readonly type: FileKind,
	) {}

	public static create(entry: fs.Dirent<string>) {
		let sourcePath = entry.parentPath + '/' + entry.name;
		if (path.sep === '\\') sourcePath = sourcePath.replaceAll('\\', '/');
		const fileKind = entry.isFile()
			? FileKind.FILE
			: entry.isDirectory()
				? FileKind.DIRECTORY
				: undefined;
		if (!fileKind) throw new Error('Undefined file kind');
		return new FolderSyncItem(sourcePath, fileKind);
	}
}
