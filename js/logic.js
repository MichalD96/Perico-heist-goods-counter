let BAG_CAPACITY = 1800;
const VALUE_PRIORITY = ['gold', 'cocaine', 'weed', 'paintings', 'cash'];
const PICKUP_ORDER = ['cash', 'weed', 'cocaine', 'paintings', 'gold'];

const htmlElements = {
  gold: document.querySelector('#gold'),
  weed: document.querySelector('#weed'),
  cash: document.querySelector('#cash'),
  cocaine: document.querySelector('#cocaine'),
  paintings: document.querySelector('#paintings'),
  amountOfPlayers: document.querySelector('#amountOfPlayers'),
  leaderCut: document.querySelector('#leaderCut'),
  member1Cut: document.querySelector('#member1Cut'),
  member2Cut: document.querySelector('#member2Cut'),
  member3Cut: document.querySelector('#member3Cut'),
};

Object.entries(htmlElements).forEach(([setting, elementHTML]) => {
  elementHTML.value = JSON.parse(Settings[setting]);
});
document.querySelector('#isHardMode').value = Settings.isHardMode;
document.querySelector('#isWithinCooldown').value = Settings.isWithinCooldown;
document.querySelector('#goldAlone').value = Settings.goldAlone;
document.querySelector('#primaryTarget').value = Settings.primaryTarget;

let bags = {};
let targetsData = {};

function getAverage(min, max) {
  return (min + max) / 2;
}

function formatBags(units) {
  return (units / BAG_CAPACITY).toFixed(2);
}

function getBagPercent(units) {
  return (units / BAG_CAPACITY * 100).toFixed(3);
}

function getTargetData(targetType) {
  const target = targetsData.targets.secondary.find((t) => t.name === targetType);
  return {
    pickupUnits: target.pickup_units,
    fullTableUnits: target.full_table_units,
    minValue: target.value.min,
    maxValue: target.value.max,
  };
}

function calculateLootForTarget(targetType, availableTables, remainingCapacity, allowOverfill = false) {
  if (remainingCapacity <= 0 || availableTables <= 0) {
    return { units: 0, presses: 0, tablesUsed: 0 };
  }

  const { pickupUnits, fullTableUnits } = getTargetData(targetType);

  let totalUnits = 0;
  let totalPresses = 0;
  let tablesUsed = 0;
  let capacityLeft = remainingCapacity;

  for (let t = 0; t < availableTables && capacityLeft > 0; t++) {
    if (targetType === 'paintings') {
      if (capacityLeft >= fullTableUnits) {
        totalUnits += fullTableUnits;
        totalPresses += 1;
        tablesUsed++;
        capacityLeft -= fullTableUnits;
      } else if (allowOverfill && capacityLeft > 0) {
        totalUnits += capacityLeft;
        totalPresses += 1;
        tablesUsed++;
        capacityLeft = 0;
      } else {
        break;
      }
    } else {
      let unitsFromThisTable = 0;
      let pressesForThisTable = 0;
      let lastPressOverfill = 0;

      for (let p = 0; p < pickupUnits.length; p++) {
        const cumulativeUnits = pickupUnits[p];
        if (cumulativeUnits <= capacityLeft) {
          unitsFromThisTable = cumulativeUnits;
          pressesForThisTable = p + 1;
        } else {
          if (allowOverfill && p === pressesForThisTable) {
            lastPressOverfill = cumulativeUnits;
          }
          break;
        }
      }

      if (unitsFromThisTable > 0) {
        totalUnits += unitsFromThisTable;
        totalPresses += pressesForThisTable;
        tablesUsed++;
        capacityLeft -= unitsFromThisTable;
      }

      if (capacityLeft > 0 && allowOverfill && lastPressOverfill > 0) {
        totalUnits += capacityLeft;
        totalPresses += 1;
        capacityLeft = 0;
      } else if (unitsFromThisTable === 0) {
        if (allowOverfill && capacityLeft > 0 && capacityLeft < pickupUnits[0]) {
          totalUnits += capacityLeft;
          totalPresses += 1;
          capacityLeft = 0;
        }
        break;
      }
    }
  }

  return { units: totalUnits, presses: totalPresses, tablesUsed };
}

function calculateLoot() {
  const players = Settings.amountOfPlayers;
  const totalCapacity = players * BAG_CAPACITY;
  let remainingCapacity = totalCapacity;

  const isHardMode = Settings.isHardMode ? 'hard' : 'standard';
  const withinCooldownBonus = Settings.isWithinCooldown ? targetsData.targets.primary.find(({ name }) => name === Settings.primaryTarget).bonus_multiplier : 1;

  const results = [];
  let totalSecondaryValue = 0;

  for (const targetType of VALUE_PRIORITY) {
    if (remainingCapacity <= 0) break;
    if (targetType === 'cash') continue; // Handle cash separately at the end

    const availableTables = Settings[targetType] || 0;
    if (availableTables <= 0) continue;

    if (targetType === 'gold' && players === 1 && !Settings.goldAlone) continue;

    const targetData = getTargetData(targetType);
    if (targetType === 'paintings' && remainingCapacity < targetData.fullTableUnits) continue;

    const allowOverfill = targetType !== 'paintings';
    const lootResult = calculateLootForTarget(targetType, availableTables, remainingCapacity, allowOverfill);

    if (lootResult.units > 0) {
      const bagsFilled = lootResult.units / BAG_CAPACITY;
      const avgValue = getAverage(targetData.minValue, targetData.maxValue);
      const valueCollected = lootResult.units / targetData.fullTableUnits * avgValue * withinCooldownBonus;

      results.push({
        name: targetType,
        units: lootResult.units,
        bags: bagsFilled,
        presses: lootResult.presses,
        value: valueCollected,
      });

      totalSecondaryValue += valueCollected;
      remainingCapacity -= lootResult.units;
    }
  }

  if (remainingCapacity > 0) {
    const cashAvailable = Settings['cash'] || 0;
    if (cashAvailable > 0) {
      const targetData = getTargetData('cash');
      const lootResult = calculateLootForTarget('cash', cashAvailable, remainingCapacity, true);

      if (lootResult.units > 0) {
        const bagsFilled = lootResult.units / BAG_CAPACITY;
        const avgValue = getAverage(targetData.minValue, targetData.maxValue);
        const valueCollected = lootResult.units / targetData.fullTableUnits * avgValue * withinCooldownBonus;

        results.push({
          name: 'cash',
          units: lootResult.units,
          bags: bagsFilled,
          presses: lootResult.presses,
          value: valueCollected,
        });

        totalSecondaryValue += valueCollected;
        remainingCapacity -= lootResult.units;
      }
    }
  }

  const primaryValue = targetsData.targets.primary.find(({ name }) => name === Settings.primaryTarget).value[isHardMode];

  updateDisplay(results, totalSecondaryValue, primaryValue, withinCooldownBonus);
}

function updateDisplay(results, secondaryValue, primaryValue, withinCooldownBonus) {
  const totalLootValue = (secondaryValue + primaryValue) * targetsData.events_multiplier;
  const officeSafe = targetsData.targets.office_safe;
  const averageOfficeSafe = getAverage(officeSafe.min, officeSafe.max);
  const fencingFee = totalLootValue * 0.1;
  const pavelFee = totalLootValue * 0.02;
  const eliteChallenge = targetsData.elite_challenge[Settings.isHardMode ? 'hard' : 'standard'];

  document.querySelector('#office-safe').innerText = `~ $${Math.round(averageOfficeSafe).toLocaleString()}`;
  document.querySelector('#fencing-fee').innerText = Math.round(fencingFee).toLocaleString();
  document.querySelector('#pavel-fee').innerText = Math.round(pavelFee).toLocaleString();
  document.querySelector('#elite-challenge').innerText = Math.round(eliteChallenge).toLocaleString();

  const finalValue = totalLootValue + averageOfficeSafe - fencingFee - pavelFee;
  document.querySelector('#max-loot-value').innerText = Math.round(finalValue).toLocaleString();

  document.querySelectorAll('.big').forEach((e) => {
    e.parentElement.classList.add('hidden');
  });

  VALUE_PRIORITY.forEach((targetType) => {
    const data = getTargetData(targetType);
    const avgValue = getAverage(data.minValue, data.maxValue) * withinCooldownBonus;
    document.querySelector(`#${targetType}-stacks-value`).innerText = '$' + Math.round(avgValue).toLocaleString();

    const valuePerBagUnit = avgValue / data.fullTableUnits * BAG_CAPACITY;
    document.querySelector(`#${targetType}-bags-value`).innerText = '$' + Math.round(valuePerBagUnit).toLocaleString();

    const bagPercent = (data.fullTableUnits / BAG_CAPACITY * 100).toFixed(2);
    document.querySelector(`#${targetType}-bag-percent`).innerText = bagPercent + '%';
  });

  const inputs = document.querySelectorAll('.cuts input');
  [...inputs].forEach((element) => {
    element.nextElementSibling.innerText = Math.round(finalValue * Settings[element.id] / 100).toLocaleString();
  });

  bags = { profit: Math.round(finalValue) };
  let totalBagsFilled = 0;

  results.forEach((result) => {
    const bagsFormatted = result.bags.toFixed(2);
    const element = document.querySelector(`#${result.name}-bag`);

    const clicksText = result.name === 'paintings' ? `${result.presses * 4} cuts` : `${result.presses} clicks`;

    element.innerHTML = `${bagsFormatted} <span>${result.name} bag${result.bags > 1 ? 's' : ''} - ${clicksText}</span>`;
    element.parentElement.classList.remove('hidden');

    bags[result.name] = [Number(bagsFormatted), result.presses, Number(htmlElements[result.name].value)];
    totalBagsFilled += result.bags;
  });

  document.querySelector('#bags_fill').innerText = totalBagsFilled.toFixed(2);
}

function init() {
  return Loader.promises['targets'].execute((data) => {
    targetsData = data;
    BAG_CAPACITY = data.bag_capacity || 1800;
    calculateLoot();
  });
}

function activateHandlers() {
  document.querySelector('#isHardMode').addEventListener('change', () => {
    Settings.isHardMode = JSON.parse(isHardMode.value);
  });

  document.querySelector('#isWithinCooldown').addEventListener('change', () => {
    Settings.isWithinCooldown = JSON.parse(isWithinCooldown.value);
  });

  document.querySelector('#goldAlone').addEventListener('change', () => {
    Settings.goldAlone = JSON.parse(goldAlone.value);
  });

  document.querySelector('#primaryTarget').addEventListener('change', () => {
    Settings.primaryTarget = primaryTarget.value;
  });

  Object.values(htmlElements).forEach((element) => {
    element.addEventListener('change', (event) => {
      Settings[event.currentTarget.id] = +event.target.value;
    });
  });

  document.querySelector('#link-settings').addEventListener('click', () => {
    if (window.event.ctrlKey) {
      const json = JSON.stringify({
        hard: Settings.isHardMode,
        withinCooldown: Settings.isWithinCooldown,
        target: Settings.primaryTarget,
        players: Settings.amountOfPlayers,
        ...bags,
      });
      setClipboardText(`$loot ${json}`);
      return;
    }

    setClipboardText(SearchQuery.getUrl());
    alert('Link has been copied to clipboard!');
  });

  document.querySelector('#reset-settings').addEventListener('click', () => {
    document.querySelector('#primaryTarget').value = 'tequila';
    Settings.primaryTarget = 'tequila';
    ['gold', 'weed', 'cash', 'cocaine', 'paintings'].forEach((target) => {
      Settings[target] = 0;
      htmlElements[target].value = 0;
    });
  });

  SettingProxy.addListener(
    Settings,
    'gold weed cash cocaine paintings primaryTarget isHardMode isWithinCooldown goldAlone leaderCut member1Cut member2Cut member3Cut',
    calculateLoot
  );

  SettingProxy.addListener(Settings, 'amountOfPlayers', () => {
    document.querySelector('#goldAlone').parentElement.classList.toggle('hidden', Settings.amountOfPlayers !== 1);
    const inputs = document.querySelectorAll('.cuts input');
    [...inputs].forEach((element, index) => {
      element.parentElement.classList.toggle('hidden', Settings.amountOfPlayers <= index);
    });
    calculateLoot();
  })();
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    init().then(activateHandlers).then(Loader.resolveContentLoaded);
  } catch (error) {
    console.log(error);
    alert(error);
  }
});
