'use strict';

var factory = require('../../..' + (process.env.SOURCE_ROOT || '') + '/server/repositories/user.js');
var redisFactory = require('../../..' + (process.env.SOURCE_ROOT || '') + '/server/repositories/redisFactory.js');
var mockRedis = require('node-redis-mock');

var assert = require('chai').assert;

var promise = require('promise');

describe('User repository', function() {
    var userRepository;
    var redisClient = redisFactory.createClient();
    var del = promise.denodeify(redisClient.del);
    var hget = promise.denodeify(redisClient.hget);

    beforeEach(function() {
        userRepository = factory.build();
    });

    afterEach(function(done) {
        redisClient.flushdb(function (err) {
            assert.isNull(err);
            done();
        });
    });

    it('should persist new users with a default TTL', function(done) {
        var username = 'User1';

        userRepository.createUser(username)
            .then(function (result) {
                assert.isUndefined(result.error);
                var ttl = mockRedis.storage[result.playerId].expires;
                assert.isTrue(ttl > 0, 'Expected TTL ' + ttl + ' to be > 0');
                assert.isTrue(ttl <= 1800, 'Expected TTL ' + ttl + 'to be <= 1800');
                return hget(result.playerId, 'name');
            })
            .then(function(actualUsername) {
                assert.equal(actualUsername, username);
                done();
            })
            .done();
    });

    it('should return error when username already exists', function(done) {
        var username = 'User1';

        userRepository.createUser(username)
            .then(function() {
                userRepository.createUser(username, function(err, result) {
                    assert.isNotNull(result.error);
                    done();
                });
            })
            .done();
    });

    it('should return error when no username specified', function(done) {
        userRepository.createUser(null, function(err, result) {
            assert.isNotNull(result.error);
            done();
        });
    });

    it('should return error when username is too short', function(done) {
        userRepository.createUser('A', function(err, result) {
            assert.isNotNull(result.error);
            done();
        });
    });

    it('should return error when username is too long', function(done) {
        userRepository.createUser('ABCDEFGHIJKLYMNOPQRSTUVWXYZ', function(err, result) {
            assert.isNotNull(result.error);
            done();
        });
    });

    it('should allow username to be re-used when user has expired', function(done) {
        var username = 'User1';

        userRepository.createUser(username)
            .then(function(result) {
                return del(result.playerId);
            })
            .then(function() {
                return userRepository.createUser(username);
            })
            .then(function(result) {
                return hget(result.playerId, 'name');
            })
            .then(function(actualUsername) {
                assert.equal(actualUsername, username);
                done();
            })
            .done();
    });

    it('should return user details for an existing user', function(done) {
        var username = 'User1';

        userRepository.createUser(username)
            .then(function (result) {
                return userRepository.fetchUser(result.playerId);
            })
            .then(function (user) {
                assert.equal(user.name, username);
                done();
            })
            .done();
    });

    it('should extend user expiry time on read', function(done) {
        var playerId = null;
        userRepository.createUser('user1')
            .then(function (result) {
                playerId = result.playerId;
                return userRepository.fetchUser(result.playerId);
            }).then(function () {
                var ttl = mockRedis.storage[playerId].expires;
                assert.isTrue(ttl > 86000, 'Expected TTL ' + ttl + ' to be > 86000');
                done();
            })
            .done();
    });

    describe('registration', function() {
        it('should allow users to register with an external account', function(done) {
            var playerId;

            userRepository.createUser('user1')
                .then(function(result) {
                    playerId = result.playerId;
                    return userRepository.registerAccount(result.playerId, 'facebook', '12345678');
                })
                .then(function() {
                    return userRepository.getUserForAccount('facebook', '12345678');
                })
                .then(function(foundPlayerId) {
                    assert.equal(playerId, foundPlayerId);
                    done();
                })
                .done();
        });

        it('should remove TTL from user with registered account', function(done) {
            var playerId;

            userRepository.createUser('user1')
                .then(function(result) {
                    playerId = result.playerId;
                    return userRepository.registerAccount(result.playerId, 'facebook', '12345678');
                })
                .then(function() {
                    assert.isUndefined(mockRedis.storage[playerId].expires);
                    done();
                })
                .done();
        });

        it('should not reset expiry when refreshing users with a registered account', function(done) {
            var playerId;

            userRepository.createUser('user1')
                .then(function(result) {
                    playerId = result.playerId;
                    return userRepository.registerAccount(result.playerId, 'facebook', '12345678');
                })
                .then(function() {
                    return userRepository.fetchUser(playerId);
                })
                .then(function() {
                    assert.isUndefined(mockRedis.storage[playerId].expires);
                    done();
                })
                .done();
        });

        it('should not allow the same external account to be registered against two users', function(done) {
            var playerId1 = null;
            var playerId2 = null;

            userRepository.createUser('user1')
                .then(function (result) {
                    playerId1 = result.playerId;
                })
                .then(function() {
                    return userRepository.createUser('user2');
                })
                .then(function (result) {
                    playerId2 = result.playerId;
                })
                .then(function() {
                    return userRepository.registerAccount(playerId1, 'facebook', '12345678');
                })
                .then(function() {
                    return userRepository.registerAccount(playerId2, 'facebook', '12345678');
                })
                .then(function() {
                    return userRepository.getUserForAccount('facebook', '12345678');
                })
                .then(function(foundPlayerId) {
                    assert.equal(playerId1, foundPlayerId);
                    done();
                })
                .done();
        });
    });
});