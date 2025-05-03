import test from 'node:test';
import assert from 'assert';
import { Encryption } from './encryption';

test(Encryption.prototype.encrypt.name, function () {
	const password = 'foo';
	const noise = Encryption.createNoise();
	const inputText = 'Hello world';
	const inputData = new TextEncoder().encode(inputText);
	const outputData = new Encryption(password).encrypt(noise, inputData);
	assert.notEqual(new TextDecoder().decode(outputData), inputText);
	assert.equal(
		new TextDecoder().decode(new Encryption(password).decrypt(noise, outputData)),
		inputText
	);
});

test(Encryption.prototype.encryptFile.name, function () {
	const password = 'file';
	const noise = Encryption.createNoise();
	const filePath = 'test/SamplePNGImage_3mb.png';
	const encryptedFilePath = 'test/SamplePNGImage_3mb.png.enc';
	new Encryption(password).encryptFile(filePath, encryptedFilePath);
});
