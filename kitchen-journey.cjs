'use strict';

const assert = require('node:assert/strict');

const DIRECTIONS = [
  { dx: 0, dy: -1, key: 'ArrowUp' },
  { dx: 1, dy: 0, key: 'ArrowRight' },
  { dx: 0, dy: 1, key: 'ArrowDown' },
  { dx: -1, dy: 0, key: 'ArrowLeft' },
];

// The planner reads the kitchen grid. All movement and interactions go through keyboard input.
function routeToStation(start, station, blocked) {
  const queue = [{ ...start, route: [] }];
  const seen = new Set([start.x + ',' + start.y]);
  for (let index = 0; index < queue.length; index++) {
    const { x, y, route } = queue[index];
    for (const dir of DIRECTIONS) {
      const next = { x: x + dir.dx, y: y + dir.dy };
      if (next.x === station.x && next.y === station.y) return { route, face: dir };
      const key = next.x + ',' + next.y;
      if (next.x < 0 || next.x >= 11 || next.y < 0 || next.y >= 8 || blocked.has(key) || seen.has(key)) continue;
      seen.add(key);
      queue.push({ ...next, route: [...route, dir] });
    }
  }
  throw Error('No walkable route to kitchen station ' + JSON.stringify(station));
}

async function cookWelcomeDinner(page, frame) {
  const body = await frame.locator('body').elementHandle();
  const kitchen = await body.ownerFrame();
  await body.dispose();
  assert.ok(kitchen, 'kitchen frame is attached');
  const stations = await kitchen.evaluate(() => Object.values(window.stations).map(({ x, y, type, ing }) => ({ x, y, type, ing })));
  const blocked = new Set(stations.map(({ x, y }) => x + ',' + y));
  const station = (type, ingredient) => {
    const result = stations.find(st => st.type === type && (ingredient === undefined || st.ing === ingredient));
    assert.ok(result, 'Missing station ' + type + (ingredient ? ' ' + ingredient : ''));
    return result;
  };
  const player = () => kitchen.evaluate(() => ({ x: P.x, y: P.y }));
  const waitStopped = () => kitchen.waitForFunction(() => !P.mv, null, { timeout: 3500 });

  async function approach(target) {
    for (let attempt = 0; attempt < 50; attempt++) {
      await waitStopped();
      const position = await player();
      const { route, face } = routeToStation(position, target, blocked);
      if (!route.length) {
        await page.keyboard.down(face.key);
        try {
          await kitchen.waitForFunction(({ dx, dy }) => P.dir.x === dx && P.dir.y === dy, face, { timeout: 3500 });
        } finally {
          await page.keyboard.up(face.key);
        }
        return;
      }
      const step = route[0];
      await page.keyboard.down(step.key);
      try {
        // Release as soon as the animation commits to a step. Replan if external scheduling allowed another step.
        await kitchen.waitForFunction(({ x, y }) => P.mv !== null || P.x !== x || P.y !== y, position, { timeout: 3500 });
      } finally {
        await page.keyboard.up(step.key);
      }
    }
    throw Error('Too many moves toward kitchen station ' + JSON.stringify(target));
  }

  async function interact(target, actions = 1) {
    await approach(target);
    for (let action = 0; action < actions; action++) await page.keyboard.press('Space');
  }

  const stove = station('stove');
  const serve = station('serve');
  const recipes = [
    { name: '番茄炒蛋', first: '番茄', second: '蛋', chop: true },
    { name: '蛋炒饭', first: '蛋', second: '饭', chop: false },
    { name: '紫菜蛋花汤', first: '紫菜', second: '蛋', chop: false },
  ];
  for (const [index, recipe] of recipes.entries()) {
    await kitchen.waitForFunction(name => orders.some(order => order && !order.dead && order.dish.n === name), recipe.name, { timeout: 4500 });
    await interact(station('crate', recipe.first));
    if (recipe.chop) await interact(station('board'), 6); // Place, four cuts, then pick up.
    await interact(stove);
    await interact(station('crate', recipe.second));
    await interact(stove);
    await kitchen.waitForFunction(({ x, y }) => window.stations[x + ',' + y].state === 'ready', stove, { timeout: 6000 });
    await interact(stove);
    await interact(serve);
    assert.equal(parseInt(await frame.locator('#served').textContent(), 10), index + 1, 'Served ' + recipe.name);
  }
}

module.exports = { cookWelcomeDinner };
