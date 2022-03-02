'use strict';

const log = require('../log'),
      moment = require('moment'),
      request = require('request'),
      Promise = require('bluebird');

class Datadog {
    constructor() {
        this._timeout = 2 * 60 * 1000; // 2 min
    }

    init(opt) {
        if (opt == null || !(apiKey in opt) || opt.apiKey.length == 0) {
            let errorMsg = 'Datadog: error apiKey empty!';
            log.error(errorMsg);
            throw new Error('');
        }

        this._url = "https://app.datadoghq.com/api/v1/series?api_key=" + apiKey;
    }

    send(name, values, tags) {
        let sendData = {
            metric: name,
            points: values
        };

        if (tags != null && Object.keys(tags).length > 0) {
            sendData.tags = tags
        }

        let self = this;
        return new Promise(function (resolve, reject) {
            request.post(self._url, {
                json: sendData,
                timeout: self._timeout
            }, function (err, res, body) {

            });
        });
    }
}

module.exports = Datadog;