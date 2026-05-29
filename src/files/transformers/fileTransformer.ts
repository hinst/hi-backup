import fs from 'node:fs';
import { compareFiles, type FileKind } from 'src/files/file';

export class FileTransformer {
	private _sourcePath: string = '';
	get sourcePath() {
		return this._sourcePath;
	}
	set sourcePath(value: string) {
		this._sourcePath = value;
	}

	private _targetPath: string = '';
	get targetPath() {
		return this._targetPath;
	}
	set targetPath(value: string) {
		this._targetPath = value;
	}

	isReverse: boolean = false;

	validate() {
	}

	/**
		@param path Relative path from the source directory
		@return List of relative paths. The 0th item on the list must be the primary path.
			The rest of the paths can be used to store metadata in the target directory.
			Returning them is only necessary to know that they exist and avoid deleting them
			as items that do not exist in the source directory when backward sync runs.
			Return empty array if the item should not be encoded at all.
	*/
	encodePath(path: string, _: FileKind): string[] {
		return [path];
	}

	/**
		@param path Relative path from the source directory, packed
		@return Relative paths, unpacked. Return empty array if the file should not be unpacked.
			For example, metadata files should not be unpacked.
	*/
	decodePath(path: string, _: FileKind): string[] {
		return [path];
	}

	/**
		Copy file from sourcePath to targetPath, unless the files are already equal.
		Applied only to files, not folders.
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

	/**
		@param sourcePath Absolute path
		@param targetPath Absolute path
		@returns true if file got changed
	*/
	async unpackFile(sourcePath: string, targetPath: string): Promise<boolean> {
		if (compareFiles(sourcePath, targetPath)) return false;
		fs.copyFileSync(sourcePath, targetPath);
		return true;
	}
}
