import fs from 'fs';
import { bufferToArray, INT32_SIZE, int32ToBuffer } from './array';

export const CHUNK_SIZE = 1024 * 1024;

export function writePreSizedChunk(outputStream: fs.WriteStream, data: Uint8Array) {
	outputStream.write(int32ToBuffer(data.length));
	outputStream.write(data);
}

export function readPreSizedChunk(file: number): Uint8Array | undefined {
	const buffer = Buffer.alloc(CHUNK_SIZE);
	const chunkSizeLength = fs.readSync(file, buffer, 0, INT32_SIZE, null);
	if (chunkSizeLength !== INT32_SIZE) return undefined;
	const chunkSize = buffer.readInt32LE(0);
	if (chunkSize < 0 || CHUNK_SIZE < chunkSize) return undefined;
	const chunkSizeActual = fs.readSync(file, buffer, 0, chunkSize, null);
	if (chunkSizeActual !== chunkSize) return undefined;
	return bufferToArray(buffer.subarray(0, chunkSize));
}
