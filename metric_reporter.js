'use strict';

const log = require('./log'),
    drivers = require('./drivers/drivers'),
    Drivers = new drivers(),
    crypto = require('crypto'),
    moment = require('moment'),
    Promise = require('bluebird');

class MetricReporter {
    constructor(driverName, driverOptions, interval, maxMetrics, prefix, logger) {
        // init driver
        driverName = driverName || "";
        this._driver = Drivers.getDriver(driverName);
        if (this._driver == null) {
            let errMsg = 'Metric Reporter: error driver: ' + driverName + ' not found!';
            log.error(errMsg);
            throw new Error(errMsg);
        }
        this._driver.init(driverOptions);

        // init logger
        log.init(logger || console);

        // check types
        this._interval = interval || 1;
        this._maxMetrics = maxMetrics || 100;
        this._prefix = prefix || "";

        this._metrics = {};

        this._isRunning = true;
    }

    send(name, value, tags) {
        let self = this;
        return new Promise(function (resolve, reject) {
            if (self._prefix.length > 0) {
                name = self._prefix + '.' + name;
            }

            self._safeMetric(name, value, tags);
            resolve(true);
        });
    }

    stop() {
        let self = this;
        if (!self._isRunning) {
            return;
        }

        return new Promise(function (resolve, reject) {
            log.info("Metric reporter: flush from stop");
            self._isRunning = false;
            self._flushAll().then(function (res) {
                resolve(res);
            }, function (reason) {
                reject(reason);
            })
        });
    }

    _safeMetric(name, value, tags) {
        let self = this;
        let hashKey = self._calcHash(name, tags);

        if (hashKey in self._metrics) {
            let metric = self._metrics[hashKey];

            metric.points.push([moment().unix(), value]);
            self._flush(false, metric);
        } else {
            let metric = {
                name: name,
                points: [],
                tags: tags,
                startTime: moment(),
            };

            metric.points.push([moment().unix(), value]);
            metric.interval = setInterval(function () {
                self._flush(true, metric);
            }, self._interval * 1000);

            self._metrics[hashKey] = metric;
        }
    }

    _calcHash(name, tags) {
        let hashData = name;

        let hashList = [];
        for (var key in tags) {
            let tag = tags[key];

            hashList.push(key);
            hashList.push(tag);
        }
        hashList = hashList.sort();

        for (var index in hashList) {
            hashData += hashList[index];
        }

        return crypto.createHash('md5').update(hashData).digest('hex')
    }

    _flush(isForce, metric) {
        let self = this;
        let metricClear = function() {
            metric.startTime = moment();
            metric.points = [];
        };

        return new Promise(function (resolve, reject) {
            let currentTime = moment();

            let isNeedSend = metric.points.length != 0 && (isForce ||
                (metric.points.length >= self._maxMetrics));

            if (isNeedSend) {
                log.info("Metric reporter: sending metrics data");
                self._driver.send(metric.name, metric.points, metric.tags).then(function (res) {
                    resolve(res);
                }, function (reason) {
                    log.error("Metric reporter: " + reason);
                    reject(reason);
                });
                metricClear();
            }
        })
    }

    _flushAll() {
        let self = this;
        return new Promise(function (resolve, reject) {
            let metricCount = Object.keys(self._metrics).length;
            var currentCount = 0;

            for (var key in self._metrics) {
                let metric = self._metrics[key];
                if (metric.interval != null) {
                    clearInterval(metric.interval);
                }

                if (metric.points.length == 0) {
                    currentCount += 1;
                }

                self._flush(true, metric);

                if (currentCount >= metricCount) {
                    resolve('Flushed metrics');
                }
            }
        });
    }
}

module.exports = MetricReporter;