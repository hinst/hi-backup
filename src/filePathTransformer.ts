import type { FileKind } from './file';

export class FileTransformer {
	encodePath(path: string, type: FileKind) {
		return path;
	}

	/** @returns true if file got changed */
	async syncFile(sourcePath: string, targetPath: string): Promise<boolean> {
		return true;
	}
}
