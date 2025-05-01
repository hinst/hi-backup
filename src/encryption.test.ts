import test from 'node:test';
import { decrypt, encrypt } from './encryption';
import assert from 'assert';

test(encrypt.name, function () {
	const password = 'foo';
	const noise = new Uint8Array(new Array(16).fill(0).map((_, i) => i));
	const inputText = 'Hello world';
	const inputData = new TextEncoder().encode(inputText);
	const outputData = encrypt(password, noise, inputData);
	assert.notEqual(new TextDecoder().decode(outputData), inputText);
	assert.equal(new TextDecoder().decode(decrypt(password, noise, outputData)), inputText);
});
