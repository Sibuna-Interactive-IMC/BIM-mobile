// Minimal shim for expo-asset used in Storybook web preview.
// Provides Asset.fromModule(...).downloadAsync() and a default export with useful helpers.
export default class Asset {
  constructor({ localUri = '', uri = '' } = {}) {
    this.localUri = localUri;
    this.uri = uri;
  }

  static fromModule(module) {
    // module may be a number (metro asset) or an object with uri
    if (typeof module === 'object' && module != null) {
      return new Asset({ uri: module.uri || module.localUri || '' });
    }
    return new Asset({ uri: String(module || '') });
  }

  static async loadAsync(module) {
    const asset = Asset.fromModule(module);
    // no-op on web; assume assets are available via the bundler
    return asset;
  }

  async downloadAsync() {
    // no-op for storybook; return the object to match API
    return { localUri: this.localUri || this.uri || '' };
  }
}

export function ensureAssetsAreLoadedAsync() {
  return Promise.resolve();
}
