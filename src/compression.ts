import fs from 'node:fs';
import zlib from 'node:zlib';
import { FileFormatError } from './file';

export function compressBuffer(buffer: Buffer): Buffer {
	return zlib.deflateSync(buffer);
}

export function inflateBuffer(buffer: Buffer): Buffer {
	try {
		return zlib.inflateSync(buffer);
	} catch (e) {
		if ((e as AnyError).code === 'Z_DATA_ERROR')
			throw new FileFormatError('Compression format error');
		else throw e;
	}
}

export async function compressFile(sourcePath: string, targetPath: string): Promise<void> {
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

export async function compareCompressedFile(sourcePath: string, targetPath: string): Promise<void> {
}
