import test from 'node:test';
import assert from 'assert';
import fs from 'fs';
import { Encryption } from './encryption';

test(Encryption.prototype.encrypt.name, function () {
	const password = 'foo';
	const noise = Encryption.createNoise();
	const inputText = 'Hello world';
	const inputData = new TextEncoder().encode(inputText);
	const outputData = new Encryption(password).encrypt(noise, Buffer.from(inputData));
	assert.notEqual(new TextDecoder().decode(outputData), inputText);
	assert.equal(
		new TextDecoder().decode(new Encryption(password).decrypt(noise, outputData)),
		inputText
	);
});

test(Encryption.prototype.encryptFile.name, function () {
	const password = 'file';
	const filePath = 'test/SamplePNGImage_3mb.png';
	const otherFilePath = 'test/text.txt';
	const encryptedFilePath = 'test/SamplePNGImage_3mb.1';
	new Encryption(password).encryptFile(filePath, encryptedFilePath);
	function compare(plain: string, encrypted: string) {
		return new Encryption(password).compareFileWithEncrypted(plain, encrypted);
	}
	assert.equal(compare(filePath, encryptedFilePath), true);
	assert.equal(compare(otherFilePath, encryptedFilePath), false);
	assert.equal(compare(filePath, filePath), false);
	assert.equal(compare(otherFilePath, otherFilePath), false);
	fs.unlinkSync(encryptedFilePath);
});
