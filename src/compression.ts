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

class GzipChunkReader {
	constructor(readonly sourcePath: string) {}

	async read(receiver: (chunk: Buffer) => void): Promise<void> {
		const source = fs.createReadStream(this.sourcePath);
		const gunzip = zlib.createGunzip();
		const decompressed = source.pipe(gunzip);

		let isClosed = false;
		/** @returns true if closed */
		function close(): boolean {
			if (isClosed) return false;
			gunzip.destroy();
			source.destroy();
			isClosed = true;
			return true;
		}

		return new Promise((resolve, reject) => {
			decompressed.on('data', (chunk: Buffer) => {
				try {
					receiver(chunk);
				} catch (e) {
					if (close()) reject(e);
				}
			});
			decompressed.on('end', () => {
				if (close()) resolve();
			});
			decompressed.on('error', (e) => {
				if (close()) reject(e);
			});
			source.on('error', (e) => {
				if (close()) reject(e);
			});
		});
	}
}

export async function compareCompressedFile(
	sourcePath: string,
	compressedPath: string,
): Promise<boolean> {
	const reader = new GzipChunkReader(compressedPath);
	const sourceFile = fs.openSync(sourcePath, 'r');
	let equal = true;
	try {
		await reader.read(unpackedChunk => {
			const sourceChunk = Buffer.alloc(unpackedChunk.length);
			fs.readSync(sourceFile, sourceChunk, 0, sourceChunk.length, null);
			if (!sourceChunk.equals(unpackedChunk))
				equal = false;
		});
		equal = equal && 0 === fs.readSync(sourceFile, Buffer.alloc(1), 0, 1, null);
	} finally {
		fs.closeSync(sourceFile);
	}
	return equal;
}
