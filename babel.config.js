module.exports = function (api) {
    api.cache(true);
    return {
        presets: ['babel-preset-expo'],
        // Removed `react-native-dotenv` plugin because it can conflict with
        // recent Expo SDKs / expo-router and cause the Expo welcome screen
        // to appear in development. Use Expo's built-in environment support
        // or `dotenv` in scripts instead.
        plugins: [],
    };
};
