import fs from 'node:fs';
import { compareFiles, type FileKind } from './file';

export class FileTransformer {
	public sourcePath: string = '';
	public targetPath: string = '';

	/**
		@param path Relative path from the source directory
		@return List of relative paths. The 0th item on the list must be the primary path.
			The rest of the paths can be used to store metadata in the target directory.
			Returning them is only necessary to know that they exist and avoid deleting them as items
			that do not exist in the source directory.
	*/
	encodePath(path: string, _: FileKind): string[] {
		return [path];
	}

	/**
		@param path Relative path, packed
		@return Relative path, unpacked. Return empty string if the file should not be unpacked.
			For example, metadata files should not be unpacked.
	*/
	decodePath(path: string, _: FileKind): string {
		return path;
	}

	/**
		@param sourcePath Absolute path
		@param targetPath Absolute path
		@returns true if file got changed
	*/
	async syncFile(sourcePath: string, targetPath: string): Promise<boolean> {
		if (compareFiles(sourcePath, targetPath)) return false;
		return new Promise((resolve, reject) => {
			fs.copyFile(sourcePath, targetPath, (error) => {
				if (error) reject(error);
				else resolve(true);
			});
		});
	}

	async unpackFile(sourcePath: string, targetPath: string) {
		fs.copyFileSync(sourcePath, targetPath);
	}
}
