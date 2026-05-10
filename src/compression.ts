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
	const source = fs.createReadStream(sourcePath);
	const target = fs.createReadStream(targetPath);
	const gunzip = zlib.createGunzip();
	return new Promise((resolve, reject) => {
		const decompressed = target.pipe(gunzip);
		let sourceEnded = false;
		let decompressedEnded = false;
		let sourceBuf = Buffer.alloc(0);
		let decompressedBuf = Buffer.alloc(0);

		function compare() {
			const len = Math.min(sourceBuf.length, decompressedBuf.length);
			if (len === 0) return;
			if (!sourceBuf.subarray(0, len).equals(decompressedBuf.subarray(0, len))) {
				reject(new FileFormatError('Compressed file does not match source: ' + targetPath));
				return;
			}
			sourceBuf = sourceBuf.subarray(len);
			decompressedBuf = decompressedBuf.subarray(len);
			checkEnd();
		}

		function checkEnd() {
			if (sourceEnded && decompressedEnded) {
				if (sourceBuf.length !== 0 || decompressedBuf.length !== 0)
					reject(new FileFormatError('Compressed file does not match source: ' + targetPath));
				else resolve();
			}
		}

		source.on('data', (chunk: Buffer | string) => {
			if (typeof chunk === 'string')
				throw new FileFormatError('Unexpected chunk type. Need: Buffer, got: string');
			sourceBuf = Buffer.concat([sourceBuf, chunk]);
			compare();
		});
		source.on('end', () => {
			sourceEnded = true;
			checkEnd();
		});
		source.on('error', reject);

		decompressed.on('data', (chunk: Buffer) => {
			decompressedBuf = Buffer.concat([decompressedBuf, chunk]);
			compare();
		});
		decompressed.on('end', () => {
			decompressedEnded = true;
			checkEnd();
		});
		decompressed.on('error', (e) => {
			if ((e as AnyError).code === 'Z_DATA_ERROR')
				reject(new FileFormatError('Compression format error in: ' + targetPath));
			else reject(e);
		});
	});
}
