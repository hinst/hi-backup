import fs from 'node:fs';
import { compareFiles, type FileKind } from './file';

export class FileTransformer {
	public sourcePath: string = '';
	public targetPath: string = '';

	/**	@param path Relative path from the source directory */
	encodePath(path: string, _: FileKind) {
		return path;
	}

	/** @returns true if file got changed */
	async syncFile(sourcePath: string, targetPath: string): Promise<boolean> {
		if (compareFiles(sourcePath, targetPath)) return false;
		return new Promise((resolve, reject) => {
			fs.copyFile(sourcePath, targetPath, (error) => {
				if (error) reject(error);
				else resolve(true);
			});
		});
	}
}
