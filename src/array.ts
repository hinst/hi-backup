export const INT32_SIZE = 4;

export function bufferToArray(buffer: Buffer): Uint8Array {
	return new Uint8Array(
		buffer.buffer,
		buffer.byteOffset,
		buffer.byteLength / Uint8Array.BYTES_PER_ELEMENT
	);
}

export function int32ToBuffer(x: number): Buffer {
	const buffer = Buffer.alloc(INT32_SIZE);
	buffer.writeInt32LE(x, 0);
	return buffer;
}
