// Card decks management
const { TREASURE_CARDS, ISLAND_TILES, ROLES } = require('./constants');

class Deck {
  constructor(cards = []) {
    this.cards = [...cards];
    this.discardPile = [];
  }

  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  draw() {
    if (this.cards.length === 0) {
      this.reshuffleDiscard();
    }
    return this.cards.pop() || null;
  }

  drawMultiple(count) {
    const drawn = [];
    for (let i = 0; i < count; i++) {
      const card = this.draw();
      if (card) drawn.push(card);
    }
    return drawn;
  }

  discard(card) {
    this.discardPile.push(card);
  }

  reshuffleDiscard() {
    this.cards = [...this.discardPile];
    this.discardPile = [];
    this.shuffle();
  }

  putDiscardOnTop() {
    // Shuffle discard pile and put it on TOP of draw pile (for Waters Rise!)
    const shuffledDiscard = [...this.discardPile];
    for (let i = shuffledDiscard.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledDiscard[i], shuffledDiscard[j]] = [shuffledDiscard[j], shuffledDiscard[i]];
    }
    this.cards = [...this.cards, ...shuffledDiscard];
    this.discardPile = [];
  }

  getState() {
    return {
      remaining: this.cards.length,
      discardPile: this.discardPile.length
    };
  }
}

class TreasureDeck extends Deck {
  constructor() {
    const cards = [];
    let cardId = 0;

    // Add artifact cards
    for (const key of ['FIRE', 'WIND', 'WATER', 'EARTH']) {
      const cardType = TREASURE_CARDS[key];
      for (let i = 0; i < cardType.count; i++) {
        cards.push({
          id: `treasure_${cardId++}`,
          type: cardType.id,
          name: cardType.name,
          isArtifact: true
        });
      }
    }

    // Add special cards
    for (let i = 0; i < TREASURE_CARDS.WATERS_RISE.count; i++) {
      cards.push({
        id: `treasure_${cardId++}`,
        type: 'waters_rise',
        name: TREASURE_CARDS.WATERS_RISE.name,
        isWatersRise: true
      });
    }

    for (let i = 0; i < TREASURE_CARDS.HELICOPTER.count; i++) {
      cards.push({
        id: `treasure_${cardId++}`,
        type: 'helicopter',
        name: TREASURE_CARDS.HELICOPTER.name,
        isAction: true
      });
    }

    for (let i = 0; i < TREASURE_CARDS.SANDBAGS.count; i++) {
      cards.push({
        id: `treasure_${cardId++}`,
        type: 'sandbags',
        name: TREASURE_CARDS.SANDBAGS.name,
        isAction: true
      });
    }

    super(cards);
    this.shuffle();
  }

  // Draw initial hand (replace Waters Rise! cards)
  drawInitialHand(count = 2) {
    const hand = [];
    while (hand.length < count) {
      const card = this.draw();
      if (card.isWatersRise) {
        // Put it back and reshuffle
        this.cards.unshift(card);
        this.shuffle();
      } else {
        hand.push(card);
      }
    }
    return hand;
  }
}

class FloodDeck extends Deck {
  constructor(islandTiles) {
    const cards = islandTiles.map(tile => ({
      id: `flood_${tile.id}`,
      tileId: tile.id,
      name: tile.name
    }));

    super(cards);
    this.shuffle();
  }
}

class AdventurerDeck {
  constructor() {
    this.roles = Object.values(ROLES);
    this.shuffle();
  }

  shuffle() {
    for (let i = this.roles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.roles[i], this.roles[j]] = [this.roles[j], this.roles[i]];
    }
  }

  draw() {
    return this.roles.pop() || null;
  }

  getRemainingCount() {
    return this.roles.length;
  }
}

module.exports = {
  Deck,
  TreasureDeck,
  FloodDeck,
  AdventurerDeck
};
