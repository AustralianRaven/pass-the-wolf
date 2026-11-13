import { describe, expect, it } from 'vitest';
import { applyRoll, bank, canBank, newGame, nextTurn, upNext } from '../../src/rules/game';
import { buildScoreCard } from '../../src/rules/scorecard';
import { points, scattered, seats, tangled } from './fixtures';

describe('Feature: setting up a game', () => {
  it.each([1, 7])('Scenario: Given %i seats, Then the game refuses to start', (n) => {
    expect(() => newGame({ seats: seats(n) }), 'Then an invalid seat count throws').toThrow(/2 to 6 seats/);
  });

  it('Scenario: Given two seats and no target, Then the game starts at round 1 with a target of 100', () => {
    const g = newGame({ seats: seats(2) });
    expect(g.targetScore, 'Then the default target is 100').toBe(100);
    expect(g.round, 'Then play starts in round 1').toBe(1);
    expect(g.currentSeat, 'Then seat 1 throws first').toBe(0);
    expect(g.phase, 'Then the game waits for a roll').toBe('awaitingRoll');
    expect(canBank(g), 'Then there is nothing to bank yet').toBe(false);
  });
});

describe('Feature: a turn', () => {
  it('Scenario: Given rolls of 5 and 15, When the player banks, Then 20 points are banked and the dice are handed over', () => {
    let g = newGame({ seats: seats(2) });
    g = applyRoll(g, points(5));
    expect(g.turnPot, 'Then the pot holds 5 after the first roll').toBe(5);
    g = applyRoll(g, points(15));
    expect(g.turnPot, 'Then the pot holds 20 after the second roll').toBe(20);
    g = bank(g);
    expect(g.scores[0], 'Then seat 1 has 20 banked').toBe(20);
    expect(g.phase, 'Then the game shows the handover').toBe('handover');
    expect(upNext(g).name, 'Then Player 2 is up next').toBe('Player 2');
    g = nextTurn(g);
    expect(g.currentSeat, 'Then seat 2 is now throwing').toBe(1);
    expect(g.turnPot, 'Then the new turn starts with an empty pot').toBe(0);
  });

  it('Scenario: Given a pot of 12, When the roll is Scattered, Then the pot is lost but the bank survives', () => {
    let g = newGame({ seats: seats(2) });
    g = nextTurn(bank(applyRoll(g, points(30))));
    g = nextTurn(bank(applyRoll(g, points(1))));
    g = applyRoll(g, points(12));
    g = applyRoll(g, scattered);
    expect(g.scores[0], 'Then the banked 30 is kept').toBe(30);
    expect(g.phase, 'Then the turn ends').toBe('handover');
    expect(g.history.at(-1)?.lost, 'Then the record shows 12 lost').toBe(12);
  });

  it('Scenario: Given a bank of 40 and a pot of 10, When the roll is Tangled, Then the whole bank is wiped', () => {
    let g = newGame({ seats: seats(2) });
    g = nextTurn(bank(applyRoll(g, points(40))));
    g = nextTurn(bank(applyRoll(g, points(1))));
    g = applyRoll(applyRoll(g, points(10)), tangled);
    expect(g.scores[0], 'Then seat 1 drops to 0').toBe(0);
    expect(g.history.at(-1)?.lost, 'Then the record shows 50 lost').toBe(50);
    expect(g.history.at(-1)?.outcome, 'Then the record is marked Tangled').toBe('tangled');
  });

  it('Scenario: Given an empty pot, When the player tries to bank, Then it is refused', () => {
    expect(() => bank(newGame({ seats: seats(2) })), 'Then banking nothing throws').toThrow(/Nothing to bank/);
  });

  it('Scenario: Given the handover phase, When a roll arrives, Then it is refused', () => {
    const g = bank(applyRoll(newGame({ seats: seats(2) }), points(5)));
    expect(() => applyRoll(g, points(5)), 'Then rolling during handover throws').toThrow(/handover/);
  });
});

describe('Feature: winning', () => {
  it('Scenario: Given a score of 90, When the player banks 10, Then they win at the 100 target', () => {
    let g = newGame({ seats: seats(3) });
    g = nextTurn(bank(applyRoll(g, points(90))));
    g = nextTurn(bank(applyRoll(g, points(1))));
    g = nextTurn(bank(applyRoll(g, points(1))));
    g = bank(applyRoll(g, points(10)));
    expect(g.phase, 'Then the game is over').toBe('gameOver');
    expect(g.winner, 'Then seat 1 wins').toBe(0);
    expect(() => nextTurn(g), 'Then play cannot continue').toThrow();
  });

  it('Scenario: Given a pot past the target, When not banked, Then the game is not yet won', () => {
    const g = applyRoll(newGame({ seats: seats(2), targetScore: 10 }), points(15));
    expect(g.phase, 'Then the player must still bank').toBe('awaitingRoll');
  });
});

describe('Feature: rounds and the score card', () => {
  it('Scenario: Given three seats, When every seat has a turn, Then round 2 starts with seat 1', () => {
    let g = newGame({ seats: seats(3) });
    for (let i = 0; i < 3; i++) {
      expect(g.round, `Then turn ${i + 1} is in round 1`).toBe(1);
      g = nextTurn(bank(applyRoll(g, points(i + 1))));
    }
    expect(g.round, 'Then round 2 has started').toBe(2);
    expect(g.currentSeat, 'Then seat 1 throws first in round 2').toBe(0);
  });

  it('Scenario: Given one and a half rounds, Then the score card has a row per round with a gap for the unplayed turn', () => {
    let g = newGame({ seats: seats(2) });
    g = nextTurn(bank(applyRoll(g, points(5))));
    g = nextTurn(applyRoll(g, scattered));
    g = nextTurn(bank(applyRoll(g, points(10))));
    const card = buildScoreCard(g);
    expect(card.length, 'Then there are two rows').toBe(2);
    expect(card[0]?.cells[0]?.banked, 'Then round 1, seat 1 banked 5').toBe(5);
    expect(card[0]?.cells[1]?.outcome, 'Then round 1, seat 2 was Scattered').toBe('scattered');
    expect(card[1]?.cells[0]?.scoreAfter, 'Then round 2, seat 1 totals 15').toBe(15);
    expect(card[1]?.cells[1], 'Then round 2, seat 2 has not played').toBeNull();
  });
});
