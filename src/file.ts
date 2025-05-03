import fs from 'fs';
import { INT32_SIZE, int32ToBuffer } from './array';

export const CHUNK_SIZE = 1024 * 1024;

export function writePreSizedChunk(file: number, data: Buffer) {
	const sizeBuffer = int32ToBuffer(data.length);
	fs.writeSync(file, sizeBuffer, 0, sizeBuffer.length, null);
	fs.writeSync(file, data, 0, data.length, null);
}

export function readPreSizedChunk(file: number): Buffer | undefined {
	const buffer = Buffer.alloc(CHUNK_SIZE * 2);
	const chunkSizeLength = fs.readSync(file, buffer, 0, INT32_SIZE, null);
	if (chunkSizeLength !== INT32_SIZE) return undefined;
	const chunkSize = buffer.readInt32LE(0);
	if (chunkSize < 0 || buffer.length < chunkSize) return undefined;
	const chunkSizeActual = fs.readSync(file, buffer, 0, chunkSize, null);
	if (chunkSizeActual !== chunkSize) return undefined;
	return buffer.subarray(0, chunkSize);
}
