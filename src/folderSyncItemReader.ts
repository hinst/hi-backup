import fs from 'node:fs';
import { FileKind } from './file';
import { FolderSyncItem } from './folderSyncItem';

export class FolderSyncItemReader {
	fileCount: number = 0;
	directoryCount: number = 0;

	constructor(readonly checkIgnored: (fileName: string) => boolean) {}

	run(depth: number, sourcePath: string): FolderSyncItem[] {
		const syncItems: FolderSyncItem[] = [];
		const sourceFiles = fs.readdirSync(sourcePath, { withFileTypes: true });
		for (const entry of sourceFiles) {
			if (depth === 1 && this.checkIgnored(entry.name)) continue;
			syncItems.push(FolderSyncItem.create(depth, entry));
		}
		for (const syncItem of syncItems.slice()) {
			switch (syncItem.kind) {
				case FileKind.DIRECTORY: {
					++this.directoryCount;
					break;
				}
				case FileKind.FILE: {
					++this.fileCount;
					break;
				}
			}
			if (syncItem.kind === FileKind.DIRECTORY)
				syncItems.push(...this.run(depth + 1, syncItem.path));
		}
		return syncItems;
	}
}
