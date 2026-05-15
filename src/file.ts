import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { INT32_SIZE, int32ToBuffer } from './array';

const MAX_BUFFER_SIZE = 100 * 1024 * 1024;

export class FileFormatError extends Error {}

export enum FileKind {
	FILE,
	DIRECTORY,
}

function writeInt32ToFile(file: number, value: number): void {
	const buffer = int32ToBuffer(value);
	fs.writeSync(file, buffer, 0, INT32_SIZE, null);
}

function readInt32FromFile(file: number): number {
	const buffer = Buffer.alloc(INT32_SIZE);
	const bytesRead = fs.readSync(file, buffer, 0, INT32_SIZE, null);
	if (bytesRead !== INT32_SIZE)
		throw new FileFormatError('File format error: expected ' + INT32_SIZE + ' bytes');
	return buffer.readInt32LE(0);
}

export function writeSizedBuffer(file: number, data: Buffer) {
	if (data.length > MAX_BUFFER_SIZE)
		throw new FileFormatError('Chunk is too large: ' + data.length);
	writeInt32ToFile(file, data.length);
	fs.writeSync(file, data, 0, data.length, null);
}

export function readSizedBuffer(file: number): Buffer {
	const chunkSize = readInt32FromFile(file);
	if (chunkSize < 0) throw new FileFormatError('Negative chunk size: ' + chunkSize);
	if (chunkSize > MAX_BUFFER_SIZE)
		throw new FileFormatError('Chunk size is too large: ' + chunkSize);
	const buffer = Buffer.alloc(chunkSize);
	const chunkSizeActual = fs.readSync(file, buffer, 0, chunkSize, null);
	if (chunkSizeActual !== chunkSize)
		throw new FileFormatError(
			'File format error: expected ' + chunkSize + ' bytes, got ' + chunkSizeActual,
		);
	return buffer.subarray(0, chunkSize);
}

function readByteAt(file: number, offset: number): number {
	const buffer = Buffer.alloc(1);
	const bytesRead = fs.readSync(file, buffer, 0, 1, offset);
	if (bytesRead !== 1) throw new Error('Cannot read byte at ' + offset);
	return buffer.readUInt8(0);
}

function writeByteAt(file: number, offset: number, value: number): void {
	const buffer = Buffer.alloc(1);
	buffer.writeUInt8(value, 0);
	const bytesWritten = fs.writeSync(file, buffer, 0, 1, offset);
	if (bytesWritten !== 1) throw new Error('Cannot write byte at ' + offset);
}

export function changeRandomByte(filePath: string) {
	const file = fs.openSync(filePath, 'r+');
	const offset = Math.floor(Math.random() * fs.statSync(filePath).size);
	const originalByte = readByteAt(file, offset);
	let randomByte = Math.floor(Math.random() * 256);
	while (randomByte === originalByte) randomByte = Math.floor(Math.random() * 256);
	writeByteAt(file, offset, randomByte);
	fs.closeSync(file);
}

export function readNextByte(file: number): number | undefined {
	const buffer = Buffer.alloc(1);
	const bytesRead = fs.readSync(file, buffer, 0, 1, null);
	if (bytesRead !== 1) return undefined;
	return buffer.readUInt8(0);
}

export function compareFiles(firstFilePath: string, secondFilePath: string): boolean {
	const CHUNK_SIZE = 1024 * 1024;
	if (!fs.existsSync(secondFilePath)) return false;
	const firstFileInfo = fs.statSync(firstFilePath);
	const secondFileInfo = fs.statSync(secondFilePath);
	if (!firstFileInfo.isFile() || !secondFileInfo.isFile()) return false;
	if (firstFileInfo.size !== secondFileInfo.size) return false;

	const firstFile = fs.openSync(firstFilePath, 'r');
	let secondFile: number | undefined;
	try {
		secondFile = fs.openSync(secondFilePath, 'r');
		const firstBuffer = Buffer.alloc(CHUNK_SIZE);
		const secondBuffer = Buffer.alloc(CHUNK_SIZE);
		while (true) {
			const firstSize = fs.readSync(firstFile, firstBuffer, 0, CHUNK_SIZE, null);
			const secondSize = fs.readSync(secondFile, secondBuffer, 0, CHUNK_SIZE, null);
			if (firstSize !== secondSize) return false;
			if (!firstSize) return true;

			const firstBytes = firstBuffer.subarray(0, firstSize);
			const secondBytes = secondBuffer.subarray(0, secondSize);
			if (firstBytes.compare(secondBytes) !== 0) return false;
		}
	} finally {
		fs.closeSync(firstFile);
		if (secondFile !== undefined) fs.closeSync(secondFile);
	}
}

export function readFileHash(filePath: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('sha256');
		const rs = fs.createReadStream(filePath);
		rs.on('error', reject);
		rs.on('data', (chunk) => hash.update(chunk));
		rs.on('end', () => resolve(hash.digest('hex')));
	});
}

export function normalizeFilePath(path: string): string {
	return path.replaceAll('\\', '/');
}

export function joinFilePath(...paths: string[]): string {
	return normalizeFilePath(path.join(...paths));
}

export function readCountOfFiles(folderPath: string) {
	const files = fs.readdirSync(folderPath, { withFileTypes: true });
	let count = 0;
	for (const file of files) {
		if (file.isFile()) ++count;
		if (file.isDirectory()) count += readCountOfFiles(joinFilePath(file.parentPath, file.name));
	}
	return count;
}
