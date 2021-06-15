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
}
Object.entries(htmlElements).forEach(([setting, elementHTML]) => {
  elementHTML.value = JSON.parse(Settings[setting]);
});
document.querySelector('#isHardMode').value = Settings.isHardMode;
document.querySelector('#goldAlone').value = Settings.goldAlone;
document.querySelector('#primaryTarget').value = Settings.primaryTarget;


const Counter = {
  targetsData: {},
  secondaryTargetsOrder: [],

  init: function () {
    return Loader.promises['targets'].execute(data => {
      Counter.targetsData = data;
      Counter.targetsData.targets.secondary.forEach(({ name, value, weight }) => {
        const profit = getAverage(value.min, value.max) / weight;
        Counter.secondaryTargetsOrder.push({ name, bagProfit: profit });
      });
      Counter.secondaryTargetsOrder.sort((...args) => {
        const [a, b] = args.map(({ bagProfit }) => bagProfit);
        return b - a;
      });
      Counter.getLoot();
    });
  },
  getLoot: function () {
    const amounts = [];
    let bagsFill = 0;
    let emptySpace = Settings.amountOfPlayers;
    let totalValue = 0;
    const isHardMode = Settings.isHardMode ? 'hard' : 'standard';
    const players = Settings.amountOfPlayers;

    Counter.secondaryTargetsOrder.forEach(element => {
      if (emptySpace < .05) return;
      emptySpace = players - bagsFill;
      const obj = Counter.targetsData.targets.secondary.find(object => object.name === element.name);
      if (!Settings.goldAlone && players == 1 && obj.name === 'gold') return;
      if (obj.name === 'paintings' && emptySpace < .5) return;
      const maxFill = (() => {
        let tempAmount = Settings[obj.name];
        if (obj.name === 'paintings') {
          while ((tempAmount * obj.weight) > emptySpace) {
            tempAmount--;
          }
        }
        return tempAmount * obj.weight;
      })();
      let realFill = maxFill >= players ? players : maxFill;
      bagsFill += +realFill;
      realFill = realFill > emptySpace ? emptySpace : realFill;
      if (realFill < 0.05) return;
      const clicks = (() => {
        const rest = realFill / obj.weight - Math.trunc(realFill / obj.weight);
        const value = Math.trunc(realFill / obj.weight) * obj.pickup_steps.length + (findClosestValue((rest % 1) * 100, obj.pickup_steps));
        return (obj.name === 'paintings') ? `${value} cuts` : `${value} clicks`;
      })();

      amounts.push({ name: obj.name, amount: realFill, clicks: clicks });
      totalValue += realFill * (getAverage(obj.value.min, obj.value.max) / obj.weight);
    });
    const finalValue = totalValue + Counter.targetsData.targets.primary.find(({ name }) =>
      name === Settings.primaryTarget).value[isHardMode];

    Counter.updateWebsite(amounts, finalValue);
  },
  updateWebsite: function (amounts, totalValue) {
    totalValue *= Counter.targetsData.events_multiplier;
    const officeSafe = Counter.targetsData.targets.office_safe;
    const averageOfficeSafe = getAverage(officeSafe.min, officeSafe.max);
    const fencingFee = totalValue * .1;
    const pavelFee = totalValue * .02;
    const eliteChallenge = Counter.targetsData.elite_challenge[Settings.isHardMode ? 'hard' : 'standard'];
    document.querySelector('#office-safe').innerText = `~ $${Math.round(averageOfficeSafe).toLocaleString()}`;
    document.querySelector('#fencing-fee').innerText = Math.round(fencingFee).toLocaleString();
    document.querySelector('#pavel-fee').innerText = Math.round(pavelFee).toLocaleString();
    document.querySelector('#elite-challenge').innerText = Math.round(eliteChallenge).toLocaleString();
    const finalValue = totalValue + averageOfficeSafe - fencingFee - pavelFee;
    document.querySelector('#max-loot-value').innerText = Math.round(finalValue).toLocaleString();
    document.querySelectorAll('.big').forEach(e => {
      e.parentElement.classList.add('hidden');
    });

    const inputs = document.querySelectorAll('.cuts input');
    [...inputs].forEach(element => {
      element.nextElementSibling.innerText = Math.round(finalValue * Settings[element.id] / 100).toLocaleString();
    });

    amounts.forEach(object => {
      const amount = rounding(Number(object.amount));
      const element = document.querySelector(`#${object.name}-bag`);
      if (amount !== 0) {
        element.innerHTML = `${amount} <span>${object.name} bag${amount > 1 ? 's' : ''} - ${object.clicks}</span>`;
        element.parentElement.classList.remove('hidden');
      }
    });
  },
  activateHandlers: function () {
    document.querySelector('#isHardMode').addEventListener('change', () => {
      Settings.isHardMode = JSON.parse(isHardMode.value); // bool
    });
    document.querySelector('#goldAlone').addEventListener('change', () => {
      Settings.goldAlone = JSON.parse(goldAlone.value); // bool
    });

    document.querySelector('#primaryTarget').addEventListener('change', () => {
      Settings.primaryTarget = primaryTarget.value; // string
    });
    Object.values(htmlElements).forEach(element => {
      element.addEventListener('change', event => {
        Settings[event.currentTarget.id] = +event.target.value;
      });
    });

    document.querySelector('#link-settings').addEventListener('click', () => {
      setClipboardText(SearchQuery.getUrl());
      alert('Link has been copied to clipboard!');
    });

    SettingProxy.addListener(Settings, 'gold weed cash cocaine paintings primaryTarget isHardMode goldAlone leaderCut member1Cut member2Cut member3Cut', Counter.getLoot);
    SettingProxy.addListener(Settings, 'amountOfPlayers', () => {
      document.querySelector('#goldAlone').parentElement.classList.toggle('hidden', Settings.amountOfPlayers !== 1);
      const inputs = document.querySelectorAll('.cuts input');
      [...inputs].forEach((element, index) => {
        element.parentElement.classList.toggle('hidden', Settings.amountOfPlayers <= index);
      });
      Counter.getLoot();
    })();
  }
}

const findError = callback => (...args) => callback(args).catch(console.log);

function initLogic() {
  Counter.init()
    .then(Counter.activateHandlers)
    .then(Loader.resolveContentLoaded);
};

document.addEventListener('DOMContentLoaded', () => {
  try {
    initLogic();
  }
  catch (error) {
    console.log(error);
    alert(error);
  }
});

function rounding(value) {
  return (Math.round(value * 20) * 0.05).toFixed(2);
}

function getAverage(...args) {
  return args.reduce((acc, val) => acc + val, 0) / args.length;
}

function findClosestValue(value, array) {
  if (value === 0) return 0;
  return array
    .map(element => Math.abs(value - element))
    .reduce((acc, el, index, arr) => el < arr[acc] ? index : acc, 0) + 1;
}
