let _ready = false;
// eslint-disable-next-line @typescript-eslint/array-type
let _callbacks: Array<() => void> = [];

export function onAppReady(cb: () => void) {
	if (_ready) {
		// call on next tick if already ready
		setTimeout(cb, 0);
		return () => { };
	}
	_callbacks.push(cb);
	return () => {
		_callbacks = _callbacks.filter((c) => c !== cb);
	};
}

export function signalAppReady() {
	if (_ready) return;
	_ready = true;
	try {
		_callbacks.forEach((c) => c());
	} finally {
		_callbacks = [];
	}
}

export function isAppReady() {
	return _ready;
}

export default {
	onAppReady,
	signalAppReady,
	isAppReady,
};
