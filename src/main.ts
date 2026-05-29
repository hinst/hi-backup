import 'source-map-support/register';
import fs from 'node:fs';
import process from 'node:process';
import { password as enterPassword } from '@inquirer/prompts';
import chalk from 'chalk';
import { EncryptionTransformer as EncryptionFileTransformer } from 'src/files/transformers/encryptionTransformer';
import { GzipFileTransformer } from 'src/files/transformers/gzipFileTransformer';
import { FolderHasher } from 'src/folderHasher';
import { FolderSync } from 'src/folderSync';
import { FOLDER_SYNC_COMMANDS, TaskCommand, TaskConfig } from 'src/taskConfig';
import { getFolderSize } from './folderStats';

class App {
	password: string = '';

	async run() {
		const configFilePath = process.argv[2];
		if (!configFilePath?.length)
			return console.warn('Please provide config file path as command line argument');
		console.log('Using config: ' + configFilePath);
		const taskConfigs: TaskConfig[] = JSON.parse(fs.readFileSync(configFilePath).toString());
		if (!taskConfigs?.length) return console.warn('There are no tasks');
		await this.prepareTasks(taskConfigs);
		for (let i = 0; i < taskConfigs.length; ++i) {
			const taskConfig = Object.assign(TaskConfig.createUndefined(), taskConfigs[i]);
			console.log('[' + i + '] ' + taskConfig.toColoredString());
			const completionText = chalk.bold('DONE') + ' ' + taskConfig.toColoredString();
			const targetSizeBefore = fs.existsSync(taskConfig.targetPath)
				? getFolderSize(taskConfig.targetPath)
				: 0;
			console.time(completionText);
			await this.runTask(taskConfig);
			console.timeEnd(completionText);
			console.log(taskConfig.formatSizeReport(targetSizeBefore));
			const isLastTask = i === taskConfigs.length - 1;
			if (!isLastTask) console.log();
		}
	}

	private async prepareTasks(taskConfigs: TaskConfig[]) {
		const encryptExists = taskConfigs.some((item) => item.command === TaskCommand.ENCRYPT);
		if (encryptExists) {
			this.password = await enterPassword({
				message: ' Enter password for encrypted backups:',
				mask: '*',
			});
			if (!this.password.length)
				throw new Error(
					'Password is required. Empty password is not allowed because it defies the purpose of encryption. You can use COMPRESS or MIRROR mode instead',
				);
			const confirmedPassword = await enterPassword({
				message: 'Repeat password for encrypted backups:',
				mask: '*',
			});
			if (this.password !== confirmedPassword) throw new Error('Passwords must be equal');
		}
	}

	private async runTask(taskConfig: TaskConfig) {
		if (TaskCommand.CHECK_HASH === taskConfig.command) {
			await new FolderHasher(taskConfig.targetPath).fullCheck();
			return;
		}
		if (FOLDER_SYNC_COMMANDS.includes(taskConfig.command)) {
			const folderSync = new FolderSync(taskConfig.sourcePath, taskConfig.targetPath);
			if (taskConfig.command === TaskCommand.COMPRESS)
				folderSync.fileTransformer = new GzipFileTransformer();
			if (taskConfig.command === TaskCommand.ENCRYPT)
				folderSync.fileTransformer = new EncryptionFileTransformer(this.password);
			folderSync.ignoredList = taskConfig.ignoredList;
			await folderSync.run();
			console.log(folderSync.stats);
			return;
		}
		throw new Error('Unknown command: ' + taskConfig.command);
	}
}

const _ = new App().run();
