const layout = require("./safe-game-interactions/layout.cjs");
const catInteractions = require("./safe-game-interactions/cat-interactions.cjs");
const hintsRewards = require("./safe-game-interactions/hints-rewards.cjs");
const history = require("./safe-game-interactions/history.cjs");
const modal = require("./safe-game-interactions/modal.cjs");

layout.register01();
hintsRewards.register01();
history.register01();
layout.register02();
catInteractions.register01();
hintsRewards.register02();
layout.register03();
hintsRewards.register03();
history.register02();
modal.register01();
