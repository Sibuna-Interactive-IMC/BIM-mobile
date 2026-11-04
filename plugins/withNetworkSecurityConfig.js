// plugins/withNetworkSecurityConfig.js
const { withAndroidManifest } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/** Copies `source` to `dest`, creating the folder, when `source` exists. */
function copyIfPresent(source, dest) {
    if (!fs.existsSync(source)) return;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(source, dest);
}

module.exports = function withNetworkSecurityConfig(config) {
    return withAndroidManifest(config, async (config) => {
        const manifest = config.modResults.manifest;
        const app = manifest.application?.[0]?.$;
        if (app) {
            app['android:networkSecurityConfig'] = '@xml/network_security_config';
        }
        const projectRoot = config.modRequest.projectRoot;
        const resXml = path.join(
            projectRoot,
            'android/app/src/main/res/xml/network_security_config.xml'
        );
        if (!fs.existsSync(resXml)) {
            copyIfPresent(
                path.join(projectRoot, 'network_security_config.xml'),
                resXml
            );
        }
        // Debug builds override the same resource with a permissive config, so
        // a LAN backend can use any address without listing it here.
        copyIfPresent(
            path.join(projectRoot, 'network_security_config.debug.xml'),
            path.join(
                projectRoot,
                'android/app/src/debug/res/xml/network_security_config.xml'
            )
        );
        return config;
    });
};