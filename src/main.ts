import './style.css'
import { genLevel } from './genLevel';
import { genEnemyTemplate } from './genEnemy';
import { range } from 'lodash-es';

const result = genLevel({
  mapCount: 10,
  startLoc: [ 6, 12 ],
  enemies: range(20).map(() => genEnemyTemplate()),
  params: {
      roomRatio: 75,
  },
  items: {
      jewel: [ 1, 2, 4 ],
      equip: [ 15, 15 ],
  },
  growth: 0.15,
  initStatus: {
      atk: 10,
      def: 10,
  }
});

console.log(result);
