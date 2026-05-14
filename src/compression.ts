import fs from 'node:fs';
import zlib from 'node:zlib';
import { FileFormatError } from './file';
import { GzipChunkReader } from './gzipChunkReader';

const ZLIB_FORMAT_ERRORS = [zlib.constants.Z_DATA_ERROR, zlib.constants.Z_BUF_ERROR];

export const GZIP_FILE_EXTENSION = '.gz';

export function compressBuffer(buffer: Buffer): Buffer {
	return zlib.deflateSync(buffer);
}

export function unpackBuffer(buffer: Buffer): Buffer {
	try {
		return zlib.inflateSync(buffer);
	} catch (e) {
		if ((e as AnyError).code === 'Z_DATA_ERROR')
			throw new FileFormatError('Compression format error');
		else throw e;
	}
}

export async function compressFileGzip(sourcePath: string, targetPath: string): Promise<void> {
	const gzip = zlib.createGzip();
	const input = fs.createReadStream(sourcePath);
	const output = fs.createWriteStream(targetPath);
	return new Promise((resolve, reject) => {
		input.pipe(gzip).pipe(output);
		output.on('finish', () => resolve());
		output.on('error', reject);
		input.on('error', reject);
		gzip.on('error', reject);
	});
}

export async function compareCompressedFile(
	sourcePath: string,
	compressedPath: string,
): Promise<boolean> {
	const reader = new GzipChunkReader(compressedPath);
	const sourceFile = fs.openSync(sourcePath, 'r');
	let equal = true;
	try {
		await reader.read((unpackedChunk) => {
			const sourceChunk = Buffer.alloc(unpackedChunk.length);
			fs.readSync(sourceFile, sourceChunk, 0, sourceChunk.length, null);
			if (!sourceChunk.equals(unpackedChunk)) equal = false;
		});
		equal = equal && 0 === fs.readSync(sourceFile, Buffer.alloc(1), 0, 1, null);
	} catch (e) {
		if (ZLIB_FORMAT_ERRORS.includes((e as GzipError).errno))
			throw new FileFormatError('Compression format error');
		else throw e;
	} finally {
		fs.closeSync(sourceFile);
	}
	return equal;
}
