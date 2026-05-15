import { FileKind } from './file';

export class FolderSyncItem {
	constructor(
		readonly path: string,
		readonly type: FileKind,
	) {}
}
