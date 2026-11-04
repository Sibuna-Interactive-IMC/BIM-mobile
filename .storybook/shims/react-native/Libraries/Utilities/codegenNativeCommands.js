// Minimal stub for react-native's codegenNativeCommands used by some RN libraries
export default function codegenNativeCommands(spec) {
    // Return a small Commands object that maps supportedCommands to noop functions
    const cmds = {};
    try {
        const supported = spec && spec.supportedCommands ? spec.supportedCommands : [];
        supported.forEach((name) => {
            cmds[name] = () => { };
        });
    } catch (_e) {
        // ignore
    }
    return cmds;
}
