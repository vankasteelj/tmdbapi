'use strict';

// default settings
const defaultUrl = 'https://api.themoviedb.org/3';
const defaultLang = 'en-US';

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
            language: settings.language || defaultLang,
        };

        this._construct();
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
    _parse(method, params) {
        if (!params) params = {};
        
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

        return got(req.url, req).then(response => 
            JSON.parse(response.body);
        );
    }

}