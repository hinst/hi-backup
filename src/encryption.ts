import crypto from 'crypto';
import fs from 'fs';
import { bufferToArray } from './array';

const encryptionAlgorithm = 'aes-256-cbc';
const hashingAlgorithm = 'sha256';
const chunkSize = 1024 * 1024;

export function encrypt(password: string, noise: Uint8Array, data: Uint8Array) {
	const key = crypto.createHash(hashingAlgorithm).update(password).digest();
	const cipher = crypto.createCipheriv(encryptionAlgorithm, key, noise);
	cipher.update(data);
	const output = cipher.final();
	return bufferToArray(output);
}

export function decrypt(password: string, noise: Uint8Array, data: Uint8Array) {
	const key = crypto.createHash(hashingAlgorithm).update(password).digest();
	const decipher = crypto.createDecipheriv(encryptionAlgorithm, key, noise);
	decipher.update(data);
	const output = decipher.final();
	return bufferToArray(output);
}

export async function encryptFile(
	password: string,
	sourceFilePath: string,
	destinationFilePath: string
) {
	const sourceFile = fs.openSync(sourceFilePath, 'r');
	const buffer = Buffer.alloc(chunkSize);
	const noise = crypto.randomBytes(16);
	const outputStream = fs.createWriteStream(destinationFilePath);
	outputStream.write(noise);
	while (true) {
		const byteCount = fs.readSync(sourceFile, buffer, 0, chunkSize, null);
		if (!byteCount) break;
		const bytes = bufferToArray(buffer.subarray(0, byteCount));
		const encryptedBytes = encrypt(password, noise, bytes);
		outputStream.write(encryptedBytes);
	}
	fs.closeSync(sourceFile);
	outputStream.close();
}
