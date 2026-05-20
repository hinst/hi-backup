import fs from 'node:fs';
import zlib from 'node:zlib';

export class GzipChunkReader {
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
