import crypto from 'crypto';
import fs from 'fs';
import {
	FileFormatError,
	readNextByte,
	readPreSizedChunk,
	readStringFromFile,
	writePreSizedChunk,
	writeStringToFile
} from './file';
import path from 'path';

const CHUNK_SIZE = 1024 * 1024;
const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const HASHING_ALGORITHM = 'sha256';
const NOISE_SIZE = 16;
const SHORT_FILE_NAME_LENGTH = 32;

export class Encryption {
	constructor(private readonly password: string) {}

	private _key?: Buffer;

	private get key(): Buffer {
		if (!this._key) this._key = Encryption.getHash(this.password).digest();
		return this._key;
	}

	static getHash(text: string) {
		return crypto.createHash(HASHING_ALGORITHM).update(text);
	}

	static createNoise() {
		return crypto.randomBytes(NOISE_SIZE);
	}

	static createDefaultNoise() {
		return new Uint8Array(NOISE_SIZE).fill(0);
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

	encryptFile(sourceFilePath: string, destinationFilePath: string) {
		const sourceFile = fs.openSync(sourceFilePath, 'r');
		const buffer = Buffer.alloc(CHUNK_SIZE);
		const outputFile = fs.openSync(destinationFilePath, 'w');
		const noise = Encryption.createNoise();
		fs.writeSync(outputFile, noise, 0, noise.length, null);
		const fileName = path.basename(sourceFilePath);
		writeStringToFile(outputFile, this.encryptFileName(fileName));
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
		readStringFromFile(destinationFile);
		let isConsistent = true;
		while (isConsistent) {
			const sourceSize = fs.readSync(sourceFile, sourceBuffer, 0, CHUNK_SIZE, null);
			if (!sourceSize) {
				const leftoverByte = readNextByte(destinationFile);
				if (leftoverByte !== undefined) isConsistent = false;
				break;
			}
			const sourceBytes = sourceBuffer.subarray(0, sourceSize);

			const encryptedBytes = readPreSizedChunk(destinationFile);
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

	encryptFileName(name: string): string {
		let data = new TextEncoder().encode(name);
		data = this.encrypt(Encryption.createDefaultNoise(), Buffer.from(data));
		return Buffer.from(data).toString('base64');
	}

	decryptFileName(name: string): string {
		const data = Buffer.from(name, 'base64');
		const decrypted = this.decrypt(Encryption.createDefaultNoise(), data);
		return new TextDecoder().decode(decrypted);
	}

	runFolderBackup(sourcePath: string, destinationPath: string) {
		const files = fs.readdirSync(sourcePath);
		const encryptedFileNames = new Set<string>();
		for (const fileName of files) {
			const encryptedFileName = this.encryptFileName(fileName);
			const shortEncryptedName = Encryption.getHash(encryptedFileName)
				.digest('hex')
				.slice(0, SHORT_FILE_NAME_LENGTH);
			if (encryptedFileNames.has(shortEncryptedName))
				throw new Error('Encrypted file name collision: ' + shortEncryptedName);
			encryptedFileNames.add(shortEncryptedName);
		}
	}
}
