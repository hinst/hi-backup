import crypto from 'crypto';
import fs from 'fs';
import {
	CHUNK_SIZE,
	FileFormatError,
	readNextByte,
	readPreSizedChunk,
	writePreSizedChunk
} from './file';

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const HASHING_ALGORITHM = 'sha256';
const NOISE_SIZE = 16;

export class Encryption {
	constructor(private readonly password: string) {}

	private _key?: Buffer;

	static createNoise() {
		return crypto.randomBytes(NOISE_SIZE);
	}

	encrypt(noise: Uint8Array, data: Buffer) {
		const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.key, noise);
		const buffer1 = cipher.update(data);
		const buffer2 = cipher.final();
		const output = Buffer.concat([buffer1, buffer2]);
		return output;
	}

	decrypt(noise: Uint8Array, data: Buffer) {
		const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.key, noise);
		const buffer1 = decipher.update(data);
		const buffer2 = decipher.final();
		const output = Buffer.concat([buffer1, buffer2]);
		return output;
	}

	private get key(): Buffer {
		if (!this._key)
			this._key = crypto.createHash(HASHING_ALGORITHM).update(this.password).digest();
		return this._key;
	}

	encryptFile(sourceFilePath: string, destinationFilePath: string) {
		const sourceFile = fs.openSync(sourceFilePath, 'r');
		const buffer = Buffer.alloc(CHUNK_SIZE);
		const noise = Encryption.createNoise();
		const outputFile = fs.openSync(destinationFilePath, 'w');
		fs.writeSync(outputFile, noise, 0, noise.length, null);
		while (true) {
			const byteCount = fs.readSync(sourceFile, buffer, 0, CHUNK_SIZE, null);
			if (!byteCount) break;
			const bytes = buffer.subarray(0, byteCount);
			const encryptedBytes = this.encrypt(noise, bytes);
			writePreSizedChunk(outputFile, encryptedBytes);
		}
		fs.closeSync(sourceFile);
		fs.closeSync(outputFile);
	}

	private static readNoise(file: number): Buffer {
		const buffer = Buffer.alloc(NOISE_SIZE);
		const bytesRead = fs.readSync(file, buffer, 0, NOISE_SIZE, null);
		if (bytesRead !== NOISE_SIZE) {
			throw new FileFormatError(
				'File format error: expected ' + NOISE_SIZE + ' bytes for noise'
			);
		}
		return buffer.subarray(0, NOISE_SIZE);
	}

	compareFileWithEncrypted(sourceFilePath: string, destinationFilePath: string): boolean {
		const sourceFile = fs.openSync(sourceFilePath, 'r');
		const destinationFile = fs.openSync(destinationFilePath, 'r');
		const sourceBuffer = Buffer.alloc(CHUNK_SIZE);
		const noise = Encryption.readNoise(destinationFile);
		let isConsistent = true;
		while (isConsistent) {
			const sourceSize = fs.readSync(sourceFile, sourceBuffer, 0, CHUNK_SIZE, null);
			if (!sourceSize) {
				const leftoverByte = readNextByte(destinationFile);
				if (leftoverByte !== undefined) isConsistent = false;
				break;
			}
			const sourceBytes = sourceBuffer.subarray(0, sourceSize);

			let encryptedBytes: Buffer;
			encryptedBytes = readPreSizedChunk(destinationFile);
			const decryptedBytes = this.decrypt(noise, encryptedBytes);
			if (sourceBytes.length !== decryptedBytes.length) {
				isConsistent = false;
				break;
			}
			for (let i = 0; i < sourceBytes.length; i++) {
				if (sourceBytes[i] !== decryptedBytes[i]) {
					isConsistent = false;
					break;
				}
			}
		}
		fs.closeSync(sourceFile);
		fs.closeSync(destinationFile);
		return isConsistent;
	}
}
