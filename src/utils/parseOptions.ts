import {
	InputOptions,
	OutputOptions,
	WarningHandler,
	WarningHandlerWithDefault
} from '../rollup/types';

export interface GenericConfigObject {
	[key: string]: unknown;
}

export interface CommandConfigObject {
	external: string[];
	globals: { [id: string]: string } | undefined;
	[key: string]: unknown;
}

const createGetOption = (config: GenericConfigObject, overrides: GenericConfigObject) => (
	name: string,
	defaultValue?: unknown
): any =>
	overrides[name] !== undefined
		? overrides[name]
		: config[name] !== undefined
		? config[name]
		: defaultValue;

const normalizeObjectOptionValue = (optionValue: any) => {
	if (!optionValue) {
		return optionValue;
	}
	if (typeof optionValue !== 'object') {
		return {};
	}
	return optionValue;
};

const getObjectOption = (
	config: GenericConfigObject,
	overrides: GenericConfigObject,
	name: string
) => {
	const commandOption = normalizeObjectOptionValue(overrides[name]);
	const configOption = normalizeObjectOptionValue(config[name]);
	if (commandOption !== undefined) {
		return commandOption && { ...configOption, ...commandOption };
	}
	return configOption;
};

export function ensureArray<T>(items: (T | null | undefined)[] | T | null | undefined): T[] {
	if (Array.isArray(items)) {
		return items.filter(Boolean) as T[];
	}
	if (items) {
		return [items];
	}
	return [];
}

const defaultOnWarn: WarningHandler = warning => {
	if (typeof warning === 'string') {
		console.warn(warning);
	} else {
		console.warn(warning.message);
	}
};

const getOnWarn = (
	config: GenericConfigObject,
	defaultOnWarnHandler: WarningHandler
): WarningHandler =>
	config.onwarn
		? warning => (config.onwarn as WarningHandlerWithDefault)(warning, defaultOnWarnHandler)
		: defaultOnWarnHandler;

const getExternal = (config: GenericConfigObject, overrides: CommandConfigObject) => {
	const configExternal = config.external;
	return typeof configExternal === 'function'
		? (id: string, ...rest: string[]) =>
				configExternal(id, ...rest) || overrides.external.indexOf(id) !== -1
		: (typeof config.external === 'string'
				? [configExternal]
				: Array.isArray(configExternal)
				? configExternal
				: []
		  ).concat(overrides.external);
};

export function parseInputOptions(
	config: GenericConfigObject,
	overrides: CommandConfigObject = { external: [], globals: undefined },
	defaultOnWarnHandler: WarningHandler = defaultOnWarn
): InputOptions {
	const getOption = createGetOption(config, overrides);
	const inputOptions: InputOptions = {
		acorn: config.acorn,
		acornInjectPlugins: config.acornInjectPlugins as any,
		cache: getOption('cache'),
		chunkGroupingSize: getOption('chunkGroupingSize', 5000),
		context: getOption('context'),
		experimentalCacheExpiry: getOption('experimentalCacheExpiry', 10),
		experimentalOptimizeChunks: getOption('experimentalOptimizeChunks'),
		external: getExternal(config, overrides) as any,
		inlineDynamicImports: getOption('inlineDynamicImports', false),
		input: getOption('input', []),
		manualChunks: getOption('manualChunks'),
		moduleContext: config.moduleContext as any,
		onwarn: getOnWarn(config, defaultOnWarnHandler),
		perf: getOption('perf', false),
		plugins: ensureArray(config.plugins as any),
		preserveModules: getOption('preserveModules'),
		preserveSymlinks: getOption('preserveSymlinks'),
		shimMissingExports: getOption('shimMissingExports'),
		strictDeprecations: getOption('strictDeprecations', false),
		treeshake: getObjectOption(config, overrides, 'treeshake'),
		watch: config.watch as any
	};

	// support rollup({ cache: prevBuildObject })
	if (inputOptions.cache && (inputOptions.cache as any).cache)
		inputOptions.cache = (inputOptions.cache as any).cache;

	warnUnknownOptions(
		config,
		Object.keys(inputOptions),
		'input options',
		inputOptions.onwarn as WarningHandler,
		/^output$/
	);
	return inputOptions;
}

export function parseOutputOptions(
	config: GenericConfigObject,
	warn: WarningHandler,
	overrides: GenericConfigObject = {}
): OutputOptions {
	const getOption = createGetOption(config, overrides);
	let format = getOption('format');

	// Handle format aliases
	switch (format) {
		case undefined:
		case 'esm':
		case 'module':
			format = 'es';
			break;
		case 'commonjs':
			format = 'cjs';
	}
	const outputOptions = {
		amd: { ...(config.amd as object), ...(overrides.amd as object) } as any,
		assetFileNames: getOption('assetFileNames'),
		banner: getOption('banner'),
		chunkFileNames: getOption('chunkFileNames'),
		compact: getOption('compact', false),
		dir: getOption('dir'),
		dynamicImportFunction: getOption('dynamicImportFunction'),
		entryFileNames: getOption('entryFileNames'),
		esModule: getOption('esModule', true),
		exports: getOption('exports'),
		extend: getOption('extend'),
		externalLiveBindings: getOption('externalLiveBindings', true),
		file: getOption('file'),
		footer: getOption('footer'),
		format,
		freeze: getOption('freeze', true),
		globals: getOption('globals'),
		hoistTransitiveImports: getOption('hoistTransitiveImports', true), indent: getOption('indent', true),
		interop: getOption('interop', true),
		intro: getOption('intro'),
		name: getOption('name'),
		namespaceToStringTag: getOption('namespaceToStringTag', false),
		noConflict: getOption('noConflict'),
		outro: getOption('outro'),
		paths: getOption('paths'),
		plugins: ensureArray(config.plugins as any),
		preferConst: getOption('preferConst'),
		sourcemap: getOption('sourcemap'),
		sourcemapExcludeSources: getOption('sourcemapExcludeSources'),
		sourcemapFile: getOption('sourcemapFile'),
		sourcemapPathTransform: getOption('sourcemapPathTransform'),
		strict: getOption('strict', true)
	};

	warnUnknownOptions(config, Object.keys(outputOptions), 'output options', warn);
	return outputOptions;
}

export function warnUnknownOptions(
	passedOptions: GenericConfigObject,
	validOptions: string[],
	optionType: string,
	warn: WarningHandler,
	ignoredKeys: RegExp = /$./
): void {
	const validOptionSet = new Set(validOptions);
	const unknownOptions = Object.keys(passedOptions).filter(
		key => !(validOptionSet.has(key) || ignoredKeys.test(key))
	);
	if (unknownOptions.length > 0) {
		warn({
			code: 'UNKNOWN_OPTION',
			message: `Unknown ${optionType}: ${unknownOptions.join(', ')}. Allowed options: ${Array.from(
				validOptionSet
			)
				.sort()
				.join(', ')}`
		});
	}
}