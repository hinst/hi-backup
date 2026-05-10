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

export async function compareCompressedFile(
	sourcePath: string,
	targetPath: string,
): Promise<boolean> {
	const sourceFile = fs.openSync(sourcePath, 'r');
	const target = fs.createReadStream(targetPath);
	const gunzip = zlib.createGunzip();
	const decompressed = target.pipe(gunzip);
	let alive = true;

	function close() {
		if (!alive) return;
		fs.closeSync(sourceFile);
		gunzip.destroy();
		target.destroy();
		alive = false;
	}

	return new Promise((resolve, reject) => {
		function readSource(buffer: Buffer, size: number) {
			try {
				return fs.readSync(sourceFile, buffer, 0, size, null);
			} catch (e) {
				reject(e);
				close();
			}
		}

		decompressed.on('data', (chunk: Buffer) => {
			if (!alive) return;
			const buffer = Buffer.alloc(chunk.length);
			const byteCount = readSource(buffer, chunk.length);
			if (!alive) return;
			if (byteCount !== chunk.length || !buffer.equals(chunk)) {
				resolve(false);
				close();
			}
		});
		decompressed.on('end', () => {
			if (!alive) return;
			const buffer = Buffer.alloc(1);
			const byteCount = readSource(buffer, 1);
			if (!alive) return;
			close();
			resolve(byteCount === 0);
		});
		decompressed.on('error', (e) => {
			close();
			if ((e as AnyError).code === 'Z_DATA_ERROR')
				reject(new FileFormatError('Compression format error in: ' + targetPath));
			else reject(e);
		});
		target.on('error', (e) => {
			close();
			reject(e);
		});
	});
}
