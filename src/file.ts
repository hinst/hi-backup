import fs from 'fs';
import { INT32_SIZE, int32ToBuffer } from './array';

export const CHUNK_SIZE = 1024 * 1024;
const MAX_CHUNK_SIZE = 100 * 1024 * 1024; // 1GB

export class FileFormatError extends Error {
	constructor(message: string) {
		super(message);
	}
}

function readInt32FromFile(file: number): number {
	const buffer = Buffer.alloc(INT32_SIZE);
	const bytesRead = fs.readSync(file, buffer, 0, INT32_SIZE, null);
	if (bytesRead !== INT32_SIZE)
		throw new FileFormatError('File format error: expected ' + INT32_SIZE + ' bytes');
	return buffer.readInt32LE(0);
}

function writeInt32ToFile(file: number, value: number): void {
	const buffer = int32ToBuffer(value);
	fs.writeSync(file, buffer, 0, INT32_SIZE, null);
}

export function writePreSizedChunk(file: number, data: Buffer) {
	if (data.length > MAX_CHUNK_SIZE)
		throw new FileFormatError('Chunk is too large: ' + data.length);
	writeInt32ToFile(file, data.length);
	fs.writeSync(file, data, 0, data.length, null);
}

export function readPreSizedChunk(file: number): Buffer {
	const chunkSize = readInt32FromFile(file);
	if (chunkSize < 0) throw new FileFormatError('Negative chunk size: ' + chunkSize);
	if (chunkSize > MAX_CHUNK_SIZE)
		throw new FileFormatError('Chunk size is too large: ' + chunkSize);
	const buffer = Buffer.alloc(chunkSize);
	const chunkSizeActual = fs.readSync(file, buffer, 0, chunkSize, null);
	if (chunkSizeActual !== chunkSize)
		throw new FileFormatError(
			'File format error: expected ' + chunkSize + ' bytes, got ' + chunkSizeActual
		);
	return buffer.subarray(0, chunkSize);
}
