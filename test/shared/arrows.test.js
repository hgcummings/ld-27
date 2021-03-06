'use strict';

var arrows = require('../..' + (process.env.SOURCE_ROOT || '') + '/shared/arrows.js');
var assert = require('chai').assert;

describe('arrows', function() {
    var playerArrows;

    beforeEach(function() {
        playerArrows = new arrows.PlayerArrows(4);
    });

    function addArrow(player, x, y, from, currentTime) {
        return playerArrows.addArrow(player, {
            x: x,
            y: y,
            from: from
        }, currentTime || from);
    }

    describe('addArrow', function() {
        it('should prevent placing arrows on top of other arrows', function() {
            var firstArrow = addArrow(0, 2, 2, 0);
            var result = addArrow(1, 2, 2, 100);

            assert.isFalse(result);
            assert.equal(firstArrow, playerArrows.getActiveArrow(200, 2, 2).arrow);
        });

        it('should not allow two conflicting arrows to be placed in the future', function() {
            var firstArrow = addArrow(0, 2, 2, 250, 200);
            var result = addArrow(1, 2, 2, 350, 200);

            assert.isFalse(result);
            assert.equal(firstArrow, playerArrows.getActiveArrow(400, 2, 2).arrow);
        });

        it('should prevent the same player from placing more than three arrows', function() {
            var firstArrow = addArrow(0, 0, 0, 0);
            addArrow(0, 1, 1, 1);
            addArrow(0, 2, 2, 2);
            addArrow(0, 3, 3, 3);

            assert.isFalse(firstArrow.isActive(5));
        });

        it('should return active arrow when an active arrow is placed over an inactive one', function() {
            addArrow(0, 0, 0, 0);
            addArrow(0, 1, 1, 1);
            addArrow(0, 2, 2, 2);
            addArrow(0, 3, 3, 3);
            addArrow(0, 0, 0, 4);

            var result = playerArrows.getActiveArrow(5, 0, 0);
            assert.isNotNull(result);
        });

        it('should remove arrows pre-empted by re-instated arrows', function() {
            addArrow(0, 0, 0, 0);
            addArrow(0, 1, 1, 10);
            addArrow(0, 2, 2, 20);
            addArrow(0, 3, 3, 30);
            var arrow = addArrow(1, 0, 0, 35);

            // Check assumptions
            assert.isTrue(!!arrow);
            assert.equal(1, playerArrows.getActiveArrow(40, 0, 0).player);

            addArrow(2, 3, 3, 25);

            assert.equal(0, playerArrows.data[1].length);
        });

        it('should not allow different players to place arrows at identical times', function() {
            var firstArrow = addArrow(0, 1, 2, 100);
            var secondArrow = addArrow(1, 2, 3, 100);

            assert.notEqual(firstArrow.from, secondArrow.from);

            var thirdArrow = addArrow(2, 4, 5, 101);
            var fourthArrow = addArrow(0, 6, 7, 102);

            assert.notEqual(thirdArrow.from, fourthArrow.from);
        });

        it('should restore lifetime of re-instated arrows', function() {
            var arrow = addArrow(0, 0, 0, 0);
            var lifeTime = arrow.to;
            addArrow(0, 1, 1, 10);
            addArrow(0, 2, 2, 20);

            var newArrow = addArrow(0, 3, 3, 30);
            assert.equal(arrow.to, newArrow.from);

            addArrow(2, 3, 3, 25);
            assert.equal(arrow.to, lifeTime);
        });

        it('should not block arrows due to no longer active arrows between updates', function() {
            addArrow(0, 0, 0, 105, 100);
            addArrow(0, 1, 1, 115, 100);
            addArrow(0, 2, 2, 125, 100);
            addArrow(0, 3, 3, 135, 100);
            var arrow = addArrow(1, 0, 0, 145, 100);

            // Both arrows should exist at their respective times, since they don't overlap (so no pre-emption occurred)
            assert.isTrue(!!arrow);
            assert.equal(0, playerArrows.getActiveArrow(110, 0, 0).player);
        });

        it('should not block arrows due to existing arrows that have been destroyed by foxes', function() {
            var arrow = addArrow(0, 0, 0, 100);
            arrow.hits.push(200);
            arrow.hits.push(300);

            var newArrow = addArrow(1, 0, 0, 400);

            assert.isTrue(!!newArrow);
        });
    });
});