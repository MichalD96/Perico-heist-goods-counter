const mainSettingsPrefix = 'main';

const SettingProxy = (function() {

  const _domain = Symbol('domain');
  const _proxyConfig = Symbol('proxyConfig');
  const settingHandler = {
    _checkAndGetSettingConfig: function(proxyConfig, name, errorType) {
      if (!proxyConfig.has(name)) {
        throw new errorType(`"${name}" is not configured as a persisted setting.`);
      } else {
        return proxyConfig.get(name);
      }
    },
    get: function(proxyConfig, name) {
      if (name === _proxyConfig) return proxyConfig;

      const config = settingHandler._checkAndGetSettingConfig(proxyConfig, name, ReferenceError);
      if ('value' in config) return config.value;

      let value = localStorage.getItem(config.settingName);

      if (value === null) {
        value = config.default;
      } else {
        try {
          value = config.type(JSON.parse(value));
        } catch (e) {
          value = config.default;
        }
      }

      value = config.filter(value) ? value : config.default;

      config.value = value;

      return config.value;
    },
    set: function(proxyConfig, name, value) {
      const config = settingHandler._checkAndGetSettingConfig(proxyConfig, name, TypeError);
      if (value === config.default) {
        localStorage.removeItem(config.settingName);
      } else {
        localStorage.setItem(config.settingName, JSON.stringify(value));
      }
      if (!('value' in config) || config.value !== value) {
        const resolved = Promise.resolve();
        config.listeners.forEach(callback => resolved.then(callback));
      }
      config.value = value;
      return true;
    },
  };

  return {
    createSettingProxy: function(domain) {
      return new Proxy(new Map([
        [_domain, domain],
      ]), settingHandler);
    },
    addSetting: function(settingProxy, name, config = {}) {
      const proxyConfig = settingProxy[_proxyConfig];
      if (proxyConfig.has(name)) {
        throw new TypeError(`A setting was already registered as ${name}.`);
      }
      config = Object.assign(Object.create(null), config);
      delete config.value;
      config.listeners = [];
      if (!('default' in config)) {
        config.default = 'type' in config ? config.type() : false;
      }
      if (!('type' in config)) {
        const defaultType = typeof config.default;
        const basicTypes = {
          'boolean': Boolean,
          'string': String,
          'number': Number,
        };
        config.type = defaultType in basicTypes ? basicTypes[defaultType] : x => x;
      }
      if (!('filter' in config)) {
        config.filter = () => true;
      }
      if (!('settingName' in config)) {
        config.settingName = `${proxyConfig.get(_domain)}.${name}`;
      }
      proxyConfig.set(name, config);
    },
    addListener: function(settingProxy, names, callback) {
      const proxyConfig = settingProxy[_proxyConfig];
      names = Array.isArray(names) ? names : names.split(' ');
      names.forEach(name => {
        settingHandler
          ._checkAndGetSettingConfig(proxyConfig, name, ReferenceError)
          .listeners.push(callback);
      });
      return callback;
    },
  };
})();

const SearchQuery = (settingsPrefix => {
  return {
    getParameter(name, url = window.location.href) {
      name = name.replace(/[[\]]/g, '\\$&');
      const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)'),
        results = regex.exec(url);
      if (!results) return null;
      if (!results[2]) return '';
      return decodeURIComponent(results[2].replace(/\+/g, ' '));
    },
    getUrl() {
      const { protocol, hostname, pathname, port } = location;
      const url = `${protocol}//${hostname}${port ? ':' + port : ''}${pathname}`;
      const obj = Object.create(null);
      Object.entries(localStorage).forEach(([key, value]) => {
        if (key.startsWith(settingsPrefix)) {
          key = key.replace(`${settingsPrefix}.`, '');
          obj[key] = JSON.parse(value);
        }
      });
      const search = Object.entries(obj)
        .map(pair => pair.map(encodeURIComponent).join('='))
        .join('&');

      return `${url}?${search}`;
    },
  };
})(mainSettingsPrefix);

function setClipboardText(text) {
  const el = document.createElement('textarea');
  el.value = text;
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}

// General settings
const Settings = SettingProxy.createSettingProxy(mainSettingsPrefix);
Object.entries({
  isHardMode: { default: false },
  isWithinCooldown: { default: false },
  amountOfPlayers: { default: 2 },
  goldAlone: { default: false },
  primaryTarget: { default: 'pink_diamond' },
  gold: { default: 0 },
  cocaine: { default: 0 },
  cash: { default: 0 },
  paintings: { default: 0 },
  weed: { default: 0 },
  leaderCut: { default: 80 },
  member1Cut: { default: 20 },
  member2Cut: { default: 15 },
  member3Cut: { default: 15 },
}).forEach(([name, config]) => {
  SettingProxy.addSetting(Settings, name, config);

  // Search query settings:
  const settingValue = SearchQuery.getParameter(name);
  if (settingValue && !['', null, '[]', '&', '/'].includes(settingValue)) {
    if (/\d|true|false/g.test(settingValue)) {
      Settings[name] = JSON.parse(settingValue);
    } else {
      Settings[name] = settingValue;
    }
  }
});
