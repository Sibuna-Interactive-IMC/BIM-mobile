// Minimal shim for expo-device used only during Storybook web preview.
export const totalMemory = 0;
export async function getDeviceTypeAsync() {
    return 'UNKNOWN';
}
export default {
    totalMemory,
    getDeviceTypeAsync,
};
