import 'source-map-support/register';
import fs from 'node:fs';
import process from 'node:process';
import chalk from 'chalk';
import { EncryptionTransformer as EncryptionFileTransformer } from './encryptionTransformer';
import { GzipFileTransformer } from './gzipFileTransfromer';
import { FolderEncryption } from './folderEncryption';
import { FolderHasher } from './folderHasher';
import { FolderSync } from './folderSync';
import { TaskCommand, TaskConfig } from './taskConfig';

async function main() {
	const configFilePath = process.argv[2];
	if (!configFilePath?.length)
		console.log('Please provide config file path as command line argument');
	console.log('Using config: ' + configFilePath);
	const taskConfigs: TaskConfig[] = JSON.parse(fs.readFileSync(configFilePath).toString());
	if (!taskConfigs?.length) console.warn('There are no tasks');
	for (let i = 0; i < taskConfigs.length; ++i) {
		const taskConfig = Object.assign(TaskConfig.createUndefined(), taskConfigs[i]);
		console.log('[' + i + '] ' + taskConfig.toColoredString());
		const completionText = chalk.bold('DONE') + ' ' + taskConfig.toColoredString();
		console.time(completionText);
		await runTask(taskConfig);
		console.timeEnd(completionText);
	}
}

const folderSyncCommands = [TaskCommand.MIRROR, TaskCommand.COMPRESS, TaskCommand.ENCRYPT];

async function runTask(taskConfig: TaskConfig) {
	if (TaskCommand.CHECK_HASH === taskConfig.command) {
		await new FolderHasher(taskConfig.targetPath).fullCheck();
		return;
	}
	if (folderSyncCommands.includes(taskConfig.command)) {
		const mirror = new FolderSync(taskConfig.sourcePath, taskConfig.targetPath);
		if (taskConfig.command === TaskCommand.COMPRESS)
			mirror.fileTransformer = new GzipFileTransformer();
		if (taskConfig.command === TaskCommand.ENCRYPT) {
			if (!taskConfig.password?.length) throw new Error('Need password for encryption');
			mirror.fileTransformer = new EncryptionFileTransformer(taskConfig.password);
		}
		await mirror.run();
		console.log(mirror.stats);
		return;
	}
	throw new Error('Unknown command: ' + taskConfig.command);
}

const _ = main();

function oldMain() {
	function requireEnvironmentString(key: string): string {
		const text = process.env[key];
		if (!text?.length) throw new Error('Required string is missing');
		return text;
	}

	const sourceFolder = requireEnvironmentString('source');
	const destinationFolder = requireEnvironmentString('destination');
	const password = requireEnvironmentString('password');
	const unpack = process.env.unpack === 'true';
	const ignoredList = JSON.parse(process.env.ignoredList || '[]');

	console.log((unpack ? 'Unpacking ' : 'Encrypting ') + sourceFolder + ' -> ' + destinationFolder);
	const folderEncryption = new FolderEncryption(
		password,
		sourceFolder,
		destinationFolder,
		ignoredList,
	);
	console.time('done');
	if (unpack) folderEncryption.unpack();
	else folderEncryption.sync();
	console.log(folderEncryption.stats);
	console.timeEnd('done');
}
