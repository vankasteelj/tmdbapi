'use strict';

// default settings
const defaultUrl = 'https://api.themoviedb.org/3';

// requirejs modules
const got = require('got');
const methods = require('./methods.json');

module.exports = class TMDB {
  constructor(settings = {}) {
    if (!settings.apiv3) throw Error('You need to pass an API Key');

    this._authentication = {};
    this._settings = {
      apiv3: settings.apiv3,
      endpoint: settings.api_url || defaultUrl,
      language: settings.language,
    };

    this._construct();
  }

  login(username, password) {
    if ((!username || !password) || this._authentication.expires_at <= Date.now()) return this.loginAsGuest();

    if (
      this._authentication.session_id && 
      this._authentication.username === username
    ) return Promise.resolve(this._authentication);

    return this.authentication.token.new().then(response => {
      return this.authentication.token.validate_with_login({
        username: username,
        password: password,
        request_token: response.request_token
      });
    }).then(response => {
      return this.authentication.session.new({request_token: response.request_token});
    }).then(response => {
      return this._authentication = {
        username: username,
        session_id: response.session_id
      };
    });
  }

  loginAsGuest() {
    if (
      this._authentication.session_id && 
      this._authentication.expires_at > Date.now() &&
      this._authentication.username === 'guest'
    ) return Promise.resolve(this._authentication);

    return this.authentication.guest_session.new().then(response => {
      return this._authentication = {
        session_id: response.guest_session_id,
        expires_at: Date.parse(response.expires_at),
        username: 'guest'
      };
    });
  }

  // Creates methods for all requests
  _construct() {
    for (let url in methods) {
      const urlParts = url.split('/');
      const name = urlParts.pop(); // key for function

      let tmp = this;
      for (let p = 1; p < urlParts.length; ++p) { // acts like mkdir -p
        tmp = tmp[urlParts[p]] || (tmp[urlParts[p]] = {});
      }

      tmp[name] = (() => {
        const method = methods[url]; // closure forces copy
        return (params) => {
          return this._call(method, params);
        };
      })();
    }
  }

  // Parse url before api call
  _parse(method, params = {}) {
    if (method.auth && !this._authentication.session_id) throw Error('You need to be logged in');

    const queryParts = [];
    const pathParts = [];

    // ?Part
    const queryPart = method.url.split('?')[1];
    if (queryPart) {
      const queryParams = queryPart.split('&');
      for (let i in queryParams) {
        const name = queryParams[i].split('=')[0];
        (params[name] || params[name] === 0) && queryParts.push(name + '=' + params[name]);
      }
    }

    // /part
    const pathPart = method.url.split('?')[0];
    const pathParams = pathPart.split('/');
    for (let k in pathParams) {
      if (pathParams[k][0] != ':') {
        pathParts.push(pathParams[k]);
      } else {
        const param = params[pathParams[k].substr(1)];
        if (param || param === 0) {
          pathParts.push(param);
        } else {
          // check for missing required params
          if (method.optional && method.optional.indexOf(pathParams[k].substr(1)) === -1) throw Error('Missing mandatory paramater: ' + pathParams[k].substr(1));
        }
      }
    }

    // Pagination
    if (method.pagination) {
      params['page'] && queryParts.push('page=' + params['page']);
    }

    // Language
    this._settings.language && queryParts.push('language=' + this._settings.language);
    params['language'] && queryParts.push('language=' + params['language']);

    // Append to response
    if (method.append_to_response) {
      params['append_to_response'] && queryParts.push('append_to_response=' + params['append_to_response']);
    }

    queryParts.push('api_key=' + this._settings.apiv3);

    if (method.auth) {
      queryParts.push('session_id=' + this._authentication.session_id);
    }

    let url = this._settings.endpoint;

    url += pathParts.join('/');

    if (queryParts.length) url += '?' + queryParts.join('&');
    return url;
  }

  // Parse methods then hit API
  _call(method, params) {
    const req = {
      method: method.method || 'GET',
      url: this._parse(method, params),
      headers: {
        'Content-Type': 'application/json'
      },
      body: (method.body ? Object.assign({}, method.body) : {})
    };

    for (let k in params) {
      if (k in req.body) req.body[k] = params[k];
    }
    for (let k in req.body) {
      if (!req.body[k]) delete req.body[k];
    }

    req.body = JSON.stringify(req.body);
    if (req.body == '{}') delete req.body; //sending empty object as body replies 403

    return got(req.url, req).then(response => JSON.parse(response.body));
  }

}
