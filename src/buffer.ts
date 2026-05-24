export const INT32_SIZE = 4;

export function int32ToBuffer(x: number): Buffer {
	const buffer = Buffer.alloc(INT32_SIZE);
	buffer.writeInt32LE(x, 0);
	return buffer;
}
