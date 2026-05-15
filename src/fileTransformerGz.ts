import fs from 'node:fs';
import { compareCompressedFile, compressFileGzip } from './compression';
import { FileFormatError, FileKind } from './file';
import { FileTransformer } from './fileTransformer';

export class FileTransformerGz extends FileTransformer {
	override encodePath(path: string, kind: FileKind) {
		if (kind === FileKind.FILE) path += '.gz';
		return path;
	}

	override async syncFile(sourcePath: string, targetPath: string): Promise<boolean> {
		if (!fs.existsSync(targetPath)) {
			await compressFileGzip(sourcePath, targetPath);
			return true;
		}
		let isEqual = false;
		try {
			isEqual = await compareCompressedFile(sourcePath, targetPath);
		} catch (e) {
			if (e instanceof FileFormatError) isEqual = false;
			else throw e;
		}
		if (isEqual) return false;
		await compressFileGzip(sourcePath, targetPath);
		return true;
	}
}
