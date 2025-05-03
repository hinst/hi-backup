import test from 'node:test';
import { Encryption } from './encryption';
import assert from 'assert';

test(Encryption.prototype.encrypt.name, function () {
	const password = 'foo';
	const noise = new Uint8Array(new Array(16).fill(0).map((_, i) => i));
	const inputText = 'Hello world';
	const inputData = new TextEncoder().encode(inputText);
	const outputData = new Encryption(password).encrypt(noise, inputData);
	assert.notEqual(new TextDecoder().decode(outputData), inputText);
	assert.equal(
		new TextDecoder().decode(new Encryption(password).decrypt(noise, outputData)),
		inputText
	);
});
