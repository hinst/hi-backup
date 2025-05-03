import test from 'node:test';
import assert from 'assert';
import fs from 'fs';
import { Encryption } from './encryption';
import { changeRandomByte, FileFormatError } from './file';

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
		try {
			return new Encryption(password).compareFileWithEncrypted(plain, encrypted);
		} catch (e) {
			if (e instanceof FileFormatError) {
				return false;
			}
			throw e;
		}
	}
	assert.equal(compare(filePath, encryptedFilePath), true);
	assert.equal(compare(otherFilePath, encryptedFilePath), false);
	assert.equal(compare(filePath, filePath), false);
	assert.equal(compare(otherFilePath, otherFilePath), false);
	changeRandomByte(encryptedFilePath);
	assert.equal(compare(filePath, encryptedFilePath), false);
	fs.unlinkSync(encryptedFilePath);
});

test(Encryption.prototype.encryptText.name, function () {
	const password = 'fileNamePassword';
	const fileName = 'secret file.txt';
	const noise = Encryption.createNoise();
	const encryptedFileName = new Encryption(password).encryptText(noise, fileName);
	const decryptedFileName = new Encryption(password).decryptText(noise, encryptedFileName);
	assert.equal(decryptedFileName, fileName);
});

test(Encryption.prototype.encryptFolder.name, function () {
	const password = 'secretPassword';
	new Encryption(password).encryptFolder('./dist', './test/dist.1');
});
