import fs from 'node:fs';
import {
	compareCompressedFile,
	compressFileGzip,
	GZIP_FILE_EXTENSION,
	unpackFileGzip,
} from '../compression';
import { FileFormatError, FileKind } from '../file';
import { FileTransformer } from './fileTransformer';

export class GzipFileTransformer extends FileTransformer {
	override encodePath(path: string, kind: FileKind) {
		if (kind === FileKind.FILE) path += '.gz';
		return [path];
	}

	override decodePath(path: string, kind: FileKind): string {
		if (kind === FileKind.FILE && path.endsWith(GZIP_FILE_EXTENSION))
			return path.slice(0, -GZIP_FILE_EXTENSION.length);
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

	override async unpackFile(sourcePath: string, targetPath: string) {
		if (fs.statSync(sourcePath).isFile()) await unpackFileGzip(sourcePath, targetPath);
		if (fs.statSync(sourcePath).isDirectory()) fs.mkdirSync(targetPath);
	}
}
