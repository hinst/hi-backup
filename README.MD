# hi-backup

Features:
* Directory mirroring
* Encryption
	* Encrypting file names and contents
	* Using the built-in encryption aes-256-cbc
* Compression
	* Using built-in zlib
* Only changed files are copied, saving SSD and memory card lifespan
* Programming language: TypeScript
* Runtime: Node.js 22

Build:
* `npm run build`

Usage:
* Prepare .env file with parameters:
	* `source=directory`
	* `destination=directory`
	* `password=...`
	* Optional: `ignoredList=["file1", "file2"]` these files in source root will be ignored
	* Unpack the encrypted directory:
		* `unpack=true`
		* For unpacking, the old `destination` becomes `source`, so remember to swap those parameters
* Launch: `node --env-file=your-config.env dist/main.js`