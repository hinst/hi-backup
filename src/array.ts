export function bufferToArray(buffer: Buffer): Uint8Array {
	return new Uint8Array(
		buffer.buffer,
		buffer.byteOffset,
		buffer.byteLength / Uint8Array.BYTES_PER_ELEMENT
	);
}
