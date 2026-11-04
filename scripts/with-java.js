#!/usr/bin/env node
/**
 * Runs a command with a JDK 17+ in `JAVA_HOME`.
 *
 * Gradle 8 / AGP refuse anything older, and a stale machine-wide `JAVA_HOME`
 * (a Java 8 directory, or the `bin` folder itself) otherwise fails every
 * `expo run:android` with "JAVA_HOME is set to an invalid directory".
 *
 * Resolution order, first hit that is a real JDK 17+ wins:
 *   1. `BIM_JAVA_HOME` (explicit override)
 *   2. the ambient `JAVA_HOME`
 *   3. Android Studio's bundled JBR
 *   4. an installed JDK (Adoptium, Microsoft, /usr/lib/jvm, …)
 *   5. the `java` on PATH, resolved back to its home
 *
 * Usage: node ./scripts/with-java.js [--print] <command> [args…]
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MIN_MAJOR = 17;
const isWindows = process.platform === 'win32';
const javaBin = isWindows ? 'java.exe' : 'java';

/** The directory if it holds a JDK, accepting a `bin` folder by mistake. */
function javaHomeOf(dir) {
	if (!dir) return null;
	let candidate;
	try {
		candidate = path.resolve(dir);
	} catch {
		return null;
	}
	if (path.basename(candidate).toLowerCase() === 'bin') {
		candidate = path.dirname(candidate);
	}
	return fs.existsSync(path.join(candidate, 'bin', javaBin)) ? candidate : null;
}

/** Feature release of a JDK, e.g. `1.8.0_321` → 8, `25.0.4` → 25. */
function javaMajor(home) {
	const result = spawnSync(path.join(home, 'bin', javaBin), ['-version'], {
		encoding: 'utf8',
	});
	const output = `${result.stderr ?? ''}${result.stdout ?? ''}`;
	const match = output.match(/version "(\d+)(?:\.(\d+))?/);
	if (!match) return null;
	const major = Number(match[1]);
	return major === 1 ? Number(match[2]) : major;
}

function readDir(dir) {
	try {
		return fs.readdirSync(dir);
	} catch {
		return [];
	}
}

/** Directories that hold a JDK, in the order we would prefer them. */
function candidateHomes() {
	const homes = [process.env.BIM_JAVA_HOME, process.env.JAVA_HOME];

	if (isWindows) {
		const programFiles = process.env.ProgramFiles ?? 'C:\\Program Files';
		homes.push(
			path.join(programFiles, 'Android', 'Android Studio', 'jbr'),
			path.join(programFiles, 'Android', 'Android Studio Preview', 'jbr'),
			process.env.JAVA_HOME_17_X64
		);
		for (const vendor of ['Eclipse Adoptium', 'Java', 'Microsoft', 'Amazon Corretto', 'Zulu']) {
			for (const entry of readDir(path.join(programFiles, vendor))) {
				homes.push(path.join(programFiles, vendor, entry));
			}
		}
	} else if (process.platform === 'darwin') {
		homes.push('/Applications/Android Studio.app/Contents/jbr/Contents/Home');
		for (const entry of readDir('/Library/Java/JavaVirtualMachines')) {
			homes.push(path.join('/Library/Java/JavaVirtualMachines', entry, 'Contents', 'Home'));
		}
	} else {
		for (const entry of readDir('/usr/lib/jvm')) {
			homes.push(path.join('/usr/lib/jvm', entry));
		}
		homes.push('/opt/android-studio/jbr', '/snap/android-studio/current/android-studio/jbr');
	}

	// Whatever is already on PATH — derived from `<home>/bin/java`.
	const which = spawnSync(isWindows ? 'where' : 'which', ['java'], {
		encoding: 'utf8',
	});
	const onPath = (which.stdout ?? '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean)[0];
	if (onPath) homes.push(path.dirname(path.dirname(onPath)));

	return homes.filter(Boolean);
}

/** Best JDK 17+, plus the newest working JDK for the "too old" message. */
function resolveJavaHome() {
	let newest = null;

	for (const raw of candidateHomes()) {
		const home = javaHomeOf(raw);
		if (!home) continue;

		const major = javaMajor(home);
		if (!major) continue;

		if (major >= MIN_MAJOR) return { home, major };
		if (!newest || major > newest.major) newest = { home, major };
	}

	return { home: null, major: null, newest };
}

const [first, ...rest] = process.argv.slice(2);
const printOnly = first === '--print';
const command = printOnly ? null : first;

if (!command && !printOnly) {
	console.error('usage: node ./scripts/with-java.js <command> [args…]');
	process.exit(1);
}

const { home, major, newest } = resolveJavaHome();
const ambient = process.env.JAVA_HOME;
const ambientIsValid = Boolean(javaHomeOf(ambient));

if (!ambientIsValid && ambient) {
	console.warn(`[with-java] ignoring JAVA_HOME=${ambient} — no bin/${javaBin} there`);
}

if (!home) {
	const detail = newest
		? `the newest JDK found is ${newest.major} at ${newest.home}`
		: 'no JDK was found';
	console.error(
		`[with-java] need a JDK ${MIN_MAJOR}+ for Gradle, but ${detail}.\n` +
			'Install Android Studio (its bundled JBR is enough) or a JDK 17+, then\n' +
			'set JAVA_HOME to that folder and reopen the terminal.'
	);
	if (printOnly) process.exit(1);
	// Let the command run anyway: iOS builds do not need Java.
	process.exitCode = run(process.env.JAVA_HOME);
} else {
	if (home !== ambient) {
		console.log(`[with-java] JAVA_HOME=${home} (Java ${major})`);
	}
	if (printOnly) process.exit(0);
	process.exitCode = run(home);
}

function run(javaHome) {
	const env = { ...process.env };
	if (javaHome) env.JAVA_HOME = javaHome;
	else delete env.JAVA_HOME;

	// `expo`, `npx`, … are `.cmd` shims on Windows, so the command has to go
	// through a shell — build the line ourselves to keep arguments intact.
	const commandLine = [command, ...rest].map(quoteForShell).join(' ');
	const result = spawnSync(commandLine, {
		stdio: 'inherit',
		env,
		shell: true,
	});
	if (result.error) {
		console.error(`[with-java] could not run ${command}:`, result.error.message);
		return 1;
	}
	return result.status ?? 1;
}

/** Minimal quoting so paths and flags survive the shell. */
function quoteForShell(value) {
	if (isWindows) {
		if (!/[\s"^&|<>()%!]/.test(value)) return value;
		return `"${value.replace(/"/g, '\\"')}"`;
	}
	if (!/[\s"'$`\\!*?[\]{}()<>|&;#~]/.test(value)) return value;
	return `'${value.replace(/'/g, `'\\''`)}'`;
}
