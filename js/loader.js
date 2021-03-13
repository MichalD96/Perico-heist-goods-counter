class Loader {
  static promises = {};
  static urls = new Set();
  static fetchProperties = { method: 'GET', cache: 'no-cache' };

  static fetchData(urls) {
    urls.forEach(url => {
      this.urls.add(url);
      const fileName = this.getName(url);

      if (!this.promises[fileName])
        this.promises[fileName] = new Loader(url);
      else
        throw new Error(`"${fileName}" already registered!`);
    });

    this.contentLoaded = new Promise(resolve => this.resolveContentLoaded = resolve);
  }
  constructor(url, noCache = null) {
    this._json = (async () => {
      try {
        const response = await fetch(url, noCache || Loader.fetchProperties);
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
    const url = this.urls.find(url => this.getName(url) === name);
    this.promises[name] = new Loader(url, { cache: 'no-cache' });
  }
  static set fetchOptions(obj) {
    this.fetchProperties = Object.assign(this.fetchProperties, obj);
  }
  static getName(url) {
    return url.split('/').pop().split('.', 1)[0];
  }
}

const jsonFiles = [
  'data/targets.json',
];

Loader.fetchData(jsonFiles);
