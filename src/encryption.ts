import crypto from 'crypto';

const algorithm = 'aes-256-cbc';

export function encrypt(password: string, noise: Uint8Array, data: Uint8Array) {
	const key = crypto.createHash('sha256').update(password).digest();
	const cipher = crypto.createCipheriv(algorithm, key, noise);
	cipher.update(data);
	const output = cipher.final();
	return new Uint8Array(
		output.buffer,
		output.byteOffset,
		output.byteLength / Uint8Array.BYTES_PER_ELEMENT
	);
}

export function decrypt(password: string, noise: Uint8Array, data: Uint8Array) {
	const key = crypto.createHash('sha256').update(password).digest();
	const decipher = crypto.createDecipheriv(algorithm, key, noise);
	decipher.update(data);
	const output = decipher.final();
	return new Uint8Array(
		output.buffer,
		output.byteOffset,
		output.byteLength / Uint8Array.BYTES_PER_ELEMENT
	);
}
