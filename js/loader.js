class Loader {
  static fetchData(urls) {
    this.promises = {};
    this.urls = new Map();
    urls.forEach(url => {
      const fileName = this.getName(url);
      this.urls.set(fileName, url);

      if (!this.promises[fileName])
        this.promises[fileName] = new Loader(url);
      else
        throw new Error(`"${fileName}" already registered!`);
    });

    this.contentLoaded = new Promise(resolve => {
      this.resolveContentLoaded = resolve;
    });
  }
  constructor(url, noCache) {
    this._json = (async () => {
      try {
        const response = await fetch(`${url}?nocache=${noCache || new Date().toISOString().split('T')[0]}`);
        return await response.json();
      } catch (err) {
        throw new Error(`Failed to load: ${url}\n${err}`);
      }
    })();
  }
  execute(...args) {
    const json = this._json;
    delete this._json;
    return json.then(...args);
  }
  static reloadData(name) {
    delete this.promises[name];
    const url = this.urls.get(name);
    this.promises[name] = new Loader(url, Date.now());
  }
  static getName(url) {
    return url.split('/').pop().split('.', 1)[0];
  }
}

const jsonFiles = [
  'data/targets.json',
];

Loader.fetchData(jsonFiles);
