import crypto from 'crypto';
import fs from 'fs';
import {
	FileFormatError,
	readPreSizedChunk,
	readBufferFromFile,
	writePreSizedChunk,
	writeBufferToFile,
	compressBuffer,
	inflateBuffer
} from './file';
import path from 'path';

const CHUNK_SIZE = 1024 * 1024;
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const HASHING_ALGORITHM = 'sha256';
const NOISE_SIZE = 16;

export class Encryption {
	constructor(private readonly password: string) {}

	private _key?: Buffer;

	private get key(): Buffer {
		if (!this._key) this._key = Encryption.createHash().update(this.password).digest();
		return this._key;
	}

	static createHash() {
		return crypto.createHash(HASHING_ALGORITHM);
	}

	static createNoise() {
		return crypto.randomBytes(NOISE_SIZE);
	}

	static createDefaultNoise() {
		return new Uint8Array(NOISE_SIZE).fill(0);
	}

	encrypt(noise: Uint8Array, data: Buffer) {
		data = compressBuffer(data);
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
		let output = Buffer.concat([buffer1, buffer2]);
		output = inflateBuffer(output);
		return output;
	}

	encryptFile(sourceFilePath: string, destinationFilePath: string) {
		const sourceFile = fs.openSync(sourceFilePath, 'r');
		const buffer = Buffer.alloc(CHUNK_SIZE);
		const outputFile = fs.openSync(destinationFilePath, 'w');
		const noise = Encryption.createNoise();
		fs.writeSync(outputFile, noise, 0, noise.length, null);
		const fileName = path.basename(sourceFilePath);
		writeBufferToFile(outputFile, this.encryptText(noise, fileName));
		while (true) {
			const byteCount = fs.readSync(sourceFile, buffer, 0, CHUNK_SIZE, null);
			if (!byteCount) break;
			const bytes = buffer.subarray(0, byteCount);
			const encryptedBytes = this.encrypt(noise, bytes);
			writePreSizedChunk(outputFile, encryptedBytes);
		}
		writePreSizedChunk(outputFile, Buffer.alloc(0));
		fs.closeSync(sourceFile);
		fs.closeSync(outputFile);
	}

	decryptFile(sourceFilePath: string, destinationFolderPath: string) {
		const sourceFile = fs.openSync(sourceFilePath, 'r');
		const noise = Encryption.readNoise(sourceFile);
		const fileName = this.decryptText(noise, readBufferFromFile(sourceFile));
		const destinationFilePath = path.join(destinationFolderPath, fileName);
		const destinationFile = fs.openSync(destinationFilePath, 'w');
		while (true) {
			const encryptedBytes = readPreSizedChunk(sourceFile);
			if (!encryptedBytes.length) break;
			const decryptedBytes = this.decrypt(noise, encryptedBytes);
			fs.writeSync(destinationFile, decryptedBytes, 0, decryptedBytes.length, null);
		}
		fs.closeSync(destinationFile);
		fs.closeSync(sourceFile);
	}

	decryptFileName(sourceFilePath: string): string {
		const sourceFile = fs.openSync(sourceFilePath, 'r');
		const noise = Encryption.readNoise(sourceFile);
		const fileName = this.decryptText(noise, readBufferFromFile(sourceFile));
		fs.closeSync(sourceFile);
		return fileName;
	}

	static readNoise(file: number): Buffer {
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
		this.decrypt(noise, readBufferFromFile(destinationFile));
		let isConsistent = true;
		while (isConsistent) {
			const sourceSize = fs.readSync(sourceFile, sourceBuffer, 0, CHUNK_SIZE, null);
			if (!sourceSize) {
				const lastBuffer = readBufferFromFile(destinationFile);
				if (lastBuffer.length !== 0) isConsistent = false;
				break;
			}
			const sourceBytes = sourceBuffer.subarray(0, sourceSize);
			const encryptedBytes = readPreSizedChunk(destinationFile);
			const decryptedBytes = this.decrypt(noise, encryptedBytes);
			if (sourceBytes.length !== decryptedBytes.length) {
				isConsistent = false;
				break;
			}
			if (sourceBytes.compare(decryptedBytes) !== 0) {
				isConsistent = false;
				break;
			}
		}
		fs.closeSync(sourceFile);
		fs.closeSync(destinationFile);
		return isConsistent;
	}

	encryptText(noise: Uint8Array, name: string): Buffer {
		let data = new TextEncoder().encode(name);
		data = this.encrypt(noise, Buffer.from(data));
		return Buffer.from(data);
	}

	decryptText(noise: Uint8Array, data: Buffer): string {
		const decrypted = this.decrypt(noise, data);
		return new TextDecoder().decode(decrypted);
	}
}
