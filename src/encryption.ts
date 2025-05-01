import crypto from 'crypto';
import fs from 'fs';
import { bufferToArray } from './array';
import { CHUNK_SIZE, readPreSizedChunk, writePreSizedChunk } from './file';

const ENCRYPTION_ALGORITHM = 'aes-256-cbc';
const HASHING_ALGORITHM = 'sha256';
const NOISE_SIZE = 16;

export function encrypt(password: string, noise: Uint8Array, data: Uint8Array) {
	const key = crypto.createHash(HASHING_ALGORITHM).update(password).digest();
	const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, noise);
	cipher.update(data);
	const output = cipher.final();
	return bufferToArray(output);
}

export function decrypt(password: string, noise: Uint8Array, data: Uint8Array) {
	const key = crypto.createHash(HASHING_ALGORITHM).update(password).digest();
	const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, noise);
	decipher.update(data);
	const output = decipher.final();
	return bufferToArray(output);
}

export function encryptFile(password: string, sourceFilePath: string, destinationFilePath: string) {
	const sourceFile = fs.openSync(sourceFilePath, 'r');
	const buffer = Buffer.alloc(CHUNK_SIZE);
	const noise = crypto.randomBytes(NOISE_SIZE);
	const outputStream = fs.createWriteStream(destinationFilePath);
	outputStream.write(noise);
	while (true) {
		const byteCount = fs.readSync(sourceFile, buffer, 0, CHUNK_SIZE, null);
		if (!byteCount) break;
		const bytes = bufferToArray(buffer.subarray(0, byteCount));
		const encryptedBytes = encrypt(password, noise, bytes);
		writePreSizedChunk(outputStream, encryptedBytes);
	}
	fs.closeSync(sourceFile);
	outputStream.close();
}

export function compareFileWithEncrypted(
	password: string,
	sourceFilePath: string,
	destinationFilePath: string
): boolean {
	const sourceFile = fs.openSync(sourceFilePath, 'r');
	const destinationFile = fs.openSync(destinationFilePath, 'r');
	const sourceBuffer = Buffer.alloc(CHUNK_SIZE);
	const destinationBuffer = Buffer.alloc(CHUNK_SIZE);
	const noiseSize = fs.readSync(destinationFile, destinationBuffer, 0, NOISE_SIZE, null);
	if (noiseSize !== NOISE_SIZE) {
		throw new Error('Wrong noise from encrypted file');
	}
	const noise = bufferToArray(destinationBuffer.subarray(0, NOISE_SIZE));
	let isConsistent = true;
	while (isConsistent) {
		const sourceSize = fs.readSync(sourceFile, sourceBuffer, 0, CHUNK_SIZE, null);
		if (!sourceSize) {
			const leftoverSize = fs.readSync(destinationFile, destinationBuffer, 0, 1, null);
			if (leftoverSize) isConsistent = false;
			break;
		}
		const sourceBytes = bufferToArray(sourceBuffer.subarray(0, sourceSize));

		const encryptedBytes = readPreSizedChunk(destinationFile);
		if (!encryptedBytes) {
			isConsistent = false;
			break;
		}
		const decryptedBytes = decrypt(password, noise, encryptedBytes);
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
	return !isConsistent;
}
